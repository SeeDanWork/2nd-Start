import { CSSProperties } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ViewerLayout } from './components/viewer/ViewerLayout';
import { ScheduleViewer } from './components/viewer/ScheduleViewer';
import { MetricsViewer } from './components/viewer/MetricsViewer';
import { HistoryViewer } from './components/viewer/HistoryViewer';

function Landing() {
  return (
    <div style={styles.landing}>
      <h1 style={styles.title}>ADCP Schedule Viewer</h1>
      <p style={styles.subtitle}>
        Access your schedule via the link sent to your phone.
      </p>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
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
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1f2937',
    margin: 0,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    margin: 0,
  },
};
