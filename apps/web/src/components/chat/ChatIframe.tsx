import { CSSProperties } from 'react';

interface ChatIframeProps {
  role: 'father' | 'mother';
  accessToken: string;
  refreshToken: string;
  displayName: string;
}

const EXPO_WEB_URL = import.meta.env.VITE_EXPO_WEB_URL || 'http://localhost:8081';

const headerColors: Record<string, string> = {
  father: '#ffedd0',
  mother: '#dcfee5',
};

const headerLabels: Record<string, string> = {
  father: 'Father',
  mother: 'Mother',
};

export function ChatIframe({ role, accessToken, refreshToken, displayName }: ChatIframeProps) {
  const src = `${EXPO_WEB_URL}?storagePrefix=${role}_&devToken=${encodeURIComponent(accessToken)}&devRefresh=${encodeURIComponent(refreshToken)}`;

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, backgroundColor: headerColors[role] }}>
        <span style={styles.headerLabel}>{headerLabels[role]}</span>
        <span style={styles.headerName}>{displayName}</span>
      </div>
      <iframe
        src={src}
        style={styles.iframe}
        title={`${role}-chat`}
        allow="clipboard-write"
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: 393,
    minWidth: 393,
    height: '100%',
    borderRight: '1px solid #e5e7eb',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 600,
    fontSize: 13,
  },
  headerLabel: {
    fontWeight: 700,
  },
  headerName: {
    color: '#6b7280',
    fontWeight: 400,
  },
  iframe: {
    flex: 1,
    border: 'none',
    width: '100%',
  },
};
