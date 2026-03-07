import { NextRequest, NextResponse } from 'next/server';
import { getScenario, addLog } from '@/lib/store';
import { PARENT_PERSONAS } from '@/lib/personas';
import { SCENARIO_CATALOG } from '@/lib/scenarios';
import {
  evaluateProposal,
  evaluateDisruption,
  generatePersonaMessage,
  DecisionResult,
} from '@/lib/behavior-engine';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

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
      const res = await fetch(`${API_BASE}/messaging/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      responseText = data.message;
      addLog(scenarioId, 'info', phone, { action: 'connected', response: responseText.slice(0, 200) });

    } else if (action === 'send') {
      addLog(scenarioId, 'api_call', phone, { action: 'send', body });
      const res = await fetch(`${API_BASE}/messaging/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: phone, Body: body }),
      });
      const text = await res.text();
      const match = text.match(/<Message>([\s\S]*?)<\/Message>/);
      responseText = match ? match[1] : text;
      addLog(scenarioId, 'info', phone, { action: 'message', body, response: responseText.slice(0, 200) });

    } else if (action === 'auto_respond') {
      // Behavior engine auto-response based on persona
      const isParentA = phone === scenario.config.parentA.phone;
      const personaId = isParentA ? scenario.config.personaA : scenario.config.personaB;
      const persona = PARENT_PERSONAS.find(p => p.id === personaId);

      if (!persona) {
        return NextResponse.json({ error: 'No persona assigned to this parent' }, { status: 400 });
      }

      // Determine context from last system message
      const messages = isParentA ? scenario.messagesA : scenario.messagesB;
      const lastSystem = [...messages].reverse().find(m => m.from === 'system');
      const context = lastSystem?.text.toLowerCase() || '';

      let autoText: string;
      let decision: DecisionResult | null = null;

      const isProposal = context.includes('proposal') || context.includes('schedule') || context.includes('approve');
      const isDisruption = context.includes('sick') || context.includes('emergency') || context.includes('cancel');

      if (isProposal) {
        decision = evaluateProposal(persona, 5, false, false, messages.length);
        addLog(scenarioId, 'info', phone, {
          action: 'behavior_engine',
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

      // Send the auto-generated message through the real API
      addLog(scenarioId, 'api_call', phone, { action: 'auto_send', body: autoText, persona: persona.name });
      const res = await fetch(`${API_BASE}/messaging/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: phone, Body: autoText }),
      });
      const text = await res.text();
      const match = text.match(/<Message>([\s\S]*?)<\/Message>/);
      responseText = match ? match[1] : text;

      // Record the persona's outbound message
      messages.push({
        id: crypto.randomUUID(),
        from: 'user',
        text: autoText,
        timestamp: new Date().toISOString(),
        phone,
      });
      messages.push({
        id: crypto.randomUUID(),
        from: 'system',
        text: responseText,
        timestamp: new Date().toISOString(),
        phone,
      });

      if (scenario.status === 'draft') scenario.status = 'simulating';

      return NextResponse.json({
        response: responseText,
        autoMessage: autoText,
        decision: decision ? { decision: decision.decision, confidence: decision.confidence, reasoning: decision.reasoning } : null,
        messagesA: scenario.messagesA,
        messagesB: scenario.messagesB,
        logs: scenario.logs,
      });

    } else if (action === 'inject_disruption') {
      // Inject a scenario catalog disruption event
      const scenarioDefId = body; // body carries the scenario catalog ID
      const scenarioDef = SCENARIO_CATALOG.find(s => s.id === scenarioDefId);
      if (!scenarioDef) {
        return NextResponse.json({ error: 'Scenario not found in catalog' }, { status: 400 });
      }

      addLog(scenarioId, 'disruption', phone, {
        action: 'inject_disruption',
        scenarioDef: scenarioDef.id,
        name: scenarioDef.name,
        events: scenarioDef.events,
      });

      // Generate disruption notification text
      responseText = `[DISRUPTION] ${scenarioDef.name}: ${scenarioDef.description}`;
      const isParentA = phone === scenario.config.parentA.phone;
      const messages = isParentA ? scenario.messagesA : scenario.messagesB;
      messages.push({
        id: crypto.randomUUID(),
        from: 'system',
        text: responseText,
        timestamp: new Date().toISOString(),
        phone,
      });

      return NextResponse.json({
        response: responseText,
        messagesA: scenario.messagesA,
        messagesB: scenario.messagesB,
        logs: scenario.logs,
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
