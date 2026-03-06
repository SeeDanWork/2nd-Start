import { useState, CSSProperties } from 'react';
import { DeterministicView } from './components/deterministic/DeterministicView';
import { ScenarioLab } from './components/scenario-lab/ScenarioLab';

type TabId = 'deterministic' | 'scenario-lab';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'deterministic', label: 'Deterministic Model' },
  { id: 'scenario-lab', label: 'Scenario Lab' },
];

export function App() {
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
};
