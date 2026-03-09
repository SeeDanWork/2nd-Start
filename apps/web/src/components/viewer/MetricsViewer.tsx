import { useEffect, useState, CSSProperties } from 'react';
import { useViewer } from './ViewerLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface MetricsData {
  parentANights: number;
  parentBNights: number;
  parentAPercent: number;
  parentBPercent: number;
  transitionsPerWeek: number;
  maxConsecutiveA: number;
  maxConsecutiveB: number;
  totalDays: number;
}

export function MetricsViewer() {
  const { token } = useViewer();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/viewer/${token}/metrics`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((resp) => setMetrics(resp.data ?? resp))
      .catch(() => setError(true));
  }, [token]);

  if (error) {
    return <p style={styles.noData}>Metrics not available.</p>;
  }

  if (!metrics) {
    return <p style={styles.loading}>Loading metrics...</p>;
  }

  const cards = [
    {
      label: 'Fairness Split',
      value: `${metrics.parentAPercent}% / ${metrics.parentBPercent}%`,
    },
    {
      label: 'Parent A Nights',
      value: metrics.parentANights,
    },
    {
      label: 'Parent B Nights',
      value: metrics.parentBNights,
    },
    {
      label: 'Transitions / Week',
      value: metrics.transitionsPerWeek,
    },
    {
      label: 'Max Consecutive (A)',
      value: `${metrics.maxConsecutiveA} days`,
    },
    {
      label: 'Max Consecutive (B)',
      value: `${metrics.maxConsecutiveB} days`,
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
