'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Scenario, SCENARIO_PRESETS } from '@/lib/types';

export default function Dashboard() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scenarios')
      .then(r => r.json())
      .then(setScenarios)
      .finally(() => setLoading(false));
  }, []);

  async function createFromPreset(index: number) {
    const preset = SCENARIO_PRESETS[index];
    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preset),
    });
    const scenario = await res.json();
    setScenarios(prev => [scenario, ...prev]);
  }

  async function deleteScenario(id: string) {
    await fetch('/api/scenarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setScenarios(prev => prev.filter(s => s.id !== id));
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-lab-200 text-lab-600',
    configuring: 'bg-blue-100 text-blue-700',
    simulating: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-lab-800">Scenario Dashboard</h1>
          <p className="text-sm text-lab-400 mt-1">
            Configure family scenarios, simulate dual-parent interactions, inspect results
          </p>
        </div>
        <Link
          href="/scenarios/new"
          className="px-4 py-2 bg-lab-700 text-white text-sm rounded-md hover:bg-lab-800"
        >
          New Scenario
        </Link>
      </div>

      {/* Quick Start Presets */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-lab-500 mb-3">Quick Start Presets</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {SCENARIO_PRESETS.map((preset, i) => (
            <button
              key={i}
              onClick={() => createFromPreset(i)}
              className="text-left p-3 bg-white border border-lab-200 rounded-lg hover:border-lab-400 transition-colors"
            >
              <div className="text-sm font-medium text-lab-700">{preset.name}</div>
              <div className="text-xs text-lab-400 mt-1">{preset.description}</div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {preset.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 bg-lab-100 text-lab-500 text-[10px] rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Scenario List */}
      <div>
        <h2 className="text-sm font-medium text-lab-500 mb-3">
          Active Scenarios {scenarios.length > 0 && `(${scenarios.length})`}
        </h2>
        {loading ? (
          <div className="text-sm text-lab-400">Loading...</div>
        ) : scenarios.length === 0 ? (
          <div className="text-center py-12 bg-white border border-lab-200 rounded-lg">
            <div className="text-lab-400 text-sm">No scenarios yet</div>
            <div className="text-lab-300 text-xs mt-1">Create one from a preset above or build custom</div>
          </div>
        ) : (
          <div className="bg-white border border-lab-200 rounded-lg divide-y divide-lab-100">
            {scenarios.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[s.status]}`}>
                    {s.status}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-lab-700">{s.config.name}</div>
                    <div className="text-xs text-lab-400">
                      {s.config.template} | {s.config.children.length} child(ren) |{' '}
                      {s.config.targetSplit}/{100 - s.config.targetSplit} split
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-lab-300">
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                  <Link
                    href={`/scenarios/${s.id}/simulate`}
                    className="px-3 py-1.5 text-xs bg-lab-700 text-white rounded hover:bg-lab-800"
                  >
                    Simulate
                  </Link>
                  <button
                    onClick={() => deleteScenario(s.id)}
                    className="px-2 py-1.5 text-xs text-lab-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
