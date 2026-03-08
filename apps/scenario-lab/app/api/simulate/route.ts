import { NextRequest, NextResponse } from 'next/server';
import { getScenario, addLog } from '@/lib/store';
import { PARENT_PERSONAS } from '@/lib/personas';
import { SCENARIO_CATALOG } from '@/lib/scenarios';
import {
  evaluateProposalWithArchetype,
  evaluateDisruption,
  generatePersonaMessage,
  getArchetype,
  getResponsePattern,
  classifySystemMessage,
  classifyAllTopics,
  generateReactiveAnswer,
  generateCompoundAnswer,
  isOnboardingComplete,
  generateParentBJoinResponse,
  generateSyntheticSystemResponse,
  DecisionResult,
} from '@/lib/behavior-engine';
import { generateSchedule } from '@/lib/schedule-generator';
import { getOperationalMessage, checkFairnessAlert, checkFrictionAhead } from '@/lib/operational-messages';
import { buildDisruptionExplanation, buildDaySummaryExplanation, snapshotMetrics, formatLevel2, formatLevel3, buildExplanation } from '@/lib/explanation-engine';
import {
  createDisruption, setDuration, attachProposals, selectProposal,
  declineAllProposals, markFollowupPending, resolveDisruption,
  isDuplicateDisruption, classifyDisruptionType, DISRUPTION_LABELS,
  ActiveDisruption, DisruptionDuration,
} from '@/lib/disruption-engine';
import { generateProposalBundle } from '@/lib/proposal-generator';
import {
  disruptionReportConfirmation, durationQuestion, coverageRequest,
  proposalBundleMessage, proposalSelectedMessage, declineConfirmation,
  manageSelfConfirmation, followupCheck, getQuickActions,
} from '@/lib/message-router';

const LLM_ROUTER = process.env.LLM_ROUTER_URL || 'http://localhost:3100';

function getChildNames(config: { children: Array<{ name: string }> }): string {
  return config.children.map(c => c.name).join(' & ');
}

/** Call the LLM router to classify intent of a parent's message. */
async function classifyIntent(input: string, context?: Record<string, unknown>): Promise<{
  intent: string;
  confidence: number;
} | null> {
  try {
    const res = await fetch(`${LLM_ROUTER}/llm/classify-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      intent: data.structured_data?.intent || 'general_question',
      confidence: data.confidence || 0,
    };
  } catch {
    return null;
  }
}

/** Call the LLM router to extract entities from a parent's message. */
async function extractEntities(input: string, context?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${LLM_ROUTER}/llm/extract-entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.structured_data || null;
  } catch {
    return null;
  }
}

/** Generate a system explanation via the LLM router. */
async function generateExplanation(input: string, context?: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`${LLM_ROUTER}/llm/generate-explanation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.structured_data?.explanation || null;
  } catch {
    return null;
  }
}

/** Build answeredTopics by scanning message history.
 *  For each system message followed by a user reply, classify the system message
 *  to determine what topic was asked, then mark it as answered. */
function buildAnsweredTopics(messages: Array<{ from: string; text: string }>): Set<string> {
  const answered = new Set<string>();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.from === 'system') {
      // If a user message follows this system message, all topics asked are answered
      const nextMsg = messages[i + 1];
      if (nextMsg && nextMsg.from === 'user') {
        const topics = classifyAllTopics(msg.text);
        for (const topic of topics) {
          if (topic !== 'unknown' && topic !== 'confirmed') {
            answered.add(topic);
          }
        }
      }
    }
  }
  return answered;
}

/** Generate a system response: uses synthetic engine (deterministic, no external API needed). */
function generateSystemResponse(
  config: import('@/lib/types').ScenarioConfig,
  answeredTopics: Set<string>,
): string {
  return generateSyntheticSystemResponse(config, answeredTopics);
}

export async function POST(req: NextRequest) {
  const { scenarioId, phone, action, body } = await req.json();

  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  try {
    let responseText: string;

    if (action === 'connect') {
      addLog(scenarioId, 'api_call', phone, { action: 'connect', phone });

      // Generate welcome message locally — no external API needed
      const answeredTopics = new Set<string>();
      responseText = generateSyntheticSystemResponse(scenario.config, answeredTopics);

      addLog(scenarioId, 'info', phone, { action: 'connected', response: responseText.slice(0, 200) });

    } else if (action === 'send') {
      addLog(scenarioId, 'api_call', phone, { action: 'send', body });

      // Enrich with LLM router (non-blocking — simulation works without it)
      const [intent, entities] = await Promise.all([
        classifyIntent(body, { scenario: scenario.config.name }),
        extractEntities(body, { scenario: scenario.config.name }),
      ]);

      if (intent) {
        addLog(scenarioId, 'info', phone, {
          action: 'llm_classify', intent: intent.intent, confidence: intent.confidence,
        });
      }
      if (entities) {
        addLog(scenarioId, 'info', phone, { action: 'llm_entities', entities });
      }

      // Generate system response locally
      const isParentA = phone === scenario.config.parentA.phone;
      const messages = isParentA ? scenario.messagesA : scenario.messagesB;
      // Include the current user message in history before building topics
      messages.push({ id: crypto.randomUUID(), from: 'user', text: body, timestamp: new Date().toISOString(), phone });
      const answeredTopics = buildAnsweredTopics(messages);
      responseText = generateSystemResponse(scenario.config, answeredTopics);
      messages.push({ id: crypto.randomUUID(), from: 'system', text: responseText, timestamp: new Date().toISOString(), phone });

      if (scenario.status === 'draft') scenario.status = 'simulating';

      // Generate schedule if onboarding just completed
      if (isOnboardingComplete(responseText) && scenario.schedule.length === 0) {
        scenario.schedule = generateSchedule(scenario.config);
        addLog(scenarioId, 'info', phone, {
          action: 'schedule_generated', days: scenario.schedule.length,
        });
      }

      addLog(scenarioId, 'info', phone, { action: 'message', body, response: responseText.slice(0, 200) });

      return NextResponse.json({
        response: responseText,
        messagesA: scenario.messagesA,
        messagesB: scenario.messagesB,
        schedule: scenario.schedule,
        logs: scenario.logs,
      });

    } else if (action === 'auto_respond') {
      // Behavior engine auto-response based on persona
      const isParentA = phone === scenario.config.parentA.phone;
      const personaId = isParentA ? scenario.config.personaA : scenario.config.personaB;
      const persona = PARENT_PERSONAS.find(p => p.id === personaId);

      if (!persona) {
        return NextResponse.json({ error: 'No persona assigned to this parent' }, { status: 400 });
      }

      const archetype = (scenario.config.personaA && scenario.config.personaB)
        ? getArchetype(scenario.config.personaA, scenario.config.personaB)
        : null;

      const messages = isParentA ? scenario.messagesA : scenario.messagesB;
      const lastSystem = [...messages].reverse().find(m => m.from === 'system');
      const context = lastSystem?.text.toLowerCase() || '';

      let autoText: string;
      let decision: DecisionResult | null = null;

      const isProposal = context.includes('proposal') || context.includes('schedule') || context.includes('approve');
      const isDisruption = context.includes('sick') || context.includes('emergency') || context.includes('cancel');

      if (isProposal) {
        decision = evaluateProposalWithArchetype(persona, archetype, 5, false, false, messages.length);
        addLog(scenarioId, 'info', phone, {
          action: 'behavior_engine',
          archetype: archetype?.id || null,
          conflict_probability: archetype?.conflict_probability || null,
          decision: decision.decision,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
        });

        if (decision.decision === 'accept') {
          autoText = generatePersonaMessage(persona, 'proposal_response');
        } else if (decision.decision === 'counter') {
          autoText = decision.counter_text || generatePersonaMessage(persona, 'swap_request');
        } else if (decision.decision === 'ignore') {
          autoText = '(no response)';
        } else {
          autoText = generatePersonaMessage(persona, 'complaint');
        }
      } else if (isDisruption) {
        const event = { type: 'disruption', day: messages.length };
        decision = evaluateDisruption(persona, event, messages.length);
        addLog(scenarioId, 'info', phone, {
          action: 'behavior_engine',
          decision: decision.decision,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
        });
        autoText = generatePersonaMessage(persona, 'disruption_report', { eventType: 'disruption' });
      } else {
        autoText = generatePersonaMessage(persona, 'greeting');
      }

      // Enrich with LLM intent classification
      const intent = await classifyIntent(autoText, { persona: persona.name });
      if (intent) {
        addLog(scenarioId, 'info', phone, {
          action: 'llm_classify', intent: intent.intent, confidence: intent.confidence,
        });
      }

      // Generate system response locally
      messages.push({ id: crypto.randomUUID(), from: 'user', text: autoText, timestamp: new Date().toISOString(), phone });
      const answeredTopics = buildAnsweredTopics(messages);
      responseText = generateSystemResponse(scenario.config, answeredTopics);
      messages.push({ id: crypto.randomUUID(), from: 'system', text: responseText, timestamp: new Date().toISOString(), phone });

      if (scenario.status === 'draft') scenario.status = 'simulating';

      return NextResponse.json({
        response: responseText,
        autoMessage: autoText,
        decision: decision ? { decision: decision.decision, confidence: decision.confidence, reasoning: decision.reasoning } : null,
        messagesA: scenario.messagesA,
        messagesB: scenario.messagesB,
        logs: scenario.logs,
      });

    } else if (action === 'simulate_pair') {
      const personaAId = scenario.config.personaA;
      const personaBId = scenario.config.personaB;
      const pA = PARENT_PERSONAS.find(p => p.id === personaAId);
      const pB = PARENT_PERSONAS.find(p => p.id === personaBId);

      if (!pA || !pB) {
        return NextResponse.json({ error: 'Both parents must have personas assigned' }, { status: 400 });
      }

      const archetype = getArchetype(personaAId!, personaBId!);

      const lastSystemA = [...scenario.messagesA].reverse().find(m => m.from === 'system');
      const lastSystemB = [...scenario.messagesB].reverse().find(m => m.from === 'system');
      const contextA = lastSystemA?.text.toLowerCase() || '';
      const contextB = lastSystemB?.text.toLowerCase() || '';

      const isProposalA = contextA.includes('proposal') || contextA.includes('schedule') || contextA.includes('approve');
      const isDisruptionA = contextA.includes('sick') || contextA.includes('emergency') || contextA.includes('cancel') || contextA.includes('disruption');
      const isProposalB = contextB.includes('proposal') || contextB.includes('schedule') || contextB.includes('approve');
      const isDisruptionB = contextB.includes('sick') || contextB.includes('emergency') || contextB.includes('cancel') || contextB.includes('disruption');

      let decisionA: DecisionResult;
      if (isProposalA) {
        decisionA = evaluateProposalWithArchetype(pA, archetype, 5, false, false, scenario.messagesA.length);
      } else if (isDisruptionA) {
        decisionA = evaluateDisruption(pA, { type: 'disruption', day: scenario.messagesA.length }, scenario.messagesA.length);
      } else {
        decisionA = { decision: 'accept', confidence: 0.8, reasoning: `${pA.name}: Ready to engage`, delay_seconds: 0 };
      }

      let decisionB: DecisionResult;
      if (isProposalB) {
        decisionB = evaluateProposalWithArchetype(pB, archetype, 5, false, false, scenario.messagesB.length);
      } else if (isDisruptionB) {
        decisionB = evaluateDisruption(pB, { type: 'disruption', day: scenario.messagesB.length }, scenario.messagesB.length);
      } else {
        decisionB = { decision: 'accept', confidence: 0.8, reasoning: `${pB.name}: Ready to engage`, delay_seconds: 0 };
      }

      const topicA = lastSystemA ? classifySystemMessage(lastSystemA.text) : 'greeting';
      const topicB = lastSystemB ? classifySystemMessage(lastSystemB.text) : 'greeting';
      const stillOnboardingA = topicA !== 'confirmed' && topicA !== 'unknown' && !isProposalA && !isDisruptionA;
      const stillOnboardingB = topicB !== 'confirmed' && topicB !== 'unknown' && !isProposalB && !isDisruptionB;

      const autoTextA = stillOnboardingA
        ? generateReactiveAnswer(topicA, pA, scenario.config) || generatePersonaMessage(pA, 'greeting')
        : generatePersonaMessage(pA, isProposalA ? 'proposal_response' : isDisruptionA ? 'disruption_report' : 'greeting');
      const autoTextB = stillOnboardingB
        ? generateReactiveAnswer(topicB, pB, scenario.config) || generatePersonaMessage(pB, 'greeting')
        : generatePersonaMessage(pB, isProposalB ? 'proposal_response' : isDisruptionB ? 'disruption_report' : 'greeting');

      // Resolution paths
      const resolutionPaths: Array<{ label: string; description: string; probability: number }> = [];

      if (decisionA.decision === 'accept' && decisionB.decision === 'accept') {
        resolutionPaths.push({ label: 'Mutual Agreement', description: 'Both parents accept — no conflict', probability: 0.9 });
      } else if (decisionA.decision === 'accept' || decisionB.decision === 'accept') {
        resolutionPaths.push({ label: 'One-Sided Accept', description: 'One accepts, other resists — negotiation needed', probability: 0.5 });
        resolutionPaths.push({ label: 'Escalation', description: 'Resistance may escalate to counter-proposal chain', probability: 0.3 });
      }
      if (decisionA.decision === 'counter' || decisionB.decision === 'counter') {
        resolutionPaths.push({ label: 'Counter-Proposal', description: 'Counter offered — may converge or deadlock', probability: 0.4 });
        resolutionPaths.push({ label: 'Mediation Trigger', description: 'Repeated counters may trigger mediation', probability: 0.2 });
      }
      if (decisionA.decision === 'reject' || decisionB.decision === 'reject') {
        resolutionPaths.push({ label: 'Deadlock', description: 'Rejection may lead to deadlock — system auto-resolves', probability: 0.3 });
        resolutionPaths.push({ label: 'Escalation to Default', description: 'System falls back to base schedule', probability: 0.4 });
      }
      if (decisionA.decision === 'ignore' || decisionB.decision === 'ignore') {
        resolutionPaths.push({ label: 'Timeout Auto-Resolve', description: 'No response — system auto-accepts after timeout', probability: 0.7 });
      }

      const injectedPatterns = (scenario.config.scenarioIds || [])
        .map(sid => getResponsePattern(sid))
        .filter((p): p is NonNullable<typeof p> => p !== null);

      for (const pattern of injectedPatterns) {
        for (const resolution of pattern.typical_resolution) {
          const existing = resolutionPaths.find(r => r.label === resolution);
          if (!existing) {
            resolutionPaths.push({
              label: resolution,
              description: `Expected from ${pattern.scenario} pattern`,
              probability: archetype && pattern.likely_conflict_archetypes.includes(archetype.id) ? 0.6 : 0.3,
            });
          }
        }
      }

      addLog(scenarioId, 'info', scenario.config.parentA.phone, {
        action: 'simulate_pair',
        archetype: archetype?.id || null,
        decisionA: { decision: decisionA.decision, confidence: decisionA.confidence, reasoning: decisionA.reasoning },
        decisionB: { decision: decisionB.decision, confidence: decisionB.confidence, reasoning: decisionB.reasoning },
        resolutionPaths: resolutionPaths.length,
      });

      // Generate system responses locally
      const now = new Date().toISOString();
      scenario.messagesA.push({ id: crypto.randomUUID(), from: 'user', text: autoTextA, timestamp: now, phone: scenario.config.parentA.phone });
      scenario.messagesB.push({ id: crypto.randomUUID(), from: 'user', text: autoTextB, timestamp: now, phone: scenario.config.parentB.phone });

      const answeredA = buildAnsweredTopics(scenario.messagesA);
      const answeredB = buildAnsweredTopics(scenario.messagesB);
      const responseA = generateSystemResponse(scenario.config, answeredA);
      const responseB = generateSystemResponse(scenario.config, answeredB);

      scenario.messagesA.push({ id: crypto.randomUUID(), from: 'system', text: responseA, timestamp: now, phone: scenario.config.parentA.phone });
      scenario.messagesB.push({ id: crypto.randomUUID(), from: 'system', text: responseB, timestamp: now, phone: scenario.config.parentB.phone });

      if (scenario.status === 'draft') scenario.status = 'simulating';

      return NextResponse.json({
        responseA,
        responseB,
        autoMessageA: autoTextA,
        autoMessageB: autoTextB,
        decisionA: { decision: decisionA.decision, confidence: decisionA.confidence, reasoning: decisionA.reasoning },
        decisionB: { decision: decisionB.decision, confidence: decisionB.confidence, reasoning: decisionB.reasoning },
        resolutionPaths,
        messagesA: scenario.messagesA,
        messagesB: scenario.messagesB,
        logs: scenario.logs,
      });

    } else if (action === 'run_setup') {
      // Reactive onboarding: run both parents through the conversation.
      const pA = PARENT_PERSONAS.find(p => p.id === scenario.config.personaA);
      const pB = PARENT_PERSONAS.find(p => p.id === scenario.config.personaB);
      if (!pA) {
        return NextResponse.json({ error: 'Parent A must have a persona assigned' }, { status: 400 });
      }

      const MAX_TURNS = 15;
      const stepResults: Array<{ turn: number; topics: string; sent: string; response: string }> = [];
      const answeredTopics = new Set<string>();
      const now = () => new Date().toISOString();

      addLog(scenarioId, 'stage_change', scenario.config.parentA.phone, { action: 'run_setup_reactive' });

      // Step 0: Welcome message
      let lastSystemText = generateSyntheticSystemResponse(scenario.config, answeredTopics);

      scenario.messagesA.push({
        id: crypto.randomUUID(), from: 'system', text: lastSystemText,
        timestamp: now(), phone: scenario.config.parentA.phone,
      });
      addLog(scenarioId, 'info', scenario.config.parentA.phone, {
        action: 'setup_connect', response: lastSystemText.slice(0, 200),
      });

      // Reactive loop: classify system message -> generate answer -> get next system response
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        if (isOnboardingComplete(lastSystemText)) {
          addLog(scenarioId, 'stage_change', scenario.config.parentA.phone, {
            action: 'setup_complete', turns: turn, answeredTopics: [...answeredTopics],
          });
          break;
        }

        const { answer, topics } = generateCompoundAnswer(
          lastSystemText, pA, scenario.config, answeredTopics,
        );

        if (!answer || answer.trim().length === 0) break;
        for (const t of topics) answeredTopics.add(t);

        // Enrich with LLM router (fire and forget, non-blocking for simulation)
        void classifyIntent(answer, { turn, persona: pA.name }).then(intent => {
          if (intent) addLog(scenarioId, 'info', scenario.config.parentA.phone, {
            action: 'llm_classify', turn, intent: intent.intent, confidence: intent.confidence,
          });
        });

        // Generate next system response locally
        lastSystemText = generateSyntheticSystemResponse(scenario.config, answeredTopics);

        scenario.messagesA.push(
          { id: crypto.randomUUID(), from: 'user', text: answer, timestamp: now(), phone: scenario.config.parentA.phone },
          { id: crypto.randomUUID(), from: 'system', text: lastSystemText, timestamp: now(), phone: scenario.config.parentA.phone },
        );

        const topicStr = topics.join(',');
        stepResults.push({ turn, topics: topicStr, sent: answer, response: lastSystemText.slice(0, 300) });
        addLog(scenarioId, 'info', scenario.config.parentA.phone, {
          action: 'setup_step', turn, topics: topicStr, sent: answer, response: lastSystemText.slice(0, 200),
        });

        // Stuck detection
        if (stepResults.length >= 2) {
          const last2 = stepResults.slice(-2);
          if (last2[0].sent === last2[1].sent) {
            addLog(scenarioId, 'error', scenario.config.parentA.phone, {
              action: 'setup_loop_detected', repeatedAnswer: answer.slice(0, 100), turns: turn,
            });
            break;
          }
        }
      }

      // Parent B onboarding
      let parentBResponse = '';
      if (pB) {
        const bAnswered = new Set<string>();
        const MAX_B_TURNS = 10;

        let lastBSystem = `Hi! Your co-parent has set up a family schedule on ADCP. I just need to confirm a few things with you. How many children do you share custody of?`;

        scenario.messagesB.push({
          id: crypto.randomUUID(), from: 'system', text: lastBSystem,
          timestamp: now(), phone: scenario.config.parentB.phone,
        });
        parentBResponse = lastBSystem;

        const joinText = generateParentBJoinResponse(pB);
        bAnswered.add('greeting');
        lastBSystem = generateSyntheticSystemResponse(scenario.config, bAnswered);

        scenario.messagesB.push(
          { id: crypto.randomUUID(), from: 'user', text: joinText, timestamp: now(), phone: scenario.config.parentB.phone },
          { id: crypto.randomUUID(), from: 'system', text: lastBSystem, timestamp: now(), phone: scenario.config.parentB.phone },
        );

        for (let bTurn = 0; bTurn < MAX_B_TURNS; bTurn++) {
          if (isOnboardingComplete(lastBSystem)) {
            addLog(scenarioId, 'info', scenario.config.parentB.phone, {
              action: 'setup_parent_b_complete', turns: bTurn,
            });
            break;
          }

          const { answer: bAnswer, topics: bTopics } = generateCompoundAnswer(
            lastBSystem, pB, scenario.config, bAnswered,
          );

          if (!bAnswer || bAnswer.trim().length === 0) break;
          for (const t of bTopics) bAnswered.add(t);

          lastBSystem = generateSyntheticSystemResponse(scenario.config, bAnswered);

          scenario.messagesB.push(
            { id: crypto.randomUUID(), from: 'user', text: bAnswer, timestamp: now(), phone: scenario.config.parentB.phone },
            { id: crypto.randomUUID(), from: 'system', text: lastBSystem, timestamp: now(), phone: scenario.config.parentB.phone },
          );

          addLog(scenarioId, 'info', scenario.config.parentB.phone, {
            action: 'setup_parent_b_step', turn: bTurn, topics: bTopics.join(','),
            sent: bAnswer, response: lastBSystem.slice(0, 200),
          });

          // Stuck detection
          const bMsgs = scenario.messagesB.filter(m => m.from === 'user');
          if (bMsgs.length >= 2 && bMsgs[bMsgs.length - 1].text === bMsgs[bMsgs.length - 2].text) {
            addLog(scenarioId, 'error', scenario.config.parentB.phone, {
              action: 'setup_parent_b_loop', turn: bTurn,
            });
            break;
          }
        }

        addLog(scenarioId, 'info', scenario.config.parentB.phone, {
          action: 'setup_parent_b_done', answeredTopics: [...bAnswered],
        });
      }

      // Generate the schedule now that onboarding is complete
      scenario.schedule = generateSchedule(scenario.config);
      scenario.status = 'simulating';
      addLog(scenarioId, 'info', scenario.config.parentA.phone, {
        action: 'schedule_generated', days: scenario.schedule.length,
        template: scenario.config.template,
      });

      return NextResponse.json({
        setupSteps: stepResults,
        parentBResponse,
        messagesA: scenario.messagesA,
        messagesB: scenario.messagesB,
        schedule: scenario.schedule,
        logs: scenario.logs,
      });

    } else if (action === 'step_day') {
      const days = typeof body === 'number' ? body : body?.days || 1;
      const pA = PARENT_PERSONAS.find(p => p.id === scenario.config.personaA);
      const pB = PARENT_PERSONAS.find(p => p.id === scenario.config.personaB);
      if (!pA || !pB) {
        return NextResponse.json({ error: 'Both parents must have personas assigned' }, { status: 400 });
      }

      // Generate schedule if not already created
      if (scenario.schedule.length === 0) {
        scenario.schedule = generateSchedule(scenario.config);
      }

      const archetype = (scenario.config.personaA && scenario.config.personaB)
        ? getArchetype(scenario.config.personaA, scenario.config.personaB)
        : null;

      const dayResults: Array<{
        day: number;
        mode: 'silent' | 'operational' | 'disruption';
        systemMessageType?: string;
        decisionA?: { decision: string; confidence: number; reasoning: string };
        decisionB?: { decision: string; confidence: number; reasoning: string };
        messageA: string;
        messageB: string;
      }> = [];

      const now = () => new Date().toISOString();

      for (let d = 0; d < days; d++) {
        const simDay = scenario.currentDay;
        scenario.currentDay++;
        const ts = now();

        // ── Normal day: operational message protocol ──
        // Disruptions are only injected manually via inject_disruption action.
        // Default state: silent unless useful
        const opMsgA = getOperationalMessage(scenario.config, scenario.schedule, simDay, 'parent_a');
        const opMsgB = getOperationalMessage(scenario.config, scenario.schedule, simDay, 'parent_b');

        // Check for alerts
        const fairnessAlert = (simDay % 7 === 0) ? checkFairnessAlert(scenario.config, scenario.schedule, simDay) : null;
        const frictionAlert = (simDay % 7 === 0) ? checkFrictionAhead(scenario.config, scenario.schedule, simDay) : null;

        const isSilent = opMsgA.type === 'SILENT' && !fairnessAlert && !frictionAlert;

        if (isSilent) {
          // Brief operational status — operations-planner tone
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

          addLog(scenarioId, 'info', scenario.config.parentA.phone, {
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

          addLog(scenarioId, 'info', scenario.config.parentA.phone, {
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

      return NextResponse.json({
        days: dayResults,
        totalDaysRun: days,
        messagesA: scenario.messagesA,
        messagesB: scenario.messagesB,
        schedule: scenario.schedule,
        logs: scenario.logs,
      });

    } else if (action === 'inject_disruption') {
      // ── Mediation-Based Disruption Flow ──
      // Disruption originates from one parent (the phone making the request).
      // Different messages sent to each parent. No broadcast.
      // Flow: report → duration → coverage request → proposals → decision → resolution

      const scenarioDefId = body;
      const scenarioDef = SCENARIO_CATALOG.find(s => s.id === scenarioDefId);
      if (!scenarioDef) {
        return NextResponse.json({ error: 'Scenario not found in catalog' }, { status: 400 });
      }

      if (scenario.schedule.length === 0) {
        scenario.schedule = generateSchedule(scenario.config);
      }

      const ts = new Date().toISOString();
      const isParentA = phone === scenario.config.parentA.phone;
      const reportingParent: 'parent_a' | 'parent_b' = isParentA ? 'parent_a' : 'parent_b';
      const today = scenario.schedule[scenario.currentDay]?.date || new Date().toISOString().split('T')[0];

      // Classify disruption type from catalog
      const eventType = classifyDisruptionType(scenarioDef.description);

      // Idempotency check
      if (isDuplicateDisruption(scenario.activeDisruptions, reportingParent, eventType, today)) {
        return NextResponse.json({
          error: 'Disruption already active for this parent and event type',
          messagesA: scenario.messagesA,
          messagesB: scenario.messagesB,
        }, { status: 409 });
      }

      // Create disruption
      const disruption = createDisruption(reportingParent, eventType, today);

      addLog(scenarioId, 'disruption', phone, {
        action: 'disruption_reported',
        disruptionId: disruption.id,
        eventType,
        reportingParent,
        scenarioDef: scenarioDef.id,
        name: scenarioDef.name,
        difficulty: scenarioDef.difficulty,
      });

      // Step 1: Reporter gets confirmation + options
      const reporterMsg = disruptionReportConfirmation(
        disruption, scenario.config, scenario.schedule, scenario.currentDay,
      );
      const reporterMessages = isParentA ? scenario.messagesA : scenario.messagesB;
      reporterMessages.push({
        id: crypto.randomUUID(), from: 'system', text: reporterMsg.text,
        timestamp: ts, phone,
      });

      // Step 2: Auto-simulate reporter choosing "request coverage"
      // (In a real system this would wait for user input)
      const pReporter = PARENT_PERSONAS.find(p =>
        p.id === (isParentA ? scenario.config.personaA : scenario.config.personaB)
      );

      // Reporter says they need help
      const reportText = generatePersonaMessage(
        pReporter || PARENT_PERSONAS[0],
        'disruption_report',
        { eventType: scenarioDef.name },
      );
      reporterMessages.push({
        id: crypto.randomUUID(), from: 'user', text: reportText,
        timestamp: ts, phone,
      });

      // Step 3: Ask duration
      const durationMsg = durationQuestion(disruption);
      reporterMessages.push({
        id: crypto.randomUUID(), from: 'system', text: durationMsg.text,
        timestamp: ts, phone,
      });

      // Auto-simulate duration answer based on scenario difficulty
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

      // Update disruption with duration
      const withDuration = setDuration(disruption, durationChoice, scenario.schedule, scenario.currentDay);

      // Step 4: Coverage request to OTHER parent
      const coverageMsg = coverageRequest(withDuration, scenario.config);
      const otherMessages = isParentA ? scenario.messagesB : scenario.messagesA;
      const otherPhone = isParentA ? scenario.config.parentB.phone : scenario.config.parentA.phone;
      otherMessages.push({
        id: crypto.randomUUID(), from: 'system', text: coverageMsg.text,
        timestamp: ts, phone: otherPhone,
      });

      // Step 5: Generate proposal bundle
      const bundle = generateProposalBundle(
        scenario.config, scenario.schedule, withDuration, scenario.currentDay,
      );
      const withProposals = attachProposals(withDuration, bundle);

      // Send proposals to other parent
      const bundleMsg = proposalBundleMessage(withProposals, bundle, scenario.config);
      otherMessages.push({
        id: crypto.randomUUID(), from: 'system', text: bundleMsg.text,
        timestamp: ts, phone: otherPhone,
      });

      // Step 6: Other parent's persona reacts
      const pOther = PARENT_PERSONAS.find(p =>
        p.id === (isParentA ? scenario.config.personaB : scenario.config.personaA)
      );
      const otherDecision = pOther
        ? evaluateDisruption(pOther, scenarioDef.events[0] || { type: eventType, day: scenario.currentDay, description: scenarioDef.description }, scenario.currentDay)
        : { decision: 'accept', confidence: 0.5 };

      let resolved: ActiveDisruption;

      if (otherDecision.decision === 'accept' && bundle.options.length > 0) {
        // Accept first option
        const selected = bundle.options[0];
        resolved = selectProposal(withProposals, selected.id);

        otherMessages.push({
          id: crypto.randomUUID(), from: 'user', text: `Option 1: ${selected.label}`,
          timestamp: ts, phone: otherPhone,
        });

        // Send resolution to both parents
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

        addLog(scenarioId, 'info', phone, {
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

        addLog(scenarioId, 'info', phone, {
          action: 'proposals_declined', disruptionId: resolved.id,
        });
      } else {
        // Counter or partial — pick partial option if available
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

        addLog(scenarioId, 'info', phone, {
          action: 'proposal_counter',
          disruptionId: resolved.id,
          selectedOption: chosen?.id || null,
        });
      }

      // Mark for follow-up if multi-day
      if (durationChoice !== 'today_only') {
        resolved = markFollowupPending(resolved);
      } else {
        resolved = resolveDisruption(resolved);
      }

      scenario.activeDisruptions.push(resolved);

      return NextResponse.json({
        messagesA: scenario.messagesA,
        messagesB: scenario.messagesB,
        schedule: scenario.schedule,
        logs: scenario.logs,
        activeDisruption: resolved,
      });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Append messages to scenario (for connect/send actions)
    const isParentA = phone === scenario.config.parentA.phone;
    const messages = isParentA ? scenario.messagesA : scenario.messagesB;

    if (action === 'send') {
      messages.push({
        id: crypto.randomUUID(),
        from: 'user',
        text: body,
        timestamp: new Date().toISOString(),
        phone,
      });
    }

    messages.push({
      id: crypto.randomUUID(),
      from: 'system',
      text: responseText,
      timestamp: new Date().toISOString(),
      phone,
    });

    if (scenario.status === 'draft') {
      scenario.status = 'simulating';
    }

    return NextResponse.json({
      response: responseText,
      messagesA: scenario.messagesA,
      messagesB: scenario.messagesB,
      logs: scenario.logs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    addLog(scenarioId, 'error', phone, { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
