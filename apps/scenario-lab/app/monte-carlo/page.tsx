'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FAMILY_STRUCTURES } from '@/lib/personas';
import { MonteCarloSummary, GuardrailCalibration } from '@/lib/monte-carlo/types';

type View = 'config' | 'results' | 'sweep';

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white border border-lab-200 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-lab-400">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${color || 'text-lab-800'}`}>{value}</div>
      {sub && <div className="text-[10px] text-lab-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-lab-100 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function MonteCarloPage() {
  const [view, setView] = useState<View>('config');
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<MonteCarloSummary | null>(null);
  const [regressionTests, setRegressionTests] = useState<unknown[]>([]);
  const [sweepResult, setSweepResult] = useState<GuardrailCalibration | null>(null);

  // Config state
  const [runs, setRuns] = useState(1000);
  const [horizon, setHorizon] = useState(8);
  const [model, setModel] = useState<'realistic' | 'uniform'>('realistic');
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);

  // Sweep state
  const [sweepParam, setSweepParam] = useState('max_transitions_per_week');
  const [sweepValues, setSweepValues] = useState('1,2,3,4,5');
  const [sweepRuns, setSweepRuns] = useState(500);
  const [sweeping, setSweeping] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      const res = await fetch('/api/monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          config: {
            runs,
            horizon_weeks: horizon,
            disruption_model: model,
            family_structures: selectedFamilies,
          },
        }),
      });
      const data = await res.json();
      setSummary(data.summary);
      setRegressionTests(data.regression_tests || []);
      setView('results');
    } finally {
      setRunning(false);
    }
  }

  async function handleSweep() {
    setSweeping(true);
    try {
      const values = sweepValues.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      const res = await fetch('/api/monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sweep',
          parameter: sweepParam,
          values,
          config: { runs: sweepRuns, horizon_weeks: horizon, disruption_model: model },
        }),
      });
      const data = await res.json();
      setSweepResult(data.calibration);
    } finally {
      setSweeping(false);
    }
  }

  function toggleFamily(id: string) {
    setSelectedFamilies(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  }

  const inputClass = 'px-3 py-2 border border-lab-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-lab-400';
  const tabClass = (t: View) =>
    `px-4 py-2 text-sm ${view === t ? 'border-b-2 border-lab-700 text-lab-700 font-medium' : 'text-lab-400 hover:text-lab-600'}`;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lab-400 hover:text-lab-600 text-sm">&larr;</Link>
            <h1 className="text-lg font-semibold text-lab-800">Monte Carlo Simulator</h1>
          </div>
          <p className="text-xs text-lab-400 mt-1">
            Solver stability, edge cases, policy gaps, guardrail calibration
          </p>
        </div>
      </div>

      <div className="border-b border-lab-200 mb-4 flex gap-0">
        <button className={tabClass('config')} onClick={() => setView('config')}>Configure</button>
        <button className={tabClass('results')} onClick={() => setView('results')}>
          Results {summary ? `(${summary.runs} runs)` : ''}
        </button>
        <button className={tabClass('sweep')} onClick={() => setView('sweep')}>Guardrail Sweep</button>
      </div>

      {/* ── Config Tab ── */}
      {view === 'config' && (
        <div className="space-y-6">
          <div className="bg-white border border-lab-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-lab-600 mb-3">Simulation Parameters</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-lab-500 mb-1">Runs</label>
                <input type="number" className={inputClass + ' w-full'} value={runs}
                  onChange={e => setRuns(Math.min(10000, parseInt(e.target.value) || 100))}
                  min={100} max={10000} step={100} />
                <div className="text-[10px] text-lab-400 mt-1">100–10,000</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-lab-500 mb-1">Horizon (weeks)</label>
                <input type="number" className={inputClass + ' w-full'} value={horizon}
                  onChange={e => setHorizon(parseInt(e.target.value) || 8)}
                  min={4} max={52} />
              </div>
              <div>
                <label className="block text-xs font-medium text-lab-500 mb-1">Disruption Model</label>
                <select className={inputClass + ' w-full'} value={model}
                  onChange={e => setModel(e.target.value as 'realistic' | 'uniform')}>
                  <option value="realistic">Realistic (stress model)</option>
                  <option value="uniform">Uniform (baseline)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-lab-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-lab-600 mb-3">
              Family Structures {selectedFamilies.length > 0 ? `(${selectedFamilies.length} selected)` : '(all)'}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {FAMILY_STRUCTURES.map(fs => (
                <button key={fs.id} onClick={() => toggleFamily(fs.id)}
                  className={`text-left p-2.5 border rounded-lg text-xs transition-colors ${
                    selectedFamilies.includes(fs.id) || selectedFamilies.length === 0
                      ? 'border-lab-500 bg-lab-50'
                      : 'border-lab-200 text-lab-400'
                  }`}>
                  <div className="font-medium text-lab-700">{fs.name}</div>
                  <div className="text-lab-400 mt-0.5">
                    {fs.children.length} child{fs.children.length > 1 ? 'ren' : ''} | {fs.baseTemplate} | {fs.distanceMiles}mi
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleRun} disabled={running}
            className="px-6 py-2.5 bg-lab-700 text-white text-sm rounded-md hover:bg-lab-800 disabled:opacity-50">
            {running ? `Running ${runs} simulations...` : `Run ${runs} Simulations`}
          </button>
        </div>
      )}

      {/* ── Results Tab ── */}
      {view === 'results' && summary && (
        <div className="space-y-6">
          {/* Header stats */}
          <div className="grid grid-cols-5 gap-3">
            <StatCard label="Runs" value={summary.runs.toLocaleString()}
              sub={`${summary.duration_ms}ms`} />
            <StatCard label="Mean Fairness Drift" value={`${summary.mean_fairness_drift}%`}
              sub={`p95: ${summary.p95_fairness_drift}%`}
              color={summary.mean_fairness_drift > 5 ? 'text-red-600' : 'text-lab-800'} />
            <StatCard label="Mean Transitions/wk" value={`${summary.mean_transitions}`}
              sub={`p95: ${summary.p95_transitions}`} />
            <StatCard label="Infeasible Rate" value={`${summary.solver_infeasible_rate}%`}
              color={summary.solver_infeasible_rate > 5 ? 'text-red-600' : 'text-lab-800'} />
            <StatCard label="Stability Score" value={`${summary.mean_stability_score}`}
              color={summary.mean_stability_score < 0.5 ? 'text-amber-600' : 'text-lab-800'} />
          </div>

          {/* Detailed metrics */}
          <div className="grid grid-cols-2 gap-4">
            {/* Fairness */}
            <div className="bg-white border border-lab-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-lab-600 mb-3">Fairness Distribution</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-lab-500">Mean drift</span>
                  <span className="font-medium">{summary.mean_fairness_drift}%</span>
                </div>
                <ProgressBar value={summary.mean_fairness_drift} max={15} color="bg-blue-400" />
                <div className="flex justify-between">
                  <span className="text-lab-500">Median drift</span>
                  <span className="font-medium">{summary.median_fairness_drift}%</span>
                </div>
                <ProgressBar value={summary.median_fairness_drift} max={15} color="bg-blue-300" />
                <div className="flex justify-between">
                  <span className="text-lab-500">95th percentile</span>
                  <span className="font-medium">{summary.p95_fairness_drift}%</span>
                </div>
                <ProgressBar value={summary.p95_fairness_drift} max={15} color="bg-amber-400" />
                <div className="flex justify-between">
                  <span className="text-lab-500">Max drift</span>
                  <span className="font-medium">{summary.max_fairness_drift}%</span>
                </div>
                <ProgressBar value={summary.max_fairness_drift} max={15} color="bg-red-400" />
              </div>
            </div>

            {/* Failure rates */}
            <div className="bg-white border border-lab-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-lab-600 mb-3">Solver Performance</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-lab-500">Constraint conflict rate</span>
                  <span className="font-medium">{summary.conflict_rate}%</span>
                </div>
                <ProgressBar value={summary.conflict_rate} max={50} color="bg-amber-400" />
                <div className="flex justify-between">
                  <span className="text-lab-500">Infeasible rate</span>
                  <span className="font-medium">{summary.solver_infeasible_rate}%</span>
                </div>
                <ProgressBar value={summary.solver_infeasible_rate} max={20} color="bg-red-400" />
                <div className="flex justify-between">
                  <span className="text-lab-500">Degraded solution rate</span>
                  <span className="font-medium">{summary.degraded_solution_rate}%</span>
                </div>
                <ProgressBar value={summary.degraded_solution_rate} max={30} color="bg-orange-400" />
                <div className="flex justify-between">
                  <span className="text-lab-500">Schedule change freq</span>
                  <span className="font-medium">{summary.schedule_change_frequency} days/run</span>
                </div>
                <ProgressBar value={summary.schedule_change_frequency} max={20} color="bg-blue-400" />
              </div>
            </div>
          </div>

          {/* Most common disruption */}
          {summary.most_common_disruption_sequence.length > 0 && (
            <div className="bg-white border border-lab-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-lab-600 mb-2">Most Common Disruption Sequence</h3>
              <div className="flex gap-1.5 flex-wrap">
                {summary.most_common_disruption_sequence.map((evt, i) => (
                  <span key={i} className="px-2 py-1 text-xs bg-lab-100 text-lab-600 rounded">
                    {evt}
                    {i < summary.most_common_disruption_sequence.length - 1 && (
                      <span className="text-lab-300 ml-1.5">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top failure patterns */}
          {summary.top_failure_patterns.length > 0 && (
            <div className="bg-white border border-lab-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-lab-600 mb-3">
                Top Failure Patterns ({summary.top_failure_patterns.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {summary.top_failure_patterns.map((fp, i) => (
                  <div key={i} className="p-2.5 border border-lab-100 rounded text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                          fp.solver_result === 'infeasible' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>{fp.solver_result}</span>
                        <span className="font-medium text-lab-700">{fp.family_structure}</span>
                      </div>
                      <span className="text-lab-400">{fp.occurrence_count}x</span>
                    </div>
                    <div className="text-lab-400 mt-1">
                      Events: {fp.event_sequence.slice(0, 5).join(', ')}{fp.event_sequence.length > 5 ? '...' : ''}
                    </div>
                    {fp.recommended_constraint_relaxation.length > 0 && (
                      <div className="text-lab-500 mt-0.5">
                        Relax: {fp.recommended_constraint_relaxation.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Policy gaps */}
          {summary.policy_gaps.length > 0 && (
            <div className="bg-white border border-lab-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-lab-600 mb-3">
                Policy Gaps ({summary.policy_gaps.length})
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {summary.policy_gaps.map((pg, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border border-lab-100 rounded text-xs">
                    <div>
                      <span className="font-medium text-lab-700">{pg.event_sequence.join(' + ')}</span>
                      <span className="text-lab-400 ml-2">({pg.family_type})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px]">
                        {pg.occurrence_count}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regression tests */}
          {regressionTests.length > 0 && (
            <div className="bg-white border border-lab-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-lab-600 mb-3">
                Generated Regression Tests ({regressionTests.length})
              </h3>
              <pre className="text-[11px] text-lab-600 bg-lab-50 p-3 rounded overflow-x-auto max-h-48">
                {JSON.stringify(regressionTests, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {view === 'results' && !summary && (
        <div className="text-center py-12 text-sm text-lab-400">
          No results yet. Run a simulation from the Configure tab.
        </div>
      )}

      {/* ── Guardrail Sweep Tab ── */}
      {view === 'sweep' && (
        <div className="space-y-6">
          <div className="bg-white border border-lab-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-lab-600 mb-3">Guardrail Parameter Sweep</h2>
            <p className="text-xs text-lab-400 mb-4">
              Test different constraint thresholds to find the sweet spot between stability and feasibility.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-lab-500 mb-1">Parameter</label>
                <select className={inputClass + ' w-full'} value={sweepParam}
                  onChange={e => setSweepParam(e.target.value)}>
                  <option value="max_transitions_per_week">Max Transitions/Week</option>
                  <option value="max_consecutive_nights">Max Consecutive Nights</option>
                  <option value="fairness_tolerance_pct">Fairness Tolerance %</option>
                  <option value="min_stability_score">Min Stability Score</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-lab-500 mb-1">Values to test</label>
                <input className={inputClass + ' w-full'} value={sweepValues}
                  onChange={e => setSweepValues(e.target.value)}
                  placeholder="1,2,3,4,5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-lab-500 mb-1">Runs per value</label>
                <input type="number" className={inputClass + ' w-full'} value={sweepRuns}
                  onChange={e => setSweepRuns(parseInt(e.target.value) || 500)}
                  min={100} max={5000} />
              </div>
            </div>
            <button onClick={handleSweep} disabled={sweeping}
              className="mt-4 px-6 py-2 bg-lab-700 text-white text-sm rounded-md hover:bg-lab-800 disabled:opacity-50">
              {sweeping ? 'Sweeping...' : 'Run Sweep'}
            </button>
          </div>

          {sweepResult && (
            <div className="bg-white border border-lab-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-lab-600 mb-3">
                Sweep Results: {sweepResult.parameter}
              </h3>
              <div className="mb-4 p-3 bg-lab-50 rounded">
                <div className="text-xs text-lab-500">Recommended value:
                  <span className="font-semibold text-lab-800 ml-1">{sweepResult.recommended_value}</span>
                </div>
                <div className="text-xs text-lab-500">Safe range:
                  <span className="font-medium text-lab-700 ml-1">
                    {sweepResult.recommended_range[0]} – {sweepResult.recommended_range[1]}
                  </span>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-lab-500 border-b border-lab-200">
                    <th className="text-left py-1.5 px-2">Value</th>
                    <th className="text-left py-1.5 px-2">Infeasible %</th>
                    <th className="text-left py-1.5 px-2">Stability</th>
                    <th className="text-left py-1.5 px-2">Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  {sweepResult.tested_values.map((val, i) => (
                    <tr key={i} className={`border-b border-lab-100 ${
                      val === sweepResult.recommended_value ? 'bg-green-50' : ''
                    }`}>
                      <td className="py-1.5 px-2 font-medium">{val}</td>
                      <td className="py-1.5 px-2">
                        <span className={sweepResult.infeasible_rates[i] > 10 ? 'text-red-600' : ''}>
                          {sweepResult.infeasible_rates[i]}%
                        </span>
                      </td>
                      <td className="py-1.5 px-2">{sweepResult.stability_scores[i]}</td>
                      <td className="py-1.5 px-2">
                        {val === sweepResult.recommended_value && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">recommended</span>
                        )}
                        {sweepResult.infeasible_rates[i] > 15 && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">too strict</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
