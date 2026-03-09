import { useEffect, useState, CSSProperties } from 'react';
import { useViewer } from './ViewerLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface AuditEntry {
  id: string;
  action: string;
  details?: string;
  createdAt: string;
  userName?: string;
}

export function HistoryViewer() {
  const { familyId, token } = useViewer();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/viewer/${token}/history`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((resp) => {
        const data = resp.data ?? resp;
        setEntries(Array.isArray(data) ? data : data.entries ?? []);
        setLoaded(true);
      })
      .catch(() => {
        setError(true);
        setLoaded(true);
      });
  }, [familyId, token]);

  if (!loaded) {
    return <p style={styles.loading}>Loading history...</p>;
  }

  if (error || entries.length === 0) {
    return <p style={styles.noData}>No history available yet.</p>;
  }

  return (
    <div>
      <h2 style={styles.heading}>Activity History</h2>
      <div style={styles.timeline}>
        {entries.map((entry) => (
          <div key={entry.id} style={styles.entry}>
            <div style={styles.dot} />
            <div style={styles.entryContent}>
              <div style={styles.entryHeader}>
                <span style={styles.action}>{entry.action}</span>
                <span style={styles.timestamp}>
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              {entry.userName && (
                <div style={styles.user}>by {entry.userName}</div>
              )}
              {entry.details && (
                <div style={styles.details}>{entry.details}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  loading: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    padding: 40,
  },
  noData: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
    padding: 40,
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: 16,
    marginTop: 0,
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    maxWidth: 600,
    borderLeft: '2px solid #e5e7eb',
    marginLeft: 8,
    paddingLeft: 20,
  },
  entry: {
    display: 'flex',
    alignItems: 'flex-start',
    position: 'relative',
    paddingBottom: 16,
  },
  dot: {
    position: 'absolute',
    left: -26,
    top: 6,
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#4A90D9',
    border: '2px solid #ffffff',
  },
  entryContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  entryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  action: {
    fontWeight: 600,
    fontSize: 14,
    color: '#1f2937',
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  user: {
    fontSize: 12,
    color: '#6b7280',
  },
  details: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 2,
  },
};
