import { useEffect, useState, CSSProperties } from 'react';
import { useViewer } from './ViewerLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface MetricsData {
  fairnessSplit?: { parentA: number; parentB: number };
  transitionsPerWeek?: number;
  stabilityScore?: number;
  weekendBalance?: { parentA: number; parentB: number };
  maxConsecutiveA?: number;
  maxConsecutiveB?: number;
  parentAName?: string;
  parentBName?: string;
}

export function MetricsViewer() {
  const { familyId, token } = useViewer();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/families/${familyId}/today`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data) => setMetrics(data))
      .catch(() => setError(true));
  }, [familyId, token]);

  if (error) {
    return <p style={styles.noData}>Metrics not available.</p>;
  }

  if (!metrics) {
    return <p style={styles.loading}>Loading metrics...</p>;
  }

  const parentALabel = metrics.parentAName || 'Parent A';
  const parentBLabel = metrics.parentBName || 'Parent B';

  const cards = [
    {
      label: 'Fairness Split',
      value: metrics.fairnessSplit
        ? `${metrics.fairnessSplit.parentA}% / ${metrics.fairnessSplit.parentB}%`
        : '--',
    },
    {
      label: 'Transitions per Week',
      value: metrics.transitionsPerWeek ?? '--',
    },
    {
      label: 'Stability Score',
      value: metrics.stabilityScore ?? '--',
    },
    {
      label: 'Weekend Balance',
      value: metrics.weekendBalance
        ? `${metrics.weekendBalance.parentA}% / ${metrics.weekendBalance.parentB}%`
        : '--',
    },
    {
      label: `Max Consecutive (${parentALabel})`,
      value: metrics.maxConsecutiveA != null ? `${metrics.maxConsecutiveA} days` : '--',
    },
    {
      label: `Max Consecutive (${parentBLabel})`,
      value: metrics.maxConsecutiveB != null ? `${metrics.maxConsecutiveB} days` : '--',
    },
  ];

  return (
    <div>
      <h2 style={styles.heading}>Family Metrics</h2>
      <div style={styles.grid}>
        {cards.map((card) => (
          <div key={card.label} style={styles.card}>
            <div style={styles.cardLabel}>{card.label}</div>
            <div style={styles.cardValue}>{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  noData: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
    padding: 40,
  },
  loading: {
    color: '#6b7280',
    fontSize: 14,
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
    maxWidth: 700,
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '16px 20px',
    backgroundColor: '#ffffff',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1f2937',
  },
};
