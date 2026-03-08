// ── Run Setup Handler ────────────────────────────────────────
// Runs both parents through the full onboarding conversation.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import { PARENT_PERSONAS } from '../../personas';
import {
  generateCompoundAnswer,
  generateParentBJoinResponse,
  generateSyntheticSystemResponse,
  isOnboardingComplete,
} from '../../behavior-engine';
import { generateSchedule } from '../../schedule-generator';
import { classifyIntent } from '../../llm/client';

export interface RunSetupResult {
  setupSteps: Array<{ turn: number; topics: string; sent: string; response: string }>;
  parentBResponse: string;
  messagesA: Scenario['messagesA'];
  messagesB: Scenario['messagesB'];
  schedule: Scenario['schedule'];
  logs: Scenario['logs'];
}

export async function handleRunSetup(scenario: Scenario): Promise<RunSetupResult> {
  const pA = PARENT_PERSONAS.find(p => p.id === scenario.config.personaA);
  const pB = PARENT_PERSONAS.find(p => p.id === scenario.config.personaB);

  if (!pA) {
    throw new Error('Parent A must have a persona assigned');
  }

  const MAX_TURNS = 15;
  const stepResults: Array<{ turn: number; topics: string; sent: string; response: string }> = [];
  const answeredTopics = new Set<string>();
  const now = () => new Date().toISOString();

  addLog(scenario.id, 'stage_change', scenario.config.parentA.phone, { action: 'run_setup_reactive' });

  // Step 0: Welcome message
  let lastSystemText = generateSyntheticSystemResponse(scenario.config, answeredTopics);
  scenario.messagesA.push({
    id: crypto.randomUUID(), from: 'system', text: lastSystemText,
    timestamp: now(), phone: scenario.config.parentA.phone,
  });
  addLog(scenario.id, 'info', scenario.config.parentA.phone, {
    action: 'setup_connect', response: lastSystemText.slice(0, 200),
  });

  // Reactive loop
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (isOnboardingComplete(lastSystemText)) {
      addLog(scenario.id, 'stage_change', scenario.config.parentA.phone, {
        action: 'setup_complete', turns: turn, answeredTopics: [...answeredTopics],
      });
      break;
    }

    const { answer, topics } = generateCompoundAnswer(
      lastSystemText, pA, scenario.config, answeredTopics,
    );

    if (!answer || answer.trim().length === 0) break;
    for (const t of topics) answeredTopics.add(t);

    // LLM enrichment (fire and forget)
    void classifyIntent(answer, { turn, persona: pA.name }).then(intent => {
      if (intent) addLog(scenario.id, 'info', scenario.config.parentA.phone, {
        action: 'llm_classify', turn, intent: intent.intent, confidence: intent.confidence,
      });
    });

    lastSystemText = generateSyntheticSystemResponse(scenario.config, answeredTopics);
    scenario.messagesA.push(
      { id: crypto.randomUUID(), from: 'user', text: answer, timestamp: now(), phone: scenario.config.parentA.phone },
      { id: crypto.randomUUID(), from: 'system', text: lastSystemText, timestamp: now(), phone: scenario.config.parentA.phone },
    );

    const topicStr = topics.join(',');
    stepResults.push({ turn, topics: topicStr, sent: answer, response: lastSystemText.slice(0, 300) });
    addLog(scenario.id, 'info', scenario.config.parentA.phone, {
      action: 'setup_step', turn, topics: topicStr, sent: answer, response: lastSystemText.slice(0, 200),
    });

    // Stuck detection
    if (stepResults.length >= 2) {
      const last2 = stepResults.slice(-2);
      if (last2[0].sent === last2[1].sent) {
        addLog(scenario.id, 'error', scenario.config.parentA.phone, {
          action: 'setup_loop_detected', repeatedAnswer: answer.slice(0, 100), turns: turn,
        });
        break;
      }
    }
  }

  // Parent B onboarding
  let parentBResponse = '';
  if (pB) {
    parentBResponse = runParentBOnboarding(scenario, pB, now);
  }

  // Generate schedule
  scenario.schedule = generateSchedule(scenario.config);
  scenario.status = 'simulating';
  addLog(scenario.id, 'info', scenario.config.parentA.phone, {
    action: 'schedule_generated', days: scenario.schedule.length,
    template: scenario.config.template,
  });

  return {
    setupSteps: stepResults,
    parentBResponse,
    messagesA: scenario.messagesA,
    messagesB: scenario.messagesB,
    schedule: scenario.schedule,
    logs: scenario.logs,
  };
}

function runParentBOnboarding(
  scenario: Scenario,
  pB: (typeof PARENT_PERSONAS)[number],
  now: () => string,
): string {
  const bAnswered = new Set<string>();
  const MAX_B_TURNS = 10;

  let lastBSystem = `Hi! Your co-parent has set up a family schedule on ADCP. I just need to confirm a few things with you. How many children do you share custody of?`;
  scenario.messagesB.push({
    id: crypto.randomUUID(), from: 'system', text: lastBSystem,
    timestamp: now(), phone: scenario.config.parentB.phone,
  });
  const parentBResponse = lastBSystem;

  const joinText = generateParentBJoinResponse(pB);
  bAnswered.add('greeting');
  lastBSystem = generateSyntheticSystemResponse(scenario.config, bAnswered);

  scenario.messagesB.push(
    { id: crypto.randomUUID(), from: 'user', text: joinText, timestamp: now(), phone: scenario.config.parentB.phone },
    { id: crypto.randomUUID(), from: 'system', text: lastBSystem, timestamp: now(), phone: scenario.config.parentB.phone },
  );

  for (let bTurn = 0; bTurn < MAX_B_TURNS; bTurn++) {
    if (isOnboardingComplete(lastBSystem)) {
      addLog(scenario.id, 'info', scenario.config.parentB.phone, {
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

    addLog(scenario.id, 'info', scenario.config.parentB.phone, {
      action: 'setup_parent_b_step', turn: bTurn, topics: bTopics.join(','),
      sent: bAnswer, response: lastBSystem.slice(0, 200),
    });

    // Stuck detection
    const bMsgs = scenario.messagesB.filter(m => m.from === 'user');
    if (bMsgs.length >= 2 && bMsgs[bMsgs.length - 1].text === bMsgs[bMsgs.length - 2].text) {
      addLog(scenario.id, 'error', scenario.config.parentB.phone, {
        action: 'setup_parent_b_loop', turn: bTurn,
      });
      break;
    }
  }

  addLog(scenario.id, 'info', scenario.config.parentB.phone, {
    action: 'setup_parent_b_done', answeredTopics: [...bAnswered],
  });

  return parentBResponse;
}
