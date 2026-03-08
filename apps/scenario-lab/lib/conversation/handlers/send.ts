// ── Send Handler ─────────────────────────────────────────────
// Processes a user-typed message through the policy engine,
// emits events to the session, and syncs back to legacy format.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import {
  generateSyntheticSystemResponse,
  isOnboardingComplete,
} from '../../behavior-engine';
import { generateSchedule } from '../../schedule-generator';
import { buildAnsweredTopics } from '../state';
import { getOrCreateSession } from '../session-store';
import { processMessageSync } from '../policy-engine';
import { buildTranscript, transcriptToLegacyMessages } from '../view-builder';
import { emitEvent, completeOnboarding } from '../session';

export interface SendResult {
  response: string;
  messagesA: Scenario['messagesA'];
  messagesB: Scenario['messagesB'];
  schedule: Scenario['schedule'];
  logs: Scenario['logs'];
  // New: policy engine output for diagnostics
  interpretation?: Record<string, unknown>;
  recommendation?: Record<string, unknown>;
}

export async function handleSend(
  scenario: Scenario,
  phone: string,
  body: string,
): Promise<SendResult> {
  addLog(scenario.id, 'api_call', phone, { action: 'send', body });

  const isParentA = phone === scenario.config.parentA.phone;
  const sender = isParentA ? 'parent_a' as const : 'parent_b' as const;
  const session = getOrCreateSession(scenario.id, scenario.config);

  // Sync schedule into session if it exists but session doesn't have it
  if (scenario.schedule.length > 0 && session.schedule.length === 0) {
    session.schedule = scenario.schedule;
  }

  // Sync onboarding state from legacy messages
  syncOnboardingState(scenario, session);

  // ── Run policy engine ──
  const policyResult = processMessageSync(session, sender, body);

  addLog(scenario.id, 'info', phone, {
    action: 'policy_engine',
    intent: policyResult.interpretation.intent,
    confidence: policyResult.interpretation.confidence,
    nextStep: policyResult.recommendation.nextStep,
    eventsEmitted: policyResult.eventsEmitted.length,
    modeChanged: policyResult.modeChanged,
  });

  // ── Generate system response ──
  // For onboarding, we still use the synthetic response engine
  // because it produces the actual conversational text the parent sees.
  // The policy engine determined the intent and action, but the
  // behavior-engine has the onboarding flow logic.
  let response = '';

  if (session.mode === 'onboarding' || policyResult.recommendation.nextStep === 'advance_onboarding') {
    // Use existing onboarding flow for system response text
    const messages = isParentA ? scenario.messagesA : scenario.messagesB;
    messages.push({
      id: crypto.randomUUID(),
      from: 'user',
      text: body,
      timestamp: new Date().toISOString(),
      phone,
    });

    const answeredTopics = buildAnsweredTopics(messages);
    response = generateSyntheticSystemResponse(scenario.config, answeredTopics);

    messages.push({
      id: crypto.randomUUID(),
      from: 'system',
      text: response,
      timestamp: new Date().toISOString(),
      phone,
    });

    // Emit system response as event
    emitEvent(session, 'SystemAcknowledgment', 'system', {
      text: response,
      targetParent: sender,
    });

    // Generate schedule if onboarding just completed
    if (isOnboardingComplete(response) && scenario.schedule.length === 0) {
      scenario.schedule = generateSchedule(scenario.config);
      session.schedule = scenario.schedule;

      addLog(scenario.id, 'info', phone, {
        action: 'schedule_generated',
        days: scenario.schedule.length,
      });

      // Notify the other parent about schedule creation
      const otherMessages = isParentA ? scenario.messagesB : scenario.messagesA;
      const otherPhone = isParentA ? scenario.config.parentB.phone : scenario.config.parentA.phone;
      const otherLabel = isParentA ? scenario.config.parentA.label : scenario.config.parentB.label;
      const ts = new Date().toISOString();

      otherMessages.push({
        id: crypto.randomUUID(),
        from: 'system',
        text: "Your family schedule is now created! You can view your upcoming exchanges by typing 'schedule'. Type 'help' for available commands.",
        timestamp: ts,
        phone: otherPhone,
      });
      otherMessages.push({
        id: crypto.randomUUID(),
        from: 'system',
        text: `${otherLabel} has invited you to ADCP to co-manage your family's custody schedule. Everything is set up and ready to go.`,
        timestamp: ts,
        phone: otherPhone,
      });

      // Mark onboarding complete in session
      if (!session.onboarding.parentA.completed && isParentA) {
        completeOnboarding(session, 'parent_a');
      }
    }
  } else {
    // ── Operational/mediation mode ──
    // The policy engine already emitted events. Build response from
    // the acknowledgment text or the last system event.
    response = policyResult.recommendation.acknowledgmentText || 'Got it.';

    // Add to legacy messages
    const messages = isParentA ? scenario.messagesA : scenario.messagesB;
    messages.push({
      id: crypto.randomUUID(),
      from: 'user',
      text: body,
      timestamp: new Date().toISOString(),
      phone,
    });
    messages.push({
      id: crypto.randomUUID(),
      from: 'system',
      text: response,
      timestamp: new Date().toISOString(),
      phone,
    });

    // If a case was opened and other parent needs notification,
    // add coverage request to their messages
    if (policyResult.recommendation.nextStep === 'open_case') {
      const otherMessages = isParentA ? scenario.messagesB : scenario.messagesA;
      const otherPhone = isParentA ? scenario.config.parentB.phone : scenario.config.parentA.phone;
      const senderLabel = isParentA ? scenario.config.parentA.label : scenario.config.parentB.label;

      const caseEvents = session.events.all().filter(e => e.kind === 'CoverageRequestSent');
      const lastCoverage = caseEvents[caseEvents.length - 1];
      if (lastCoverage) {
        const payload = lastCoverage.payload as { summary: string };
        otherMessages.push({
          id: crypto.randomUUID(),
          from: 'system',
          text: payload.summary,
          timestamp: new Date().toISOString(),
          phone: otherPhone,
        });
      }
    }
  }

  if (scenario.status === 'draft') scenario.status = 'simulating';

  addLog(scenario.id, 'info', phone, {
    action: 'message',
    body,
    response: response.slice(0, 200),
    intent: policyResult.interpretation.intent,
    nextStep: policyResult.recommendation.nextStep,
  });

  return {
    response,
    messagesA: scenario.messagesA,
    messagesB: scenario.messagesB,
    schedule: scenario.schedule,
    logs: scenario.logs,
    interpretation: {
      intent: policyResult.interpretation.intent,
      confidence: policyResult.interpretation.confidence,
      disruptionType: policyResult.interpretation.disruptionType,
      urgency: policyResult.interpretation.urgency,
      emotionalTone: policyResult.interpretation.emotionalTone,
    },
    recommendation: {
      nextStep: policyResult.recommendation.nextStep,
      rationale: policyResult.recommendation.rationale,
      confidence: policyResult.recommendation.confidence,
    },
  };
}

// ── Helpers ──

/**
 * Sync onboarding state from legacy messages into the session.
 * This bridges the gap during the transition period where both
 * systems run in parallel.
 */
function syncOnboardingState(
  scenario: Scenario,
  session: ReturnType<typeof getOrCreateSession>,
): void {
  // If legacy messages show onboarding is done, mark it in session
  if (scenario.messagesA.length > 0) {
    session.onboarding.parentA.started = true;
    const lastSystemA = [...scenario.messagesA].reverse().find(m => m.from === 'system');
    if (lastSystemA && isOnboardingComplete(lastSystemA.text)) {
      session.onboarding.parentA.completed = true;
    }
  }
  if (scenario.messagesB.length > 0) {
    session.onboarding.parentB.started = true;
    const lastSystemB = [...scenario.messagesB].reverse().find(m => m.from === 'system');
    if (lastSystemB && isOnboardingComplete(lastSystemB.text)) {
      session.onboarding.parentB.completed = true;
    }
  }
  if (session.onboarding.parentA.completed && session.onboarding.parentB.completed) {
    if (session.mode === 'onboarding') session.mode = 'operational';
  }
  if (scenario.schedule.length > 0 && session.schedule.length === 0) {
    session.schedule = scenario.schedule;
  }
}
