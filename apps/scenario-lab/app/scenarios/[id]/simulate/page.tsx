'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Scenario, Message, SimulationLog, ScheduleDay } from '@/lib/types';
import { PhoneSimulator } from '@/components/PhoneSimulator';
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
import { ScheduleCalendar } from '@/components/ScheduleCalendar';
import { PARENT_PERSONAS, ParentPersona, INTERACTION_ARCHETYPES } from '@/lib/personas';
import { SCENARIO_CATALOG, SCENARIO_CATEGORIES, DIFFICULTY_LABELS, DifficultyLevel, DISRUPTION_RESPONSE_PATTERNS } from '@/lib/scenarios';

type Tab = 'phones' | 'calendar' | 'diagnostics';

// ── Persona Badge ──

function PersonaBadge({ persona }: { persona: ParentPersona }) {
  const b = persona.behavior;
  const barColor = (val: number) => {
    if (val <= 2) return 'bg-green-400';
    if (val <= 3) return 'bg-amber-400';
    return 'bg-red-400';
  };
  return (
    <div className="mt-1.5 space-y-1">
      <div className="text-[10px] text-lab-400">{persona.description}</div>
      {([
        ['Conflict', b.conflict_level],
        ['Fairness', b.fairness_sensitivity],
        ['Rigidity', b.schedule_rigidity],
        ['Logistics', b.logistics_tolerance],
      ] as const).map(([label, val]) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="w-12 text-[10px] text-lab-400">{label}</span>
          <div className="flex-1 bg-lab-200 rounded-full h-1">
            <div className={`h-1 rounded-full ${barColor(val)}`}
              style={{ width: `${(val / 5) * 100}%` }} />
          </div>
          <span className="w-3 text-[10px] text-right text-lab-400">{val}</span>
        </div>
      ))}
      <div className="flex gap-2 text-[10px] text-lab-400">
        <span>Spd: {b.response_speed}</span>
        <span>Game: {(b.gaming_probability * 100).toFixed(0)}%</span>
        <span>Accept: {(b.proposal_acceptance_bias * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ── Collapsible Section ──

function Section({ title, defaultOpen = true, count, children }: {
  title: string; defaultOpen?: boolean; count?: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-lab-100 last:border-b-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-lab-600 hover:bg-lab-50">
        <span>{title}{count !== undefined ? ` (${count})` : ''}</span>
        <span className="text-lab-300">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ── Main Page ──

export default function SimulatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [messagesA, setMessagesA] = useState<Message[]>([]);
  const [messagesB, setMessagesB] = useState<Message[]>([]);
  const [logs, setLogs] = useState<SimulationLog[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [connectedA, setConnectedA] = useState(false);
  const [connectedB, setConnectedB] = useState(false);
  const [sendingA, setSendingA] = useState(false);
  const [sendingB, setSendingB] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('phones');
  const [exporting, setExporting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [pairResult, setPairResult] = useState<{
    decisionA: { decision: string; confidence: number; reasoning: string };
    decisionB: { decision: string; confidence: number; reasoning: string };
    resolutionPaths: Array<{ label: string; description: string; probability: number }>;
    autoMessageA: string;
    autoMessageB: string;
  } | null>(null);
  const [showResolutions, setShowResolutions] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [syntheticMode, setSyntheticMode] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [stepProgress, setStepProgress] = useState<{ current: number; total: number } | null>(null);
  const [dayResults, setDayResults] = useState<Array<{
    day: number;
    mode: 'silent' | 'operational' | 'disruption';
    systemMessageType?: string;
    decisionA?: { decision: string; confidence: number; reasoning: string };
    decisionB?: { decision: string; confidence: number; reasoning: string };
    messageA: string;
    messageB: string;
  }>>([]);

  useEffect(() => {
    fetch(`/api/scenarios/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Scenario not found');
        return r.json();
      })
      .then(s => {
        if (!s.config) throw new Error('Invalid scenario data');
        setScenario(s);
        setMessagesA(s.messagesA || []);
        setMessagesB(s.messagesB || []);
        setLogs(s.logs || []);
        setSchedule(s.schedule || []);
        if (s.messagesA?.length > 0) setConnectedA(true);
        if (s.messagesB?.length > 0) setConnectedB(true);
      })
      .catch(() => setScenario(null));
  }, [id]);

  // Update persona on the server + local state
  const updatePersona = useCallback(async (side: 'A' | 'B', personaId: string | undefined) => {
    if (!scenario) return;
    const key = side === 'A' ? 'personaA' : 'personaB';
    const updated = { ...scenario, config: { ...scenario.config, [key]: personaId } };
    setScenario(updated);
    await fetch(`/api/scenarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: updated.config }),
    });
  }, [id, scenario]);

  const simulate = useCallback(async (
    phone: string, action: 'connect' | 'send', body?: string,
  ) => {
    const isA = phone === scenario?.config.parentA.phone;
    const setSending = isA ? setSendingA : setSendingB;
    setSending(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id, phone, action, body }),
      });
      const data = await res.json();
      if (data.messagesA) setMessagesA(data.messagesA);
      if (data.messagesB) setMessagesB(data.messagesB);
      if (data.logs) setLogs(data.logs);
      if (data.schedule) setSchedule(data.schedule);
      if (isA) setConnectedA(true);
      else setConnectedB(true);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSending(false);
    }
  }, [id, scenario]);

  const autoRespond = useCallback(async (phone: string) => {
    const isA = phone === scenario?.config.parentA.phone;
    const setSending = isA ? setSendingA : setSendingB;
    setSending(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id, phone, action: 'auto_respond' }),
      });
      const data = await res.json();
      if (data.messagesA) setMessagesA(data.messagesA);
      if (data.messagesB) setMessagesB(data.messagesB);
      if (data.logs) setLogs(data.logs);
      if (data.schedule) setSchedule(data.schedule);
    } catch (err) {
      console.error('Auto-respond error:', err);
    } finally {
      setSending(false);
    }
  }, [id, scenario]);

  const simulatePair = useCallback(async () => {
    if (!scenario) return;
    setSimulating(true);
    setPairResult(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id, phone: scenario.config.parentA.phone, action: 'simulate_pair' }),
      });
      const data = await res.json();
      if (data.messagesA) setMessagesA(data.messagesA);
      if (data.messagesB) setMessagesB(data.messagesB);
      if (data.logs) setLogs(data.logs);
      if (data.schedule) setSchedule(data.schedule);
      setConnectedA(true);
      setConnectedB(true);
      setPairResult({
        decisionA: data.decisionA,
        decisionB: data.decisionB,
        resolutionPaths: data.resolutionPaths || [],
        autoMessageA: data.autoMessageA,
        autoMessageB: data.autoMessageB,
      });
    } catch (err) {
      console.error('Simulate pair error:', err);
    } finally {
      setSimulating(false);
    }
  }, [id, scenario]);

  const runSetup = useCallback(async () => {
    if (!scenario) return;
    setSettingUp(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id, phone: scenario.config.parentA.phone, action: 'run_setup' }),
      });
      const data = await res.json();
      if (data.messagesA) setMessagesA(data.messagesA);
      if (data.messagesB) setMessagesB(data.messagesB);
      if (data.logs) setLogs(data.logs);
      if (data.schedule) setSchedule(data.schedule);
      setConnectedA(true);
      if (data.parentBResponse) setConnectedB(true);
      if (data.synthetic) setSyntheticMode(true);
      setSetupDone(true);
    } catch (err) {
      console.error('Setup error:', err);
    } finally {
      setSettingUp(false);
    }
  }, [id, scenario]);

  const stepDays = useCallback(async (days: number) => {
    if (!scenario) return;
    setStepping(true);
    setStepProgress({ current: 0, total: days });
    setDayResults([]);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id, phone: scenario.config.parentA.phone, action: 'step_day', body: { days } }),
      });
      const data = await res.json();
      if (data.messagesA) setMessagesA(data.messagesA);
      if (data.messagesB) setMessagesB(data.messagesB);
      if (data.logs) setLogs(data.logs);
      if (data.schedule) setSchedule(data.schedule);
      setConnectedA(true);
      setConnectedB(true);
      if (data.days) {
        setDayResults(data.days);
        setStepProgress({ current: data.totalDaysRun, total: days });
      }
    } catch (err) {
      console.error('Step error:', err);
    } finally {
      setStepping(false);
    }
  }, [id, scenario]);

  const injectDisruption = useCallback(async (phone: string, scenarioDefId: string) => {
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id, phone, action: 'inject_disruption', body: scenarioDefId }),
      });
      const data = await res.json();
      if (data.messagesA) setMessagesA(data.messagesA);
      if (data.messagesB) setMessagesB(data.messagesB);
      if (data.logs) setLogs(data.logs);
      if (data.schedule) setSchedule(data.schedule);
    } catch (err) {
      console.error('Inject disruption error:', err);
    }
  }, [id]);

  async function handleExportPdf() {
    setExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scenario-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function getQuickActions(messages: Message[], isParentB: boolean): string[] {
    if (messages.length === 0) return [];
    const lastSystem = [...messages].reverse().find(m => m.from === 'system');
    if (!lastSystem) return [];
    const text = lastSystem.text.toLowerCase();

    if (isParentB) {
      if (text.includes('start') || text.includes('invited')) return ['START'];
      if (text.includes('approve') || text.includes('confirm')) return ['Yes', 'No'];
      return ['Looks good', 'I have a question'];
    }
    if (text.includes('how many') || text.includes('children') || text.includes('kids'))
      return ['1 kid, age 5', '2 kids, ages 4 and 7', '3 kids, ages 3, 6, and 10'];
    if (text.includes('custody') || text.includes('arrangement') || text.includes('schedule work'))
      return ['We alternate weeks', 'I have weekdays, dad gets weekends', '2-2-3 schedule'];
    if (text.includes('which days') || text.includes('always with you') || text.includes('locked'))
      return ['Mon-Wed are always mine', 'No fixed days', 'Tue and Thu are always mine'];
    if (text.includes('weekend'))
      return ['We alternate weekends', 'I always have weekends', 'We split Sat/Sun'];
    if (text.includes('split') || text.includes('50/50') || text.includes('time'))
      return ['50/50', '60/40', '70/30'];
    if (text.includes('exchange') || text.includes('handoff') || text.includes('drop'))
      return ['School drop-off', 'Curbside pickup', 'I pick them up in the evening'];
    if (text.includes('distance') || text.includes('how far') || text.includes('miles'))
      return ['About 10 miles', '25 miles', '5 minutes away'];
    if (text.includes('phone') || text.includes('co-parent') || text.includes('number'))
      return [scenario?.config.parentB.phone || '+15550000002', "I'll add it later"];
    if (text.includes('frustrat') || text.includes('change') || text.includes('better'))
      return ['Too many handoffs', 'Not enough time with kids', 'Too much driving'];
    if (text.includes('confirm') || text.includes('look right') || text.includes('good'))
      return ['Yes, looks good!', 'Can we adjust something?'];
    return [];
  }

  if (!scenario) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-lab-400 mb-3">Scenario not found — it may have been lost on server restart.</p>
        <Link href="/scenarios/new" className="text-sm text-lab-600 hover:text-lab-800 underline">
          Create a new scenario
        </Link>
      </div>
    );
  }

  const personaA = PARENT_PERSONAS.find(p => p.id === scenario.config.personaA);
  const personaB = PARENT_PERSONAS.find(p => p.id === scenario.config.personaB);
  const archetype = (scenario.config.personaA && scenario.config.personaB)
    ? INTERACTION_ARCHETYPES.find(a =>
        (a.parent_a === scenario.config.personaA && a.parent_b === scenario.config.personaB) ||
        (a.parent_a === scenario.config.personaB && a.parent_b === scenario.config.personaA)
      )
    : null;

  const filteredScenarios = categoryFilter
    ? SCENARIO_CATALOG.filter(s => s.category === categoryFilter)
    : SCENARIO_CATALOG;

  const difficultyColor = (d: DifficultyLevel) => {
    if (d <= 2) return 'bg-green-100 text-green-700';
    if (d <= 3) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const tabClass = (t: Tab) =>
    `px-3 py-1.5 text-xs ${activeTab === t ? 'border-b-2 border-lab-700 text-lab-700 font-medium' : 'text-lab-400 hover:text-lab-600'}`;

  const selectClass = 'w-full px-2 py-1.5 border border-lab-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-lab-400 bg-white';

  return (
    <div className="flex gap-0 h-[calc(100vh-72px)]">
      {/* ── Left Sidebar: Scenario Config ── */}
      <div className="w-72 flex-shrink-0 border-r border-lab-200 bg-white overflow-y-auto">
        {/* Scenario Header */}
        <div className="px-3 py-3 border-b border-lab-200">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-lab-400 hover:text-lab-600 text-xs">&larr;</Link>
            <h1 className="text-sm font-semibold text-lab-800 truncate">{scenario.config.name}</h1>
          </div>
          <p className="text-[10px] text-lab-400 mt-1 line-clamp-2">{scenario.config.description}</p>
          <div className="flex gap-1.5 mt-2">
            <span className="px-1.5 py-0.5 text-[10px] bg-lab-100 text-lab-500 rounded">
              {scenario.config.template}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] bg-lab-100 text-lab-500 rounded">
              {scenario.config.targetSplit}/{100 - scenario.config.targetSplit}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] bg-lab-100 text-lab-500 rounded">
              {scenario.config.children.length} child{scenario.config.children.length > 1 ? 'ren' : ''}
            </span>
          </div>
          {archetype && (
            <div className="mt-2 p-1.5 bg-lab-50 rounded border border-lab-100">
              <div className="text-[10px] text-lab-500 font-medium">{archetype.id}</div>
              <div className="text-[10px] text-lab-400">{archetype.behavior_summary}</div>
              <div className="text-[10px] text-lab-400 mt-0.5">
                Conflict probability: <span className={archetype.conflict_probability > 0.3 ? 'text-red-600 font-medium' : ''}>
                  {(archetype.conflict_probability * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Persona A */}
        <Section title={`Parent A: ${scenario.config.parentA.label}`} defaultOpen={true}>
          <select className={selectClass} value={scenario.config.personaA || ''}
            onChange={e => updatePersona('A', e.target.value || undefined)}>
            <option value="">Manual (no auto-behavior)</option>
            {PARENT_PERSONAS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {personaA && <PersonaBadge persona={personaA} />}
        </Section>

        {/* Persona B */}
        <Section title={`Parent B: ${scenario.config.parentB.label}`} defaultOpen={true}>
          <select className={selectClass} value={scenario.config.personaB || ''}
            onChange={e => updatePersona('B', e.target.value || undefined)}>
            <option value="">Manual (no auto-behavior)</option>
            {PARENT_PERSONAS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {personaB && <PersonaBadge persona={personaB} />}
        </Section>

        {/* Simulation Lifecycle */}
        {personaA && personaB && (
          <Section title="Simulation Lifecycle" defaultOpen={true}>
            <div className="space-y-2">
              {/* Setup */}
              <button
                onClick={runSetup}
                disabled={settingUp || setupDone}
                className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors ${
                  setupDone
                    ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                    : 'bg-lab-700 text-white hover:bg-lab-800 disabled:opacity-50'
                }`}
              >
                {settingUp ? 'Running Setup...' : setupDone ? 'Setup Complete' : 'Run Setup (Onboarding)'}
              </button>
              {syntheticMode && setupDone && (
                <div className="px-2 py-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded">
                  Offline Mode — API unavailable, using synthetic responses
                </div>
              )}

              {/* Step controls — only after setup */}
              {(setupDone || connectedA) && (
                <>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => stepDays(1)}
                      disabled={stepping}
                      className="flex-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                    >
                      +1 Day
                    </button>
                    <button
                      onClick={() => stepDays(7)}
                      disabled={stepping}
                      className="flex-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                    >
                      +1 Week
                    </button>
                    <button
                      onClick={() => stepDays((scenario.config.simulationWeeks || 8) * 7)}
                      disabled={stepping}
                      className="flex-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                    >
                      Full Run
                    </button>
                  </div>

                  {stepping && stepProgress && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-lab-400">
                        <span>Simulating...</span>
                        <span>{stepProgress.current}/{stepProgress.total} days</span>
                      </div>
                      <div className="w-full bg-lab-200 rounded-full h-1">
                        <div
                          className="h-1 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${(stepProgress.current / stepProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Day results summary */}
                  {dayResults.length > 0 && !stepping && (
                    <div className="p-2 bg-lab-50 rounded border border-lab-100">
                      <div className="text-[10px] font-medium text-lab-600 mb-1">
                        Last run: {dayResults.length} day{dayResults.length > 1 ? 's' : ''}
                      </div>
                      <div className="flex gap-3 text-[10px]">
                        <span className="text-lab-400">
                          Silent: {dayResults.filter(r => r.mode === 'silent').length}
                        </span>
                        <span className="text-blue-500">
                          Operational: {dayResults.filter(r => r.mode === 'operational').length}
                        </span>
                        {dayResults.some(r => r.mode === 'disruption') && (
                          <span className="text-amber-600">
                            Disruptions: {dayResults.filter(r => r.mode === 'disruption').length}
                          </span>
                        )}
                      </div>
                      {dayResults.some(r => r.systemMessageType) && (
                        <div className="text-[10px] text-lab-400 mt-1">
                          Messages: {dayResults.filter(r => r.systemMessageType).map(r => r.systemMessageType).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Message count */}
              <div className="flex justify-between text-[10px] text-lab-400">
                <span>A: {messagesA.length} msgs</span>
                <span>B: {messagesB.length} msgs</span>
              </div>
            </div>
          </Section>
        )}

        {/* Simulate Response (Paired) */}
        {personaA && personaB && (
          <Section title="Simulate Response" defaultOpen={true}>
            <button
              onClick={simulatePair}
              disabled={simulating}
              className="w-full px-3 py-2 text-xs font-medium bg-lab-700 text-white rounded hover:bg-lab-800 disabled:opacity-50"
            >
              {simulating ? 'Simulating...' : 'Simulate Both Parents'}
            </button>

            {pairResult && (
              <div className="mt-2 space-y-2">
                {/* Parent A Decision */}
                <div className="p-2 bg-orange-50 border border-orange-200 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-orange-700">
                      {scenario.config.parentA.label} ({personaA.name})
                    </span>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                      pairResult.decisionA.decision === 'accept' ? 'bg-green-100 text-green-700' :
                      pairResult.decisionA.decision === 'counter' ? 'bg-amber-100 text-amber-700' :
                      pairResult.decisionA.decision === 'reject' ? 'bg-red-100 text-red-700' :
                      'bg-lab-100 text-lab-500'
                    }`}>
                      {pairResult.decisionA.decision} ({(pairResult.decisionA.confidence * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="text-[10px] text-orange-600 mt-1">{pairResult.decisionA.reasoning}</div>
                  <div className="text-[10px] text-lab-400 mt-0.5 italic">&ldquo;{pairResult.autoMessageA}&rdquo;</div>
                </div>

                {/* Parent B Decision */}
                <div className="p-2 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-green-700">
                      {scenario.config.parentB.label} ({personaB.name})
                    </span>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                      pairResult.decisionB.decision === 'accept' ? 'bg-green-100 text-green-700' :
                      pairResult.decisionB.decision === 'counter' ? 'bg-amber-100 text-amber-700' :
                      pairResult.decisionB.decision === 'reject' ? 'bg-red-100 text-red-700' :
                      'bg-lab-100 text-lab-500'
                    }`}>
                      {pairResult.decisionB.decision} ({(pairResult.decisionB.confidence * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="text-[10px] text-green-600 mt-1">{pairResult.decisionB.reasoning}</div>
                  <div className="text-[10px] text-lab-400 mt-0.5 italic">&ldquo;{pairResult.autoMessageB}&rdquo;</div>
                </div>

                {/* Resolution Paths Dropdown */}
                {pairResult.resolutionPaths.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowResolutions(!showResolutions)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-medium text-lab-600 bg-lab-50 border border-lab-200 rounded hover:bg-lab-100"
                    >
                      <span>Resolution Paths ({pairResult.resolutionPaths.length})</span>
                      <span className="text-lab-300">{showResolutions ? '−' : '+'}</span>
                    </button>
                    {showResolutions && (
                      <div className="mt-1 space-y-1">
                        {pairResult.resolutionPaths.map((path, i) => (
                          <div key={i} className="p-1.5 border border-lab-100 rounded bg-white">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-medium text-lab-700">{path.label}</span>
                              <span className="text-[10px] text-lab-400">
                                {(path.probability * 100).toFixed(0)}% likely
                              </span>
                            </div>
                            <div className="text-[10px] text-lab-400 mt-0.5">{path.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Disruption Injection */}
        <Section title="Inject Disruption" defaultOpen={false}
          count={scenario.config.scenarioIds?.length}>
          <div className="flex gap-1 flex-wrap mb-2">
            <button onClick={() => setCategoryFilter(null)}
              className={`px-1.5 py-0.5 text-[10px] rounded-full ${!categoryFilter ? 'bg-lab-700 text-white' : 'bg-lab-100 text-lab-500'}`}>
              All
            </button>
            {SCENARIO_CATEGORIES.map(cat => (
              <button key={cat.value} onClick={() => setCategoryFilter(cat.value)}
                className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                  categoryFilter === cat.value ? cat.color + ' font-medium' : 'bg-lab-100 text-lab-500'
                }`}>
                {cat.label}
              </button>
            ))}
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {filteredScenarios.map(sc => {
              const catInfo = SCENARIO_CATEGORIES.find(c => c.value === sc.category);
              return (
                <button key={sc.id}
                  onClick={() => injectDisruption(scenario.config.parentA.phone, sc.id)}
                  className="w-full text-left p-2 border border-lab-200 rounded text-[11px] hover:border-lab-400 hover:bg-lab-50 transition-colors">
                  <div className="flex items-center gap-1">
                    <span className={`px-1 py-0.5 text-[9px] rounded ${catInfo?.color || 'bg-lab-100 text-lab-500'}`}>
                      {sc.category}
                    </span>
                    <span className={`px-1 py-0.5 text-[9px] rounded ${difficultyColor(sc.difficulty)}`}>
                      L{sc.difficulty}
                    </span>
                    <span className="font-medium text-lab-700">{sc.name}</span>
                  </div>
                  <div className="text-lab-400 mt-0.5 line-clamp-1">{sc.description}</div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Actions */}
        <div className="px-3 py-3 border-t border-lab-200">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="w-full px-3 py-1.5 text-xs border border-lab-200 rounded hover:bg-lab-50 disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Right: Simulation Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs */}
        <div className="border-b border-lab-200 flex gap-0 px-4 flex-shrink-0">
          <button className={tabClass('phones')} onClick={() => setActiveTab('phones')}>
            Dual Phone Sim
          </button>
          <button className={tabClass('calendar')} onClick={() => setActiveTab('calendar')}>
            Schedule
          </button>
          <button className={tabClass('diagnostics')} onClick={() => setActiveTab('diagnostics')}>
            Diagnostics ({logs.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'phones' && (
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="border border-lab-200 rounded-lg overflow-hidden flex flex-col">
                <PhoneSimulator
                  label={scenario.config.parentA.label}
                  phone={scenario.config.parentA.phone}
                  color="#FFA54C"
                  messages={messagesA}
                  onSend={text => simulate(scenario.config.parentA.phone, 'send', text)}
                  onConnect={() => simulate(scenario.config.parentA.phone, 'connect')}
                  connected={connectedA}
                  sending={sendingA}
                  quickActions={getQuickActions(messagesA, false)}
                  schedule={schedule}
                  parentALabel={scenario.config.parentA.label}
                  parentBLabel={scenario.config.parentB.label}
                  onViewSchedule={() => setActiveTab('calendar')}
                />
              </div>
              <div className="border border-lab-200 rounded-lg overflow-hidden flex flex-col">
                <PhoneSimulator
                  label={scenario.config.parentB.label}
                  phone={scenario.config.parentB.phone}
                  color="#4CAF7C"
                  messages={messagesB}
                  onSend={text => simulate(scenario.config.parentB.phone, 'send', text)}
                  onConnect={() => simulate(scenario.config.parentB.phone, 'connect')}
                  connected={connectedB}
                  sending={sendingB}
                  quickActions={getQuickActions(messagesB, true)}
                  schedule={schedule}
                  parentALabel={scenario.config.parentA.label}
                  parentBLabel={scenario.config.parentB.label}
                  onViewSchedule={() => setActiveTab('calendar')}
                />
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="bg-white border border-lab-200 rounded-lg p-4">
              <ScheduleCalendar
                days={schedule}
                parentALabel={scenario.config.parentA.label}
                parentBLabel={scenario.config.parentB.label}
              />
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <DiagnosticsPanel
              logs={logs}
              bootstrapFacts={scenario.bootstrapFacts}
            />
          )}
        </div>
      </div>
    </div>
  );
}
