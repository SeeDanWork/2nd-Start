import { useEffect, CSSProperties } from 'react';
import { useHarnessStore } from './stores/harness';
import { useIframeMessages } from './hooks/useIframeMessages';
import { ChatIframe } from './components/chat/ChatIframe';
import { ScheduleList } from './components/schedule/ScheduleList';
import { MonthlyCalendar } from './components/calendar/MonthlyCalendar';
import { DecisionReport } from './components/report/DecisionReport';

export function App() {
  const { father, mother, familyId, isSettingUp, error, setup, refresh } =
    useHarnessStore();

  useIframeMessages();

  useEffect(() => {
    setup();
  }, [setup]);

  if (isSettingUp) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.setupText}>Authenticating test users via dev-login...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={styles.errorText}>Setup failed: {error}</p>
        <p style={styles.hintText}>
          Make sure the API is running at {import.meta.env.VITE_API_URL || 'http://localhost:3000'}{' '}
          with NODE_ENV=development
        </p>
        <button style={styles.retryButton} onClick={setup}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>ADCP Web Harness</span>
        {familyId && (
          <span style={styles.familyBadge}>Family: {familyId.slice(0, 8)}...</span>
        )}
        <button style={styles.refreshButton} onClick={refresh}>
          Refresh Panels
        </button>
      </div>

      {/* 5-panel layout */}
      <div style={styles.panels}>
        {/* Panel 1: Father Chat */}
        {father && (
          <ChatIframe
            role="father"
            accessToken={father.accessToken}
            refreshToken={father.refreshToken}
            displayName={father.displayName}
          />
        )}

        {/* Panel 2: Mother Chat */}
        {mother && (
          <ChatIframe
            role="mother"
            accessToken={mother.accessToken}
            refreshToken={mother.refreshToken}
            displayName={mother.displayName}
          />
        )}

        {/* Panel 3: Schedule List */}
        <div style={styles.dataPanel}>
          <div style={styles.panelHeader}>Schedule List</div>
          <div style={styles.panelContent}>
            {familyId ? (
              <ScheduleList familyId={familyId} token={father?.accessToken ?? ''} />
            ) : (
              <p style={styles.placeholder}>Complete onboarding in either chat to see schedule</p>
            )}
          </div>
        </div>

        {/* Panel 4: Monthly Calendar */}
        <div style={styles.dataPanel}>
          <div style={styles.panelHeader}>Monthly Calendar</div>
          <div style={styles.panelContent}>
            {familyId ? (
              <MonthlyCalendar familyId={familyId} token={father?.accessToken ?? ''} />
            ) : (
              <p style={styles.placeholder}>Waiting for family...</p>
            )}
          </div>
        </div>

        {/* Panel 5: Decision Report */}
        <div style={styles.dataPanel}>
          <div style={styles.panelHeader}>Decision Report</div>
          <div style={styles.panelContent}>
            {familyId ? (
              <DecisionReport familyId={familyId} token={father?.accessToken ?? ''} />
            ) : (
              <p style={styles.placeholder}>Waiting for family...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: 12,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e5e7eb',
    borderTopColor: '#4A90D9',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  setupText: {
    color: '#6b7280',
    fontSize: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: 600,
  },
  hintText: {
    color: '#6b7280',
    fontSize: 13,
    maxWidth: 400,
    textAlign: 'center' as const,
  },
  retryButton: {
    padding: '8px 20px',
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
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
  familyBadge: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#e5e7eb',
    padding: '2px 8px',
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  refreshButton: {
    marginLeft: 'auto',
    padding: '4px 12px',
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  panels: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  dataPanel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 240,
    borderRight: '1px solid #e5e7eb',
  },
  panelHeader: {
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8f9fa',
    fontWeight: 600,
    fontSize: 13,
  },
  panelContent: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
  },
  placeholder: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center' as const,
    padding: 24,
  },
};
