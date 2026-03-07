'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Scenario, Message, SimulationLog, ScheduleDay } from '@/lib/types';
import { PhoneSimulator } from '@/components/PhoneSimulator';
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
import { ScheduleCalendar } from '@/components/ScheduleCalendar';
import { PARENT_PERSONAS } from '@/lib/personas';
import { SCENARIO_CATALOG, SCENARIO_CATEGORIES } from '@/lib/scenarios';

type Tab = 'phones' | 'calendar' | 'diagnostics';

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

  useEffect(() => {
    fetch(`/api/scenarios/${id}`)
      .then(r => r.json())
      .then(s => {
        setScenario(s);
        setMessagesA(s.messagesA || []);
        setMessagesB(s.messagesB || []);
        setLogs(s.logs || []);
        setSchedule(s.schedule || []);
        if (s.messagesA?.length > 0) setConnectedA(true);
        if (s.messagesB?.length > 0) setConnectedB(true);
      });
  }, [id]);

  const simulate = useCallback(async (
    phone: string,
    action: 'connect' | 'send',
    body?: string,
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
    } catch (err) {
      console.error('Auto-respond error:', err);
    } finally {
      setSending(false);
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

    // Parent A quick actions based on context
    if (text.includes('how many') || text.includes('children') || text.includes('kids')) {
      return ['1 kid, age 5', '2 kids, ages 4 and 7', '3 kids, ages 3, 6, and 10'];
    }
    if (text.includes('custody') || text.includes('arrangement') || text.includes('schedule work')) {
      return ['We alternate weeks', 'I have weekdays, dad gets weekends', '2-2-3 schedule'];
    }
    if (text.includes('which days') || text.includes('always with you') || text.includes('locked')) {
      return ['Mon-Wed are always mine', 'No fixed days', 'Tue and Thu are always mine'];
    }
    if (text.includes('weekend')) {
      return ['We alternate weekends', 'I always have weekends', 'We split Sat/Sun'];
    }
    if (text.includes('split') || text.includes('50/50') || text.includes('time')) {
      return ['50/50', '60/40', '70/30'];
    }
    if (text.includes('exchange') || text.includes('handoff') || text.includes('drop')) {
      return ['School drop-off', 'Curbside pickup', 'I pick them up in the evening'];
    }
    if (text.includes('distance') || text.includes('how far') || text.includes('miles')) {
      return ['About 10 miles', '25 miles', '5 minutes away'];
    }
    if (text.includes('phone') || text.includes('co-parent') || text.includes('number')) {
      return [scenario?.config.parentB.phone || '+15550000002', "I'll add it later"];
    }
    if (text.includes('frustrat') || text.includes('change') || text.includes('better')) {
      return ['Too many handoffs', 'Not enough time with kids', 'Too much driving'];
    }
    if (text.includes('confirm') || text.includes('look right') || text.includes('good')) {
      return ['Yes, looks good!', 'Can we adjust something?'];
    }
    return [];
  }

  if (!scenario) {
    return <div className="text-sm text-lab-400">Loading scenario...</div>;
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm ${activeTab === t ? 'border-b-2 border-lab-700 text-lab-700 font-medium' : 'text-lab-400 hover:text-lab-600'}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lab-400 hover:text-lab-600 text-sm">&larr;</Link>
            <h1 className="text-lg font-semibold text-lab-800">{scenario.config.name}</h1>
            <span className="px-2 py-0.5 text-[10px] bg-lab-100 text-lab-500 rounded-full">
              {scenario.config.template}
            </span>
            <span className="px-2 py-0.5 text-[10px] bg-lab-100 text-lab-500 rounded-full">
              {scenario.config.targetSplit}/{100 - scenario.config.targetSplit}
            </span>
          </div>
          <p className="text-xs text-lab-400 mt-1">{scenario.config.description}</p>
          {(scenario.config.personaA || scenario.config.personaB) && (
            <div className="flex gap-2 mt-1">
              {scenario.config.personaA && (
                <span className="px-2 py-0.5 text-[10px] bg-orange-50 text-orange-700 rounded-full">
                  A: {PARENT_PERSONAS.find(p => p.id === scenario.config.personaA)?.name || scenario.config.personaA}
                </span>
              )}
              {scenario.config.personaB && (
                <span className="px-2 py-0.5 text-[10px] bg-green-50 text-green-700 rounded-full">
                  B: {PARENT_PERSONAS.find(p => p.id === scenario.config.personaB)?.name || scenario.config.personaB}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="px-3 py-1.5 text-xs border border-lab-200 rounded hover:bg-lab-50 disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-lab-200 mb-4 flex gap-0">
        <button className={tabClass('phones')} onClick={() => setActiveTab('phones')}>
          Dual Phone Sim
        </button>
        <button className={tabClass('calendar')} onClick={() => setActiveTab('calendar')}>
          Schedule Calendar
        </button>
        <button className={tabClass('diagnostics')} onClick={() => setActiveTab('diagnostics')}>
          Diagnostics ({logs.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'phones' && (
        <div>
          {/* Behavior Engine Controls */}
          {(scenario.config.personaA || scenario.config.personaB) && (
            <div className="flex items-center gap-3 mb-3 p-2 bg-lab-50 rounded-lg border border-lab-100">
              <span className="text-[10px] uppercase tracking-wider text-lab-400 font-medium">Behavior Engine</span>
              {scenario.config.personaA && connectedA && (
                <button
                  onClick={() => autoRespond(scenario.config.parentA.phone)}
                  disabled={sendingA}
                  className="px-2.5 py-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded hover:bg-orange-100 disabled:opacity-50"
                >
                  Auto-Respond A
                </button>
              )}
              {scenario.config.personaB && connectedB && (
                <button
                  onClick={() => autoRespond(scenario.config.parentB.phone)}
                  disabled={sendingB}
                  className="px-2.5 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
                >
                  Auto-Respond B
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] text-lab-400">Inject:</span>
                <select
                  className="text-xs border border-lab-200 rounded px-2 py-1 bg-white"
                  defaultValue=""
                  onChange={e => {
                    if (e.target.value) {
                      injectDisruption(scenario.config.parentA.phone, e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Select disruption...</option>
                  {SCENARIO_CATEGORIES.map(cat => (
                    <optgroup key={cat.value} label={cat.label}>
                      {SCENARIO_CATALOG.filter(s => s.category === cat.value).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4" style={{ height: 'calc(100vh - 260px)' }}>
            {/* Parent A Phone */}
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
              />
            </div>

            {/* Parent B Phone */}
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
              />
            </div>
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
  );
}
