import { useState, CSSProperties } from 'react';
import { useScenarioStore } from '../../stores/scenario';
import { generateSchedule } from './scheduleEngine';
import { ScenarioControls } from './ScenarioControls';
import { CalendarView } from './CalendarView';
import { LLMChat } from './LLMChat';
import { DiagnosticsPanel } from './DiagnosticsPanel';

export function ScenarioLab() {
  const store = useScenarioStore();
  const [showControls, setShowControls] = useState(false);
  const [overlayToggles, setOverlayToggles] = useState({
    disruptions: true,
    transitions: true,
    fairness: true,
    templates: true,
  });

  function handleToggle(key: string) {
    setOverlayToggles((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  }

  function runSimulation() {
    store.setIsRunning(true);
    store.addEvent({
      id: `evt-sim-${Date.now()}`,
      timestamp: new Date().toISOString(),
      category: 'solver',
      message: 'Solver invoked',
      details: `Family: ${store.family.childCount} children, ${store.family.arrangement}`,
    });

    const { schedule, metrics, trace } = generateSchedule(
      store.family,
      store.constraints,
      store.disruptions,
      store.currentDate,
    );

    trace.runId = store.solverRunCount + 1;
    store.setSchedule(schedule);
    store.setMetrics(metrics);
    store.addSolverTrace(trace);

    store.addEvent({
      id: `evt-done-${Date.now()}`,
      timestamp: new Date().toISOString(),
      category: 'solver',
      message: `Solver complete: ${trace.status}`,
      details: `Penalty: ${trace.penaltyScore}, Template: ${trace.selectedTemplate}, ${trace.durationMs}ms`,
    });

    store.setIsRunning(false);
  }

  function handleReset() {
    store.reset();
    setOverlayToggles({ disruptions: true, transitions: true, fairness: true, templates: true });
  }

  const fairnessPercent = store.metrics.parentAPercent;
  const fairnessB = (100 - fairnessPercent).toFixed(1);

  return (
    <div style={s.root}>
      {/* Top toolbar */}
      <div style={s.toolbar}>
        <div style={s.toolbarLeft}>
          <button style={s.controlsBtn} onClick={() => setShowControls(true)}>
            &#9776; Controls
          </button>
          <span style={s.scenarioLabel}>{store.scenarioName}</span>
        </div>
        <div style={s.toolbarCenter}>
          <button style={s.actionBtn} onClick={() => {
            const name = prompt('Scenario name:', store.scenarioName);
            if (name) store.setScenarioName(name);
          }}>Save</button>
          <button style={{ ...s.actionBtn, ...s.resetBtn }} onClick={handleReset}>Reset</button>
          <button
            style={{ ...s.runBtn, opacity: store.isRunning ? 0.6 : 1 }}
            onClick={runSimulation}
            disabled={store.isRunning}
          >
            {store.isRunning ? 'Running...' : 'Run Simulation'}
          </button>
        </div>
        <div style={s.toolbarRight}>
          {store.schedule.length > 0 && (
            <>
              <div style={s.statChip}>
                <span style={s.statLabel}>Fairness:</span>
                <span style={{
                  ...s.statValue,
                  color: Math.abs(fairnessPercent - 50) <= 5 ? '#16a34a' : '#ef4444',
                }}>
                  {fairnessPercent}% / {fairnessB}%
                </span>
              </div>
              <div style={s.statChip}>
                <span style={s.statLabel}>Trans/Wk:</span>
                <span style={s.statValue}>{store.metrics.transitionsPerWeek}</span>
              </div>
              <div style={s.statChip}>
                <span style={s.statLabel}>Stability:</span>
                <span style={s.statValue}>{store.metrics.stabilityScore.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Time travel bar */}
      <div style={s.timeBar}>
        <span style={s.timeLabel}>Date: {store.currentDate}</span>
        <input
          type="date"
          value={store.currentDate}
          onChange={(e) => store.setCurrentDate(e.target.value)}
          style={s.dateInput}
        />
        <button style={s.timeBtn} onClick={() => store.advanceDays(1)}>+1 Day</button>
        <button style={s.timeBtn} onClick={() => store.advanceDays(7)}>+1 Week</button>
        <button style={s.timeBtn} onClick={() => store.advanceDays(30)}>+1 Month</button>
        <button style={s.timeBtnJump} onClick={() => {
          const nextDis = store.disruptions
            .filter((d) => d.startDate > store.currentDate)
            .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
          if (nextDis) store.setCurrentDate(nextDis.startDate);
        }}>Jump to Disruption</button>
      </div>

      {/* Three-pane workspace: Parent A Chat | Calendar | Parent B Chat */}
      <div style={s.workspace}>
        <div style={s.chatPane}>
          <LLMChat parent="a" />
        </div>
        <div style={s.calendarPane}>
          <CalendarView overlayToggles={overlayToggles} onToggle={handleToggle} />
        </div>
        <div style={s.chatPane}>
          <LLMChat parent="b" />
        </div>
      </div>

      {/* Diagnostics */}
      <DiagnosticsPanel />

      {/* Scenario Controls overlay */}
      <ScenarioControls open={showControls} onClose={() => setShowControls(false)} />
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  // Toolbar
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    flexShrink: 0,
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  controlsBtn: {
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: '#334155',
    color: '#fff',
    border: '1px solid #475569',
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  scenarioLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: 600,
  },
  toolbarCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    padding: '5px 14px',
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: '#334155',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  resetBtn: {
    backgroundColor: '#64748b',
  },
  runBtn: {
    padding: '6px 20px',
    fontSize: 12,
    fontWeight: 700,
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  statChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 500,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#fff',
  },
  // Time bar
  timeBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 12px',
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#374151',
    fontFamily: 'monospace',
  },
  dateInput: {
    padding: '3px 6px',
    fontSize: 11,
    border: '1px solid #d1d5db',
    borderRadius: 3,
  },
  timeBtn: {
    padding: '3px 10px',
    fontSize: 10,
    fontWeight: 600,
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: 3,
    cursor: 'pointer',
    color: '#374151',
  },
  timeBtnJump: {
    padding: '3px 10px',
    fontSize: 10,
    fontWeight: 600,
    backgroundColor: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: 3,
    cursor: 'pointer',
    color: '#92400e',
  },
  // Workspace
  workspace: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  chatPane: {
    display: 'flex',
    flexDirection: 'column',
    width: 300,
    minWidth: 260,
    borderRight: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  calendarPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
};
