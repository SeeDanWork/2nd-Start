// ── Step Day Handler ─────────────────────────────────────────
// Advances simulation by N days with operational messages.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import { PARENT_PERSONAS } from '../../personas';
import { getArchetype } from '../../behavior-engine';
import { generateSchedule } from '../../schedule-generator';
import {
  getOperationalMessage,
  checkFairnessAlert,
  checkFrictionAhead,
} from '../../operational-messages';
import { buildDaySummaryExplanation } from '../../explanation-engine';

export interface DayResult {
  day: number;
  mode: 'silent' | 'operational' | 'disruption';
  systemMessageType?: string;
  decisionA?: { decision: string; confidence: number; reasoning: string };
  decisionB?: { decision: string; confidence: number; reasoning: string };
  messageA: string;
  messageB: string;
}

export interface StepDayResult {
  days: DayResult[];
  totalDaysRun: number;
  messagesA: Scenario['messagesA'];
  messagesB: Scenario['messagesB'];
  schedule: Scenario['schedule'];
  logs: Scenario['logs'];
}

export function handleStepDay(
  scenario: Scenario,
  body: unknown,
): StepDayResult {
  const days = typeof body === 'number' ? body : (body as { days?: number })?.days || 1;
  const pA = PARENT_PERSONAS.find(p => p.id === scenario.config.personaA);
  const pB = PARENT_PERSONAS.find(p => p.id === scenario.config.personaB);

  if (!pA || !pB) {
    throw new Error('Both parents must have personas assigned');
  }

  if (scenario.schedule.length === 0) {
    scenario.schedule = generateSchedule(scenario.config);
  }

  const dayResults: DayResult[] = [];
  const now = () => new Date().toISOString();

  for (let d = 0; d < days; d++) {
    const simDay = scenario.currentDay;
    scenario.currentDay++;
    const ts = now();

    const opMsgA = getOperationalMessage(scenario.config, scenario.schedule, simDay, 'parent_a');
    const opMsgB = getOperationalMessage(scenario.config, scenario.schedule, simDay, 'parent_b');

    const fairnessAlert = (simDay % 7 === 0) ? checkFairnessAlert(scenario.config, scenario.schedule, simDay) : null;
    const frictionAlert = (simDay % 7 === 0) ? checkFrictionAhead(scenario.config, scenario.schedule, simDay) : null;

    const isSilent = opMsgA.type === 'SILENT' && !fairnessAlert && !frictionAlert;

    if (isSilent) {
      const statusText = buildDaySummaryExplanation(scenario.config, scenario.schedule, simDay);
      if (statusText) {
        scenario.messagesA.push({
          id: crypto.randomUUID(), from: 'system', text: statusText,
          timestamp: ts, phone: scenario.config.parentA.phone,
        });
        scenario.messagesB.push({
          id: crypto.randomUUID(), from: 'system', text: statusText,
          timestamp: ts, phone: scenario.config.parentB.phone,
        });
      }

      addLog(scenario.id, 'info', scenario.config.parentA.phone, {
        action: 'step_day', day: d, mode: 'silent',
        scheduleDay: scenario.schedule[simDay]?.date || null,
        assignedTo: scenario.schedule[simDay]?.assignedTo || null,
      });

      dayResults.push({ day: d, mode: 'silent', messageA: '', messageB: '' });
    } else {
      const systemTextA = [
        opMsgA.type !== 'SILENT' ? opMsgA.text : '',
        fairnessAlert?.text || '',
        frictionAlert?.text || '',
      ].filter(Boolean).join('\n\n');

      const systemTextB = [
        opMsgB.type !== 'SILENT' ? opMsgB.text : '',
        fairnessAlert?.text || '',
        frictionAlert?.text || '',
      ].filter(Boolean).join('\n\n');

      if (systemTextA) {
        scenario.messagesA.push({
          id: crypto.randomUUID(), from: 'system', text: systemTextA,
          timestamp: ts, phone: scenario.config.parentA.phone,
        });
      }
      if (systemTextB) {
        scenario.messagesB.push({
          id: crypto.randomUUID(), from: 'system', text: systemTextB,
          timestamp: ts, phone: scenario.config.parentB.phone,
        });
      }

      addLog(scenario.id, 'info', scenario.config.parentA.phone, {
        action: 'step_day', day: d, mode: 'operational',
        messageType: opMsgA.type,
        scheduleDay: scenario.schedule[simDay]?.date || null,
        fairnessAlert: !!fairnessAlert,
        frictionAlert: !!frictionAlert,
        metrics: opMsgA.metrics || null,
      });

      dayResults.push({
        day: d, mode: 'operational',
        systemMessageType: opMsgA.type,
        messageA: systemTextA, messageB: systemTextB,
      });
    }
  }

  if (scenario.status === 'draft') scenario.status = 'simulating';

  return {
    days: dayResults,
    totalDaysRun: days,
    messagesA: scenario.messagesA,
    messagesB: scenario.messagesB,
    schedule: scenario.schedule,
    logs: scenario.logs,
  };
}
