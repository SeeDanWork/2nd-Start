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
  ActiveDisruption, DisruptionDuration,
} from '../../disruption-engine';
import { generateProposalBundle } from '../../proposal-generator';
import {
  disruptionReportConfirmation, durationQuestion, coverageRequest,
  proposalBundleMessage, proposalSelectedMessage, declineConfirmation,
  manageSelfConfirmation, followupCheck,
} from '../../message-router';

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

  // Step 1: Reporter gets confirmation
  const reporterMsg = disruptionReportConfirmation(
    disruption, scenario.config, scenario.schedule, scenario.currentDay,
  );
  reporterMessages.push({
    id: crypto.randomUUID(), from: 'system', text: reporterMsg.text,
    timestamp: ts, phone,
  });

  // Step 2: Reporter requests coverage
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

  // Step 3: Duration question
  const durationMsg = durationQuestion(disruption);
  reporterMessages.push({
    id: crypto.randomUUID(), from: 'system', text: durationMsg.text,
    timestamp: ts, phone,
  });

  // Auto-simulate duration
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

  // Step 4: Coverage request to other parent
  const coverageMsg = coverageRequest(withDuration, scenario.config);
  otherMessages.push({
    id: crypto.randomUUID(), from: 'system', text: coverageMsg.text,
    timestamp: ts, phone: otherPhone,
  });

  // Step 5: Generate proposals
  const bundle = generateProposalBundle(
    scenario.config, scenario.schedule, withDuration, scenario.currentDay,
  );
  const withProposals = attachProposals(withDuration, bundle);

  const bundleMsg = proposalBundleMessage(withProposals, bundle, scenario.config);
  otherMessages.push({
    id: crypto.randomUUID(), from: 'system', text: bundleMsg.text,
    timestamp: ts, phone: otherPhone,
  });

  // Step 6: Other parent reacts
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

    otherMessages.push({
      id: crypto.randomUUID(), from: 'user', text: `Option 1: ${selected.label}`,
      timestamp: ts, phone: otherPhone,
    });

    const resolution = proposalSelectedMessage(
      resolved, selected.label, scenario.config, scenario.schedule, scenario.currentDay,
    );
    reporterMessages.push({
      id: crypto.randomUUID(), from: 'system', text: resolution.reporter.text,
      timestamp: ts, phone,
    });
    otherMessages.push({
      id: crypto.randomUUID(), from: 'system', text: resolution.other.text,
      timestamp: ts, phone: otherPhone,
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
      id: crypto.randomUUID(), from: 'user', text: 'Decline',
      timestamp: ts, phone: otherPhone,
    });

    const decline = declineConfirmation(resolved, scenario.config);
    reporterMessages.push({
      id: crypto.randomUUID(), from: 'system', text: decline.reporter.text,
      timestamp: ts, phone,
    });
    otherMessages.push({
      id: crypto.randomUUID(), from: 'system', text: decline.other.text,
      timestamp: ts, phone: otherPhone,
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
        text: `${chosen.label}`,
        timestamp: ts, phone: otherPhone,
      });

      const resolution = proposalSelectedMessage(
        resolved, chosen.label, scenario.config, scenario.schedule, scenario.currentDay,
      );
      reporterMessages.push({
        id: crypto.randomUUID(), from: 'system', text: resolution.reporter.text,
        timestamp: ts, phone,
      });
      otherMessages.push({
        id: crypto.randomUUID(), from: 'system', text: resolution.other.text,
        timestamp: ts, phone: otherPhone,
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
