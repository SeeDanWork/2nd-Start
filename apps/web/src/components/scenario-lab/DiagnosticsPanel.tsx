import { CSSProperties } from 'react';
import { useScenarioStore } from '../../stores/scenario';

const TABS = [
  { id: 'metrics' as const, label: 'Metrics' },
  { id: 'solver' as const, label: 'Solver Trace' },
  { id: 'log' as const, label: 'Event Log' },
  { id: 'constraints' as const, label: 'Constraint Graph' },
];

export function DiagnosticsPanel() {
  const {
    activeBottomTab,
    setActiveBottomTab,
    metrics,
    solverTraces,
    eventLog,
    constraints,
    family,
    schedule,
  } = useScenarioStore();

  return (
    <div style={s.root}>
      {/* Tab bar */}
      <div style={s.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...s.tab,
              ...(activeBottomTab === tab.id ? s.tabActive : {}),
            }}
            onClick={() => setActiveBottomTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <div style={s.tabSpacer} />
        {solverTraces.length > 0 && (
          <div style={s.solverBadge}>
            Solver Run #{solverTraces[solverTraces.length - 1].runId}
          </div>
        )}
      </div>

      {/* Tab content */}
      <div style={s.content}>
        {activeBottomTab === 'metrics' && <MetricsTab />}
        {activeBottomTab === 'solver' && <SolverTab />}
        {activeBottomTab === 'log' && <LogTab />}
        {activeBottomTab === 'constraints' && <ConstraintTab />}
      </div>
    </div>
  );
}

function MetricsTab() {
  const { metrics, family, schedule } = useScenarioStore();
  const fairnessOk = Math.abs(metrics.parentAPercent - family.targetSplit) <= 5;

  if (schedule.length === 0) {
    return <div style={s.emptyMsg}>Run simulation to see metrics</div>;
  }

  return (
    <div style={s.metricsGrid}>
      <MetricCard
        label="Fairness Balance"
        value={`Parent A: ${metrics.parentAPercent}%`}
        sub={`Parent B: ${(100 - metrics.parentAPercent).toFixed(1)}%`}
        color={fairnessOk ? '#16a34a' : '#ef4444'}
      />
      <MetricCard
        label="Transitions / Week"
        value={String(metrics.transitionsPerWeek)}
        sub="avg"
        color="#4A90D9"
      />
      <MetricCard
        label="Max Consecutive"
        value={`A: ${metrics.maxConsecutiveA}`}
        sub={`B: ${metrics.maxConsecutiveB}`}
        color="#8b5cf6"
      />
      <MetricCard
        label="Weekend Balance"
        value={`A: ${metrics.weekendBalanceA}%`}
        sub={`B: ${metrics.weekendBalanceB}%`}
        color="#f59e0b"
      />
      <MetricCard
        label="Stability Score"
        value={metrics.stabilityScore.toFixed(2)}
        sub="0=unstable, 1=stable"
        color="#22c55e"
      />
      <MetricCard
        label="Total Nights"
        value={`A: ${metrics.parentANights}`}
        sub={`B: ${metrics.parentBNights}`}
        color="#6366f1"
      />
    </div>
  );
}

function MetricCard({ label, value, sub, color }: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div style={s.metricCard}>
      <div style={s.metricLabel}>{label}</div>
      <div style={{ ...s.metricValue, color }}>{value}</div>
      <div style={s.metricSub}>{sub}</div>
    </div>
  );
}

function SolverTab() {
  const { solverTraces } = useScenarioStore();

  if (solverTraces.length === 0) {
    return <div style={s.emptyMsg}>No solver runs yet</div>;
  }

  const latest = solverTraces[solverTraces.length - 1];

  return (
    <div style={s.solverGrid}>
      <div style={s.solverMain}>
        <div style={s.solverRow}>
          <span style={s.solverLabel}>Solver Run</span>
          <span style={s.solverVal}>#{latest.runId}</span>
        </div>
        <div style={s.solverRow}>
          <span style={s.solverLabel}>Status</span>
          <span style={{
            ...s.solverVal,
            color: latest.status === 'optimal' ? '#16a34a' : '#f59e0b',
          }}>{latest.status.toUpperCase()}</span>
        </div>
        <div style={s.solverRow}>
          <span style={s.solverLabel}>Penalty Score</span>
          <span style={s.solverVal}>{latest.penaltyScore}</span>
        </div>
        <div style={s.solverRow}>
          <span style={s.solverLabel}>Selected Template</span>
          <span style={s.solverVal}>{latest.selectedTemplate}</span>
        </div>
        <div style={s.solverRow}>
          <span style={s.solverLabel}>Duration</span>
          <span style={s.solverVal}>{latest.durationMs}ms</span>
        </div>
      </div>
      <div style={s.solverTieBreak}>
        <div style={s.solverTieTitle}>Tie-Break Ranking</div>
        {latest.tieBreakRanking.map((r, i) => (
          <div key={i} style={s.tierItem}>
            <span style={s.tierRank}>#{i + 1}</span>
            <span style={s.tierName}>{r}</span>
          </div>
        ))}
      </div>
      <div style={s.solverHistory}>
        <div style={s.solverTieTitle}>Run History ({solverTraces.length})</div>
        <div style={s.historyList}>
          {solverTraces.slice(-10).reverse().map((t) => (
            <div key={t.runId} style={s.historyItem}>
              <span style={s.historyRun}>#{t.runId}</span>
              <span style={s.historyPenalty}>P:{t.penaltyScore}</span>
              <span style={s.historyStatus}>{t.status}</span>
              <span style={s.historyTime}>{t.durationMs}ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LogTab() {
  const { eventLog, clearLog } = useScenarioStore();

  if (eventLog.length === 0) {
    return <div style={s.emptyMsg}>No events logged</div>;
  }

  const CATEGORY_COLORS: Record<string, string> = {
    disruption: '#f59e0b',
    solver: '#4A90D9',
    proposal: '#8b5cf6',
    mediation: '#22c55e',
    system: '#6b7280',
  };

  return (
    <div style={s.logContainer}>
      <div style={s.logHeader}>
        <span style={s.logCount}>{eventLog.length} events</span>
        <button style={s.logClear} onClick={clearLog}>Clear</button>
      </div>
      <div style={s.logList}>
        {eventLog.slice().reverse().map((e) => (
          <div key={e.id} style={s.logEntry}>
            <span
              style={{
                ...s.logCategory,
                backgroundColor: CATEGORY_COLORS[e.category] ?? '#6b7280',
              }}
            >
              {e.category}
            </span>
            <span style={s.logMsg}>{e.message}</span>
            {e.details && <span style={s.logDetails}>{e.details}</span>}
            <span style={s.logTime}>
              {new Date(e.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConstraintTab() {
  const { constraints, metrics, schedule } = useScenarioStore();

  if (schedule.length === 0) {
    return <div style={s.emptyMsg}>Run simulation to see constraint analysis</div>;
  }

  const checks = [
    {
      label: `Max consecutive <= ${constraints.maxConsecutive}`,
      valueA: metrics.maxConsecutiveA,
      valueB: metrics.maxConsecutiveB,
      ok: metrics.maxConsecutiveA <= constraints.maxConsecutive && metrics.maxConsecutiveB <= constraints.maxConsecutive,
    },
    {
      label: `Transitions/week <= ${constraints.maxTransitionsPerWeek}`,
      valueA: metrics.transitionsPerWeek,
      ok: metrics.transitionsPerWeek <= constraints.maxTransitionsPerWeek,
    },
    {
      label: `Fairness within +/- ${constraints.fairnessBand}%`,
      valueA: metrics.parentAPercent,
      ok: Math.abs(metrics.parentAPercent - 50) <= constraints.fairnessBand,
    },
  ];

  return (
    <div style={s.constraintList}>
      {checks.map((c, i) => (
        <div key={i} style={{ ...s.constraintRow, borderLeftColor: c.ok ? '#22c55e' : '#ef4444' }}>
          <span style={{ ...s.constraintStatus, color: c.ok ? '#16a34a' : '#ef4444' }}>
            {c.ok ? 'PASS' : 'FAIL'}
          </span>
          <span style={s.constraintLabel}>{c.label}</span>
          <span style={s.constraintValue}>
            A: {typeof c.valueA === 'number' ? c.valueA : '-'}
            {c.valueB != null ? ` / B: ${c.valueB}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: 200,
    borderTop: '2px solid #e5e7eb',
    backgroundColor: '#fafafa',
    flexShrink: 0,
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    padding: '0 8px',
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  tab: {
    padding: '6px 14px',
    fontSize: 11,
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  tabActive: {
    color: '#4A90D9',
    fontWeight: 700,
    borderBottomColor: '#4A90D9',
    backgroundColor: '#fff',
  },
  tabSpacer: { flex: 1 },
  solverBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: '#6b7280',
    fontFamily: 'monospace',
    padding: '2px 8px',
    backgroundColor: '#fff',
    borderRadius: 4,
    border: '1px solid #e5e7eb',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
  },
  emptyMsg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
    fontSize: 12,
  },
  // Metrics
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 8,
    height: '100%',
  },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '8px 10px',
    backgroundColor: '#fff',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: 'monospace',
    lineHeight: '20px',
  },
  metricSub: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 2,
  },
  // Solver
  solverGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
    height: '100%',
  },
  solverMain: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  },
  solverRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 11,
  },
  solverLabel: {
    color: '#6b7280',
  },
  solverVal: {
    fontWeight: 600,
    fontFamily: 'monospace',
    color: '#1a1a2e',
  },
  solverTieBreak: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  },
  solverTieTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#6b7280',
    marginBottom: 6,
  },
  tierItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    padding: '2px 0',
  },
  tierRank: {
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#4A90D9',
    width: 20,
  },
  tierName: {
    color: '#374151',
  },
  solverHistory: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    overflow: 'auto',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  historyItem: {
    display: 'flex',
    gap: 8,
    fontSize: 9,
    fontFamily: 'monospace',
    padding: '2px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  historyRun: { color: '#4A90D9', fontWeight: 600, width: 24 },
  historyPenalty: { color: '#374151', width: 40 },
  historyStatus: { color: '#22c55e', width: 50 },
  historyTime: { color: '#9ca3af' },
  // Log
  logContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logCount: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 600,
  },
  logClear: {
    padding: '2px 8px',
    fontSize: 9,
    color: '#ef4444',
    backgroundColor: 'transparent',
    border: '1px solid #fca5a5',
    borderRadius: 3,
    cursor: 'pointer',
  },
  logList: {
    flex: 1,
    overflow: 'auto',
  },
  logEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 10,
  },
  logCategory: {
    padding: '1px 5px',
    fontSize: 8,
    fontWeight: 700,
    color: '#fff',
    borderRadius: 3,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  logMsg: {
    flex: 1,
    color: '#374151',
  },
  logDetails: {
    color: '#9ca3af',
    fontFamily: 'monospace',
    fontSize: 9,
  },
  logTime: {
    color: '#9ca3af',
    fontSize: 9,
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  // Constraints
  constraintList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  constraintRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px',
    backgroundColor: '#fff',
    borderRadius: 4,
    border: '1px solid #e5e7eb',
    borderLeft: '3px solid',
    fontSize: 11,
  },
  constraintStatus: {
    fontWeight: 700,
    fontSize: 10,
    fontFamily: 'monospace',
    width: 32,
  },
  constraintLabel: {
    flex: 1,
    color: '#374151',
  },
  constraintValue: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#6b7280',
  },
};
