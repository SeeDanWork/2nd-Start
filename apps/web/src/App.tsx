import { useState, CSSProperties } from 'react';
import { DeterministicView } from './components/deterministic/DeterministicView';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ViewerLayout } from './components/viewer/ViewerLayout';
import { ScheduleViewer } from './components/viewer/ScheduleViewer';
import { MetricsViewer } from './components/viewer/MetricsViewer';
import { HistoryViewer } from './components/viewer/HistoryViewer';
import { SmsSimulator } from './components/simulator/SmsSimulator';
import { ScenarioLab } from './components/scenario-lab/ScenarioLab';

type TabId = 'deterministic' | 'scenario-lab';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'deterministic', label: 'Deterministic Model' },
  { id: 'scenario-lab', label: 'Scenario Lab' },
];

function DevHarness() {
  const [activeTab, setActiveTab] = useState<TabId>('scenario-lab');

  if (activeTab === 'scenario-lab') {
    return (
      <div style={styles.root}>
        <div style={styles.toolbar}>
          <span style={styles.toolbarTitle}>ADCP Web Harness</span>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              style={activeTab === tab.id ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ScenarioLab />
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>ADCP Web Harness</span>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            style={activeTab === tab.id ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <DeterministicView />
    </div>
  );
}

function Landing() {
  return (
    <div style={styles.landing}>
      <h1 style={styles.title}>ADCP</h1>
      <p style={styles.subtitle}>Anti-Drama Co-Parenting</p>
      <div style={styles.actions}>
        <a href="/simulator" style={styles.primaryBtn}>SMS Simulator</a>
        <a href="/harness" style={styles.primaryBtn}>Dev Harness</a>
        <p style={styles.hint}>Or open a schedule link sent to your phone</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/simulator" element={<SmsSimulator />} />
        <Route path="/harness" element={<DevHarness />} />
        <Route path="/view/:familyId/:token" element={<ViewerLayout />}>
          <Route index element={<ScheduleViewer />} />
          <Route path="metrics" element={<MetricsViewer />} />
          <Route path="history" element={<HistoryViewer />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8f9fa',
    flexShrink: 0,
  },
  toolbarTitle: {
    fontWeight: 700,
    fontSize: 15,
    marginRight: 8,
  },
  tab: {
    padding: '4px 14px',
    backgroundColor: 'transparent',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 4,
    cursor: 'pointer',
  },
  tabActive: {
    padding: '4px 14px',
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: '1px solid #4A90D9',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 4,
    cursor: 'pointer',
  },
  landing: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    color: '#1a1a2e',
    margin: 0,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    margin: 0,
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  primaryBtn: {
    padding: '14px 32px',
    fontSize: 16,
    fontWeight: 700,
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    margin: 0,
  },
};
