import { NextRequest, NextResponse } from 'next/server';
import { getScenario } from '@/lib/store';

// Supported export types
type ExportType = 'conversation' | 'schedule' | 'diagnostics' | 'summary';

export async function POST(req: NextRequest) {
  const { scenarioId, type = 'summary' } = await req.json() as { scenarioId: string; type?: ExportType };
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  switch (type) {
    case 'conversation':
      return exportConversation(scenario);
    case 'schedule':
      return exportSchedule(scenario);
    case 'diagnostics':
      return exportDiagnostics(scenario);
    case 'summary':
    default:
      return exportSummary(scenario);
  }
}

// ── Conversation Log (.txt) ──

function exportConversation(scenario: ReturnType<typeof getScenario> & {}) {
  const lines: string[] = [
    'ADCP Scenario Lab - Conversation Log',
    `Scenario: ${scenario.config.name}`,
    `Exported: ${new Date().toISOString().slice(0, 19)}`,
    '='.repeat(60),
    '',
    `PARENT A: ${scenario.config.parentA.label} (${scenario.config.parentA.phone})`,
    '-'.repeat(60),
  ];

  for (const msg of scenario.messagesA) {
    const prefix = msg.from === 'user' ? scenario.config.parentA.label : 'ADCP';
    const ts = msg.timestamp?.slice(11, 19) || '';
    lines.push(`[${ts}] ${prefix}:`);
    lines.push(msg.text);
    lines.push('');
  }

  lines.push('');
  lines.push(`PARENT B: ${scenario.config.parentB.label} (${scenario.config.parentB.phone})`);
  lines.push('-'.repeat(60));

  for (const msg of scenario.messagesB) {
    const prefix = msg.from === 'user' ? scenario.config.parentB.label : 'ADCP';
    const ts = msg.timestamp?.slice(11, 19) || '';
    lines.push(`[${ts}] ${prefix}:`);
    lines.push(msg.text);
    lines.push('');
  }

  const content = lines.join('\n');
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="conversation-${scenario.id}.txt"`,
    },
  });
}

// ── Schedule (.csv) ──

function exportSchedule(scenario: ReturnType<typeof getScenario> & {}) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const rows = [
    ['Date', 'Day', 'Assigned To', 'Parent', 'Transition'].join(','),
  ];

  for (const day of scenario.schedule) {
    const d = new Date(day.date);
    const dow = dayNames[d.getDay()];
    const label = day.assignedTo === 'parent_a'
      ? scenario.config.parentA.label
      : scenario.config.parentB.label;
    rows.push([
      day.date,
      dow,
      day.assignedTo,
      label,
      day.isTransition ? 'yes' : '',
    ].join(','));
  }

  if (rows.length === 1) {
    rows.push('No schedule generated yet');
  }

  const content = rows.join('\n');
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="schedule-${scenario.id}.csv"`,
    },
  });
}

// ── Diagnostics (.json) ──

function exportDiagnostics(scenario: ReturnType<typeof getScenario> & {}) {
  const data = {
    scenarioId: scenario.id,
    exported: new Date().toISOString(),
    config: {
      name: scenario.config.name,
      template: scenario.config.template,
      targetSplit: scenario.config.targetSplit,
      children: scenario.config.children,
      parentA: scenario.config.parentA.label,
      parentB: scenario.config.parentB.label,
      personaA: scenario.config.personaA,
      personaB: scenario.config.personaB,
    },
    stats: {
      messagesA: scenario.messagesA.length,
      messagesB: scenario.messagesB.length,
      scheduleDays: scenario.schedule.length,
      logEntries: scenario.logs.length,
      currentDay: scenario.currentDay,
      status: scenario.status,
    },
    logs: scenario.logs.map(log => ({
      timestamp: log.timestamp,
      type: log.type,
      phone: log.phone,
      data: log.data,
    })),
  };

  const content = JSON.stringify(data, null, 2);
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="diagnostics-${scenario.id}.json"`,
    },
  });
}

// ── Summary (.txt) ──

function exportSummary(scenario: ReturnType<typeof getScenario> & {}) {
  const lines: string[] = [
    'ADCP Scenario Lab - Summary Report',
    `Exported: ${new Date().toISOString().slice(0, 19)}`,
    '='.repeat(60),
    '',
    'CONFIGURATION',
    '-'.repeat(40),
    `Name: ${scenario.config.name}`,
    `Description: ${scenario.config.description}`,
    `Template: ${scenario.config.template}`,
    `Target Split: ${scenario.config.targetSplit}/${100 - scenario.config.targetSplit}`,
    `Distance: ${scenario.config.distanceMiles} miles`,
    `Children: ${scenario.config.children.map(c => `${c.name} (age ${c.age})`).join(', ')}`,
    `Parent A: ${scenario.config.parentA.label} (${scenario.config.parentA.phone})`,
    `Parent B: ${scenario.config.parentB.label} (${scenario.config.parentB.phone})`,
    `Persona A: ${scenario.config.personaA || 'none'}`,
    `Persona B: ${scenario.config.personaB || 'none'}`,
    `Status: ${scenario.status}`,
    `Simulation Day: ${scenario.currentDay}`,
    '',
  ];

  if (scenario.config.lockedNights.length > 0) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    lines.push('LOCKED NIGHTS');
    lines.push('-'.repeat(40));
    for (const ln of scenario.config.lockedNights) {
      lines.push(`${ln.parent}: ${ln.daysOfWeek.map(d => dayNames[d]).join(', ')}`);
    }
    lines.push('');
  }

  // Schedule summary
  if (scenario.schedule.length > 0) {
    const aNights = scenario.schedule.filter(d => d.assignedTo === 'parent_a').length;
    const bNights = scenario.schedule.length - aNights;
    const transitions = scenario.schedule.filter(d => d.isTransition).length;
    lines.push('SCHEDULE METRICS');
    lines.push('-'.repeat(40));
    lines.push(`Total days: ${scenario.schedule.length}`);
    lines.push(`${scenario.config.parentA.label}: ${aNights} nights`);
    lines.push(`${scenario.config.parentB.label}: ${bNights} nights`);
    lines.push(`Actual split: ${Math.round(aNights / scenario.schedule.length * 100)}/${Math.round(bNights / scenario.schedule.length * 100)}`);
    lines.push(`Total transitions: ${transitions}`);
    lines.push(`Transitions/week: ${(transitions / (scenario.schedule.length / 7)).toFixed(1)}`);
    lines.push('');
  }

  // Message stats
  lines.push('MESSAGE STATS');
  lines.push('-'.repeat(40));
  lines.push(`Parent A messages: ${scenario.messagesA.length}`);
  lines.push(`Parent B messages: ${scenario.messagesB.length}`);
  lines.push(`System messages A: ${scenario.messagesA.filter(m => m.from === 'system').length}`);
  lines.push(`System messages B: ${scenario.messagesB.filter(m => m.from === 'system').length}`);
  lines.push(`User messages A: ${scenario.messagesA.filter(m => m.from === 'user').length}`);
  lines.push(`User messages B: ${scenario.messagesB.filter(m => m.from === 'user').length}`);
  lines.push(`Log entries: ${scenario.logs.length}`);
  lines.push('');

  // Log type breakdown
  if (scenario.logs.length > 0) {
    const typeCounts: Record<string, number> = {};
    for (const log of scenario.logs) {
      typeCounts[log.type] = (typeCounts[log.type] || 0) + 1;
    }
    lines.push('LOG BREAKDOWN');
    lines.push('-'.repeat(40));
    for (const [type, count] of Object.entries(typeCounts)) {
      lines.push(`${type}: ${count}`);
    }
  }

  const content = lines.join('\n');
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="summary-${scenario.id}.txt"`,
    },
  });
}
