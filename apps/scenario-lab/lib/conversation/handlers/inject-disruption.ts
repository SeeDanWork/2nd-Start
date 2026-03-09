// ── Inject Disruption Handler ────────────────────────────────
// Mediation-based disruption flow with asymmetric messaging.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import { PARENT_PERSONAS } from '../../personas';
import { SCENARIO_CATALOG } from '../../scenarios';
import { evaluateDisruption, generatePersonaMessage } from '../../behavior-engine';
import { generateSchedule } from '../../schedule-generator';
import {
  createDisruption, setDuration, attachProposals, selectProposal,
  declineAllProposals, markFollowupPending, resolveDisruption,
  isDuplicateDisruption, classifyDisruptionType,
  ActiveDisruption, DisruptionDuration, DISRUPTION_LABELS,
} from '../../disruption-engine';
import { generateProposalBundle } from '../../proposal-generator';

export interface InjectDisruptionResult {
  messagesA: Scenario['messagesA'];
  messagesB: Scenario['messagesB'];
  schedule: Scenario['schedule'];
  logs: Scenario['logs'];
  activeDisruption: ActiveDisruption;
}

export function handleInjectDisruption(
  scenario: Scenario,
  phone: string,
  scenarioDefId: string,
): InjectDisruptionResult {
  const scenarioDef = SCENARIO_CATALOG.find(s => s.id === scenarioDefId);
  if (!scenarioDef) {
    throw new Error('Scenario not found in catalog');
  }

  if (scenario.schedule.length === 0) {
    scenario.schedule = generateSchedule(scenario.config);
  }

  const ts = new Date().toISOString();
  const isParentA = phone === scenario.config.parentA.phone;
  const reportingParent: 'parent_a' | 'parent_b' = isParentA ? 'parent_a' : 'parent_b';
  const today = scenario.schedule[scenario.currentDay]?.date || new Date().toISOString().split('T')[0];

  const eventType = classifyDisruptionType(scenarioDef.description);

  // Idempotency check
  if (isDuplicateDisruption(scenario.activeDisruptions, reportingParent, eventType, today)) {
    throw new DuplicateDisruptionError();
  }

  const disruption = createDisruption(reportingParent, eventType, today);

  addLog(scenario.id, 'disruption', phone, {
    action: 'disruption_reported',
    disruptionId: disruption.id,
    eventType,
    reportingParent,
    scenarioDef: scenarioDef.id,
    name: scenarioDef.name,
    difficulty: scenarioDef.difficulty,
  });

  const reporterMessages = isParentA ? scenario.messagesA : scenario.messagesB;
  const otherMessages = isParentA ? scenario.messagesB : scenario.messagesA;
  const otherPhone = isParentA ? scenario.config.parentB.phone : scenario.config.parentA.phone;
  const reporterLabel = isParentA ? scenario.config.parentA.label : scenario.config.parentB.label;
  const otherLabel = isParentA ? scenario.config.parentB.label : scenario.config.parentA.label;
  const childNames = scenario.config.children.map(c => c.name).join(' & ');
  const todaySchedule = scenario.schedule[scenario.currentDay];
  const dateStr = todaySchedule
    ? new Date(todaySchedule.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';
  const assignedToReporter = todaySchedule?.assignedTo === reportingParent;

  // ── Day context (both parents get today's status) ──
  const dayContextReporter = `${dateStr} | ${childNames} with ${assignedToReporter ? 'you' : otherLabel}.`;
  const dayContextOther = `${dateStr} | ${childNames} with ${assignedToReporter ? reporterLabel : 'you'}.`;

  reporterMessages.push({
    id: crypto.randomUUID(), from: 'system', text: dayContextReporter,
    timestamp: ts, phone,
  });
  otherMessages.push({
    id: crypto.randomUUID(), from: 'system', text: dayContextOther,
    timestamp: ts, phone: otherPhone,
  });

  // ── Step 1: Reporter TEXTS about the disruption (parent message first) ──
  const pReporter = PARENT_PERSONAS.find(p =>
    p.id === (isParentA ? scenario.config.personaA : scenario.config.personaB)
  );
  const reportText = generatePersonaMessage(
    pReporter || PARENT_PERSONAS[0],
    'disruption_report',
    { eventType: scenarioDef.name },
  );
  reporterMessages.push({
    id: crypto.randomUUID(), from: 'user', text: reportText,
    timestamp: ts, phone,
  });

  // ── Step 2: System acknowledges and asks duration ──
  const eventLabel = DISRUPTION_LABELS[eventType];
  reporterMessages.push({
    id: crypto.randomUUID(), from: 'system', text: [
      `Got it — ${eventLabel.toLowerCase()} recorded.`,
      `How long do you expect this to last?`,
      '',
      '1. Today only',
      '2. 2-3 days',
      '3. About a week',
      '4. Not sure yet',
    ].join('\n'),
    timestamp: ts, phone,
  });

  // ── Step 3: Reporter answers duration ──
  const durationChoice: DisruptionDuration =
    scenarioDef.difficulty <= 2 ? 'today_only'
    : scenarioDef.difficulty <= 3 ? '2_3_days'
    : 'unknown';
  const durationLabels: Record<DisruptionDuration, string> = {
    today_only: 'Today only',
    '2_3_days': '2-3 days',
    week: 'About a week',
    unknown: 'Not sure yet',
  };
  reporterMessages.push({
    id: crypto.randomUUID(), from: 'user', text: durationLabels[durationChoice],
    timestamp: ts, phone,
  });

  const withDuration = setDuration(disruption, durationChoice, scenario.schedule, scenario.currentDay);

  // ── Step 4: System confirms and notifies reporter that other parent is being contacted ──
  reporterMessages.push({
    id: crypto.randomUUID(), from: 'system',
    text: `Notifying ${otherLabel}. I'll let you know when they respond.`,
    timestamp: ts, phone,
  });

  // ── Step 5: Other parent gets coverage request (on THEIR phone) ──
  const durationText = withDuration.duration === 'today_only' ? 'today'
    : withDuration.duration === '2_3_days' ? '2-3 days'
    : withDuration.duration === 'week' ? 'this week'
    : 'duration unknown';

  otherMessages.push({
    id: crypto.randomUUID(), from: 'system', text: [
      `${reporterLabel} reports: ${eventLabel.toLowerCase()}.`,
      `Estimated duration: ${durationText}.`,
      `Can you help with coverage?`,
    ].join('\n'),
    timestamp: ts, phone: otherPhone,
  });

  // ── Step 6: Generate proposals and show to other parent ──
  const bundle = generateProposalBundle(
    scenario.config, scenario.schedule, withDuration, scenario.currentDay,
  );
  const withProposals = attachProposals(withDuration, bundle);

  const choiceLines = bundle.options.map((opt, i) => `${i + 1}. ${opt.label}`);
  choiceLines.push(`${bundle.options.length + 1}. Decline all`);

  otherMessages.push({
    id: crypto.randomUUID(), from: 'system', text: [
      'Here are the coverage options:',
      '',
      ...choiceLines,
    ].join('\n'),
    timestamp: ts, phone: otherPhone,
  });

  // ── Step 7: Other parent responds ──
  const pOther = PARENT_PERSONAS.find(p =>
    p.id === (isParentA ? scenario.config.personaB : scenario.config.personaA)
  );
  const otherDecision = pOther
    ? evaluateDisruption(
        pOther,
        scenarioDef.events[0] || { type: eventType, day: scenario.currentDay, description: scenarioDef.description },
        scenario.currentDay,
      )
    : { decision: 'accept', confidence: 0.5 };

  let resolved: ActiveDisruption;

  if (otherDecision.decision === 'accept' && bundle.options.length > 0) {
    const selected = bundle.options[0];
    resolved = selectProposal(withProposals, selected.id);

    // Other parent picks an option
    otherMessages.push({
      id: crypto.randomUUID(), from: 'user', text: `${selected.label}`,
      timestamp: ts, phone: otherPhone,
    });

    // Confirm to other parent
    otherMessages.push({
      id: crypto.randomUUID(), from: 'system',
      text: `Got it. Coverage confirmed. Schedule updated.`,
      timestamp: ts, phone: otherPhone,
    });

    // Notify reporter
    reporterMessages.push({
      id: crypto.randomUUID(), from: 'system',
      text: `${otherLabel} accepted coverage.\n\nSelected: ${selected.label}.\nSchedule adjustment applied.`,
      timestamp: ts, phone,
    });

    addLog(scenario.id, 'info', phone, {
      action: 'proposal_accepted',
      disruptionId: resolved.id,
      selectedOption: selected.id,
      fairnessImpact: selected.fairnessImpact,
    });
  } else if (otherDecision.decision === 'reject') {
    resolved = declineAllProposals(withProposals);

    otherMessages.push({
      id: crypto.randomUUID(), from: 'user', text: "I can't cover right now",
      timestamp: ts, phone: otherPhone,
    });

    // Confirm to other parent
    otherMessages.push({
      id: crypto.randomUUID(), from: 'system',
      text: `Understood. I'll let ${reporterLabel} know.`,
      timestamp: ts, phone: otherPhone,
    });

    // Notify reporter
    reporterMessages.push({
      id: crypto.randomUUID(), from: 'system',
      text: `${otherLabel} is unable to cover.\n\nYou may need to manage this yourself or we can explore other options.`,
      timestamp: ts, phone,
    });

    addLog(scenario.id, 'info', phone, {
      action: 'proposals_declined', disruptionId: resolved.id,
    });
  } else {
    // Counter or partial
    const partialOpt = bundle.options.find(o => o.coverageDays[0]?.type === 'partial_day_coverage');
    const chosen = partialOpt || bundle.options[0];
    resolved = chosen ? selectProposal(withProposals, chosen.id) : declineAllProposals(withProposals);

    if (chosen) {
      otherMessages.push({
        id: crypto.randomUUID(), from: 'user',
        text: `I can do ${chosen.label.toLowerCase()}`,
        timestamp: ts, phone: otherPhone,
      });

      otherMessages.push({
        id: crypto.randomUUID(), from: 'system',
        text: `Got it. Coverage confirmed. Schedule updated.`,
        timestamp: ts, phone: otherPhone,
      });

      reporterMessages.push({
        id: crypto.randomUUID(), from: 'system',
        text: `${otherLabel} offered partial coverage.\n\nSelected: ${chosen.label}.\nSchedule adjustment applied.`,
        timestamp: ts, phone,
      });
    }

    addLog(scenario.id, 'info', phone, {
      action: 'proposal_counter',
      disruptionId: resolved.id,
      selectedOption: chosen?.id || null,
    });
  }

  // Follow-up or resolve
  if (durationChoice !== 'today_only') {
    resolved = markFollowupPending(resolved);
  } else {
    resolved = resolveDisruption(resolved);
  }

  scenario.activeDisruptions.push(resolved);

  return {
    messagesA: scenario.messagesA,
    messagesB: scenario.messagesB,
    schedule: scenario.schedule,
    logs: scenario.logs,
    activeDisruption: resolved,
  };
}

export class DuplicateDisruptionError extends Error {
  constructor() {
    super('Disruption already active for this parent and event type');
    this.name = 'DuplicateDisruptionError';
  }
}
