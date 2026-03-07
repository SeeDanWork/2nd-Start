'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScenarioConfig, ChildConfig, TEMPLATE_OPTIONS, DAY_NAMES } from '@/lib/types';
import { PARENT_PERSONAS, FAMILY_STRUCTURES } from '@/lib/personas';
import { SCENARIO_CATALOG, SCENARIO_CATEGORIES } from '@/lib/scenarios';

const emptyConfig: ScenarioConfig = {
  name: '',
  description: '',
  children: [{ age: 7, name: 'Child 1' }],
  parentA: { label: 'Mom', phone: '+15550010001' },
  parentB: { label: 'Dad', phone: '+15550010002' },
  template: 'alternating_weeks',
  targetSplit: 50,
  lockedNights: [],
  distanceMiles: 10,
  tags: [],
  personaA: undefined,
  personaB: undefined,
  familyStructure: undefined,
  scenarioIds: [],
  simulationWeeks: 6,
};

export default function NewScenarioPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ScenarioConfig>({ ...emptyConfig });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  function updateConfig(patch: Partial<ScenarioConfig>) {
    setConfig(prev => ({ ...prev, ...patch }));
  }

  function applyFamilyStructure(structId: string) {
    const struct = FAMILY_STRUCTURES.find(f => f.id === structId);
    if (!struct) return;
    updateConfig({
      familyStructure: structId,
      children: struct.children,
      distanceMiles: struct.distanceMiles,
      template: struct.baseTemplate,
      targetSplit: struct.targetSplit,
      name: config.name || struct.name,
      description: config.description || struct.description,
    });
  }

  function addChild() {
    updateConfig({
      children: [...config.children, { age: 5, name: `Child ${config.children.length + 1}` }],
    });
  }

  function updateChild(i: number, patch: Partial<ChildConfig>) {
    const children = [...config.children];
    children[i] = { ...children[i], ...patch };
    updateConfig({ children });
  }

  function removeChild(i: number) {
    updateConfig({ children: config.children.filter((_, idx) => idx !== i) });
  }

  function toggleLockedDay(parent: 'parent_a' | 'parent_b', day: number) {
    const existing = config.lockedNights.find(ln => ln.parent === parent);
    if (existing) {
      const days = existing.daysOfWeek.includes(day)
        ? existing.daysOfWeek.filter(d => d !== day)
        : [...existing.daysOfWeek, day];
      if (days.length === 0) {
        updateConfig({ lockedNights: config.lockedNights.filter(ln => ln.parent !== parent) });
      } else {
        updateConfig({
          lockedNights: config.lockedNights.map(ln =>
            ln.parent === parent ? { ...ln, daysOfWeek: days } : ln,
          ),
        });
      }
    } else {
      updateConfig({
        lockedNights: [...config.lockedNights, { parent, daysOfWeek: [day] }],
      });
    }
  }

  function isLocked(parent: 'parent_a' | 'parent_b', day: number) {
    return config.lockedNights.some(ln => ln.parent === parent && ln.daysOfWeek.includes(day));
  }

  function toggleScenario(scenarioId: string) {
    const ids = config.scenarioIds || [];
    if (ids.includes(scenarioId)) {
      updateConfig({ scenarioIds: ids.filter(id => id !== scenarioId) });
    } else {
      updateConfig({ scenarioIds: [...ids, scenarioId] });
    }
  }

  function addTag() {
    if (tagInput.trim() && !config.tags.includes(tagInput.trim())) {
      updateConfig({ tags: [...config.tags, tagInput.trim()] });
      setTagInput('');
    }
  }

  async function handleSave() {
    if (!config.name.trim()) return;
    setSaving(true);
    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const scenario = await res.json();
    router.push(`/scenarios/${scenario.id}/simulate`);
  }

  const inputClass = 'w-full px-3 py-2 border border-lab-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-lab-400';
  const labelClass = 'block text-xs font-medium text-lab-500 mb-1';
  const sectionClass = 'bg-white border border-lab-200 rounded-lg p-4';

  const filteredScenarios = categoryFilter
    ? SCENARIO_CATALOG.filter(s => s.category === categoryFilter)
    : SCENARIO_CATALOG;

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-lab-800 mb-6">New Scenario</h1>

      <div className="space-y-6">
        {/* Basic Info */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-lab-600 mb-3">Basic Info</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Scenario Name</label>
              <input className={inputClass} value={config.name}
                onChange={e => updateConfig({ name: e.target.value })}
                placeholder="e.g. High-conflict 2-2-3 with school closures" />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea className={inputClass + ' h-16 resize-none'} value={config.description}
                onChange={e => updateConfig({ description: e.target.value })}
                placeholder="What is this scenario testing?" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Simulation Length (weeks)</label>
                <input type="number" className={inputClass} value={config.simulationWeeks || 6}
                  onChange={e => updateConfig({ simulationWeeks: parseInt(e.target.value) || 6 })}
                  min={1} max={52} />
              </div>
            </div>
          </div>
        </section>

        {/* Family Structure Presets */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-lab-600 mb-3">Family Structure</h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {FAMILY_STRUCTURES.map(fs => (
              <button key={fs.id} onClick={() => applyFamilyStructure(fs.id)}
                className={`text-left p-2.5 border rounded-lg text-xs transition-colors ${
                  config.familyStructure === fs.id
                    ? 'border-lab-500 bg-lab-50'
                    : 'border-lab-200 hover:border-lab-300'
                }`}>
                <div className="font-medium text-lab-700">{fs.name}</div>
                <div className="text-lab-400 mt-0.5">{fs.description}</div>
                <div className="text-lab-400 mt-1">
                  {fs.children.map(c => `age ${c.age}`).join(', ')} | {fs.baseTemplate} | {fs.targetSplit}/{100 - fs.targetSplit}
                </div>
              </button>
            ))}
          </div>

          {/* Manual children */}
          <div className="border-t border-lab-100 pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-lab-400">Or configure manually:</span>
              <button onClick={addChild} className="text-xs text-lab-500 hover:text-lab-700">+ Add Child</button>
            </div>
            <div className="space-y-2">
              {config.children.map((child, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <input className="px-2 py-1.5 border border-lab-200 rounded text-sm w-28"
                    value={child.name} onChange={e => updateChild(i, { name: e.target.value })} />
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-lab-400">Age:</label>
                    <input type="number" className="px-2 py-1.5 border border-lab-200 rounded text-sm w-16"
                      value={child.age} onChange={e => updateChild(i, { age: parseInt(e.target.value) || 0 })}
                      min={0} max={18} />
                  </div>
                  {config.children.length > 1 && (
                    <button onClick={() => removeChild(i)} className="text-xs text-lab-400 hover:text-red-500">Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Parent Personas */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-lab-600 mb-3">Parent Personas</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Parent A */}
            <div>
              <label className={labelClass}>Parent A: {config.parentA.label}</label>
              <input className={inputClass + ' mb-2'} value={config.parentA.label}
                onChange={e => updateConfig({ parentA: { ...config.parentA, label: e.target.value } })} />
              <input className={inputClass + ' mb-2'} value={config.parentA.phone}
                onChange={e => updateConfig({ parentA: { ...config.parentA, phone: e.target.value } })}
                placeholder="Phone (sim)" />
              <label className={labelClass}>Behavior Persona</label>
              <select className={inputClass} value={config.personaA || ''}
                onChange={e => updateConfig({ personaA: e.target.value || undefined })}>
                <option value="">Manual (no auto-behavior)</option>
                {PARENT_PERSONAS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {config.personaA && (
                <PersonaBadge personaId={config.personaA} />
              )}
            </div>
            {/* Parent B */}
            <div>
              <label className={labelClass}>Parent B: {config.parentB.label}</label>
              <input className={inputClass + ' mb-2'} value={config.parentB.label}
                onChange={e => updateConfig({ parentB: { ...config.parentB, label: e.target.value } })} />
              <input className={inputClass + ' mb-2'} value={config.parentB.phone}
                onChange={e => updateConfig({ parentB: { ...config.parentB, phone: e.target.value } })}
                placeholder="Phone (sim)" />
              <label className={labelClass}>Behavior Persona</label>
              <select className={inputClass} value={config.personaB || ''}
                onChange={e => updateConfig({ personaB: e.target.value || undefined })}>
                <option value="">Manual (no auto-behavior)</option>
                {PARENT_PERSONAS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {config.personaB && (
                <PersonaBadge personaId={config.personaB} />
              )}
            </div>
          </div>
        </section>

        {/* Schedule Config */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-lab-600 mb-3">Schedule Configuration</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>Template</label>
              <select className={inputClass} value={config.template}
                onChange={e => updateConfig({ template: e.target.value })}>
                {TEMPLATE_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label} ({t.split})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Target Split (% Parent A)</label>
              <input type="number" className={inputClass} value={config.targetSplit}
                onChange={e => updateConfig({ targetSplit: parseInt(e.target.value) || 50 })}
                min={0} max={100} />
              <div className="text-xs text-lab-400 mt-1">{config.targetSplit}/{100 - config.targetSplit}</div>
            </div>
            <div>
              <label className={labelClass}>Distance (miles)</label>
              <input type="number" className={inputClass} value={config.distanceMiles}
                onChange={e => updateConfig({ distanceMiles: parseInt(e.target.value) || 0 })} min={0} />
            </div>
          </div>

          {/* Locked Nights */}
          <div>
            <label className={labelClass}>Locked Nights (click to toggle)</label>
            <div className="mt-2 space-y-2">
              {(['parent_a', 'parent_b'] as const).map(parent => (
                <div key={parent} className="flex items-center gap-2">
                  <span className="text-xs text-lab-500 w-16">
                    {parent === 'parent_a' ? config.parentA.label : config.parentB.label}
                  </span>
                  <div className="flex gap-1">
                    {DAY_NAMES.map((day, d) => (
                      <button key={d} onClick={() => toggleLockedDay(parent, d)}
                        className={`w-10 h-8 text-xs rounded border transition-colors ${
                          isLocked(parent, d)
                            ? parent === 'parent_a'
                              ? 'bg-parentA text-white border-parentA'
                              : 'bg-parentB text-white border-parentB'
                            : 'bg-white text-lab-400 border-lab-200 hover:border-lab-400'
                        }`}>{day}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Scenario Injection */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-lab-600 mb-3">
            Event Scenarios ({config.scenarioIds?.length || 0} selected)
          </h2>
          <p className="text-xs text-lab-400 mb-3">
            Select disruption scenarios to inject into the simulation timeline.
          </p>

          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            <button onClick={() => setCategoryFilter(null)}
              className={`px-2 py-1 text-[11px] rounded-full ${!categoryFilter ? 'bg-lab-700 text-white' : 'bg-lab-100 text-lab-500 hover:bg-lab-200'}`}>
              All
            </button>
            {SCENARIO_CATEGORIES.map(cat => (
              <button key={cat.value} onClick={() => setCategoryFilter(cat.value)}
                className={`px-2 py-1 text-[11px] rounded-full ${
                  categoryFilter === cat.value ? cat.color + ' font-medium' : 'bg-lab-100 text-lab-500 hover:bg-lab-200'
                }`}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Scenario grid */}
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {filteredScenarios.map(sc => {
              const selected = config.scenarioIds?.includes(sc.id);
              const catInfo = SCENARIO_CATEGORIES.find(c => c.value === sc.category);
              return (
                <button key={sc.id} onClick={() => toggleScenario(sc.id)}
                  className={`text-left p-2.5 border rounded-lg text-xs transition-colors ${
                    selected ? 'border-lab-500 bg-lab-50' : 'border-lab-200 hover:border-lab-300'
                  }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${catInfo?.color || 'bg-lab-100 text-lab-500'}`}>
                      {sc.category}
                    </span>
                    <span className="font-medium text-lab-700">{sc.name}</span>
                  </div>
                  <div className="text-lab-400 mt-1">{sc.description}</div>
                  <div className="text-lab-300 mt-1">
                    {sc.events.length} event{sc.events.length > 1 ? 's' : ''}: {sc.events.map(e => `${e.type} (day ${e.day})`).join(', ')}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Tags */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-lab-600 mb-3">Tags</h2>
          <div className="flex gap-2 mb-2 flex-wrap">
            {config.tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-lab-100 text-lab-600 text-xs rounded flex items-center gap-1">
                {tag}
                <button onClick={() => updateConfig({ tags: config.tags.filter(t => t !== tag) })}
                  className="text-lab-400 hover:text-red-500">x</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="px-2 py-1.5 border border-lab-200 rounded text-sm flex-1"
              value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Add tag..." />
            <button onClick={addTag} className="px-3 py-1.5 text-xs bg-lab-100 text-lab-600 rounded hover:bg-lab-200">Add</button>
          </div>
        </section>

        {/* Test Matrix Info */}
        {config.personaA && config.personaB && (config.scenarioIds?.length || 0) > 0 && (
          <div className="bg-lab-800 text-lab-200 rounded-lg p-4 text-xs">
            <div className="font-medium text-white mb-1">Test Configuration Summary</div>
            <div>Family: {config.familyStructure || 'custom'}</div>
            <div>Parent A: {PARENT_PERSONAS.find(p => p.id === config.personaA)?.name} ({config.parentA.label})</div>
            <div>Parent B: {PARENT_PERSONAS.find(p => p.id === config.personaB)?.name} ({config.parentB.label})</div>
            <div>Scenarios: {config.scenarioIds?.map(id => SCENARIO_CATALOG.find(s => s.id === id)?.name).join(', ')}</div>
            <div>Duration: {config.simulationWeeks} weeks</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={!config.name.trim() || saving}
            className="px-6 py-2 bg-lab-700 text-white text-sm rounded-md hover:bg-lab-800 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create & Simulate'}
          </button>
          <button onClick={() => router.push('/')}
            className="px-4 py-2 text-sm text-lab-500 hover:text-lab-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Persona Badge Component ──

function PersonaBadge({ personaId }: { personaId: string }) {
  const persona = PARENT_PERSONAS.find(p => p.id === personaId);
  if (!persona) return null;
  const b = persona.behavior;

  const barColor = (val: number) => {
    if (val <= 2) return 'bg-green-400';
    if (val <= 3) return 'bg-amber-400';
    return 'bg-red-400';
  };

  return (
    <div className="mt-2 p-2 bg-lab-50 rounded border border-lab-100 text-[11px]">
      <div className="text-lab-600 font-medium mb-1">{persona.name}</div>
      <div className="text-lab-400 mb-2">{persona.description}</div>
      <div className="space-y-1">
        {[
          ['Conflict', b.conflict_level],
          ['Fairness', b.fairness_sensitivity],
          ['Rigidity', b.schedule_rigidity],
          ['Logistics', b.logistics_tolerance],
        ].map(([label, val]) => (
          <div key={label as string} className="flex items-center gap-2">
            <span className="w-14 text-lab-400">{label}</span>
            <div className="flex-1 bg-lab-200 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${barColor(val as number)}`}
                style={{ width: `${((val as number) / 5) * 100}%` }} />
            </div>
            <span className="w-4 text-right text-lab-400">{val as number}</span>
          </div>
        ))}
        <div className="flex gap-3 mt-1 text-lab-400">
          <span>Speed: {b.response_speed}</span>
          <span>Gaming: {(b.gaming_probability * 100).toFixed(0)}%</span>
          <span>Accept: {(b.proposal_acceptance_bias * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
