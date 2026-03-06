import { CSSProperties } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ViewerLayout } from './components/viewer/ViewerLayout';
import { ScheduleViewer } from './components/viewer/ScheduleViewer';
import { MetricsViewer } from './components/viewer/MetricsViewer';
import { HistoryViewer } from './components/viewer/HistoryViewer';
import { SmsSimulator } from './components/simulator/SmsSimulator';

function Landing() {
  return (
    <div style={styles.landing}>
      <h1 style={styles.title}>ADCP</h1>
      <p style={styles.subtitle}>Anti-Drama Co-Parenting</p>
      <div style={styles.actions}>
        <a href="/simulator" style={styles.primaryBtn}>SMS Simulator</a>
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
