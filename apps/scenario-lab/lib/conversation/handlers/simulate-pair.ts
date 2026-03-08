// ── Simulate Pair Handler ────────────────────────────────────
// Both parents respond simultaneously with persona-driven behavior.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import { PARENT_PERSONAS } from '../../personas';
import {
  evaluateProposalWithArchetype,
  evaluateDisruption,
  generatePersonaMessage,
  generateReactiveAnswer,
  getArchetype,
  getResponsePattern,
  classifySystemMessage,
  generateSyntheticSystemResponse,
  DecisionResult,
} from '../../behavior-engine';
import { buildAnsweredTopics } from '../state';

export interface SimulatePairResult {
  responseA: string;
  responseB: string;
  autoMessageA: string;
  autoMessageB: string;
  decisionA: { decision: string; confidence: number; reasoning: string };
  decisionB: { decision: string; confidence: number; reasoning: string };
  resolutionPaths: Array<{ label: string; description: string; probability: number }>;
  messagesA: Scenario['messagesA'];
  messagesB: Scenario['messagesB'];
  logs: Scenario['logs'];
}

export function handleSimulatePair(
  scenario: Scenario,
): SimulatePairResult {
  const personaAId = scenario.config.personaA;
  const personaBId = scenario.config.personaB;
  const pA = PARENT_PERSONAS.find(p => p.id === personaAId);
  const pB = PARENT_PERSONAS.find(p => p.id === personaBId);

  if (!pA || !pB) {
    throw new Error('Both parents must have personas assigned');
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

  // Decision engine
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

  // Generate auto-text
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
  const resolutionPaths = buildResolutionPaths(decisionA, decisionB, scenario, archetype);

  addLog(scenario.id, 'info', scenario.config.parentA.phone, {
    action: 'simulate_pair',
    archetype: archetype?.id || null,
    decisionA: { decision: decisionA.decision, confidence: decisionA.confidence, reasoning: decisionA.reasoning },
    decisionB: { decision: decisionB.decision, confidence: decisionB.confidence, reasoning: decisionB.reasoning },
    resolutionPaths: resolutionPaths.length,
  });

  // Generate system responses
  const now = new Date().toISOString();
  scenario.messagesA.push({ id: crypto.randomUUID(), from: 'user', text: autoTextA, timestamp: now, phone: scenario.config.parentA.phone });
  scenario.messagesB.push({ id: crypto.randomUUID(), from: 'user', text: autoTextB, timestamp: now, phone: scenario.config.parentB.phone });

  const answeredA = buildAnsweredTopics(scenario.messagesA);
  const answeredB = buildAnsweredTopics(scenario.messagesB);
  const responseA = generateSyntheticSystemResponse(scenario.config, answeredA);
  const responseB = generateSyntheticSystemResponse(scenario.config, answeredB);

  scenario.messagesA.push({ id: crypto.randomUUID(), from: 'system', text: responseA, timestamp: now, phone: scenario.config.parentA.phone });
  scenario.messagesB.push({ id: crypto.randomUUID(), from: 'system', text: responseB, timestamp: now, phone: scenario.config.parentB.phone });

  if (scenario.status === 'draft') scenario.status = 'simulating';

  return {
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
  };
}

function buildResolutionPaths(
  decisionA: DecisionResult,
  decisionB: DecisionResult,
  scenario: Scenario,
  archetype: ReturnType<typeof getArchetype>,
): Array<{ label: string; description: string; probability: number }> {
  const paths: Array<{ label: string; description: string; probability: number }> = [];

  if (decisionA.decision === 'accept' && decisionB.decision === 'accept') {
    paths.push({ label: 'Mutual Agreement', description: 'Both parents accept — no conflict', probability: 0.9 });
  } else if (decisionA.decision === 'accept' || decisionB.decision === 'accept') {
    paths.push({ label: 'One-Sided Accept', description: 'One accepts, other resists — negotiation needed', probability: 0.5 });
    paths.push({ label: 'Escalation', description: 'Resistance may escalate to counter-proposal chain', probability: 0.3 });
  }
  if (decisionA.decision === 'counter' || decisionB.decision === 'counter') {
    paths.push({ label: 'Counter-Proposal', description: 'Counter offered — may converge or deadlock', probability: 0.4 });
    paths.push({ label: 'Mediation Trigger', description: 'Repeated counters may trigger mediation', probability: 0.2 });
  }
  if (decisionA.decision === 'reject' || decisionB.decision === 'reject') {
    paths.push({ label: 'Deadlock', description: 'Rejection may lead to deadlock — system auto-resolves', probability: 0.3 });
    paths.push({ label: 'Escalation to Default', description: 'System falls back to base schedule', probability: 0.4 });
  }
  if (decisionA.decision === 'ignore' || decisionB.decision === 'ignore') {
    paths.push({ label: 'Timeout Auto-Resolve', description: 'No response — system auto-accepts after timeout', probability: 0.7 });
  }

  // Inject scenario-specific patterns
  const injectedPatterns = (scenario.config.scenarioIds || [])
    .map(sid => getResponsePattern(sid))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  for (const pattern of injectedPatterns) {
    for (const resolution of pattern.typical_resolution) {
      const existing = paths.find(r => r.label === resolution);
      if (!existing) {
        paths.push({
          label: resolution,
          description: `Expected from ${pattern.scenario} pattern`,
          probability: archetype && pattern.likely_conflict_archetypes.includes(archetype.id) ? 0.6 : 0.3,
        });
      }
    }
  }

  return paths;
}
