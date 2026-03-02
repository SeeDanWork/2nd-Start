import { CSSProperties } from 'react';
import { DeterministicView } from './components/deterministic/DeterministicView';

export function App() {
  return (
    <div style={styles.root}>
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>ADCP Web Harness</span>
        <span style={styles.tabActive}>Deterministic Model</span>
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
    gap: 16,
    padding: '8px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8f9fa',
  },
  toolbarTitle: {
    fontWeight: 700,
    fontSize: 15,
  },
  tabActive: {
    padding: '4px 14px',
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: '1px solid #4A90D9',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 4,
  },
};
