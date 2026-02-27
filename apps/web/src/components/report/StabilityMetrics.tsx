import { CSSProperties } from 'react';
import type { StabilityMetrics as Metrics } from '../../hooks/useStabilityData';

interface Props {
  metrics: Metrics | null;
  loading: boolean;
  error: string | null;
}

export function StabilityMetrics({ metrics, loading, error }: Props) {
  if (loading) return <p style={styles.status}>Loading stability...</p>;
  if (error) return <p style={styles.error}>{error}</p>;
  if (!metrics) return <p style={styles.status}>No stability data</p>;

  const items = [
    { label: 'Transitions (8w)', value: metrics.transitions },
    { label: 'Avg Consecutive', value: metrics.avgConsecutiveNights.toFixed(1) },
    { label: 'Max Consecutive', value: metrics.maxConsecutiveNights },
    {
      label: 'School Night Consistency',
      value: `${Math.round(metrics.schoolNightConsistency * 100)}%`,
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.title}>Stability (8 weeks)</div>
      <div style={styles.grid}>
        {items.map((item) => (
          <div key={item.label} style={styles.card}>
            <div style={styles.cardValue}>{item.value}</div>
            <div style={styles.cardLabel}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
  },
  card: {
    padding: '8px 10px',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  cardLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  status: {
    color: '#9ca3af',
    fontSize: 12,
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
  },
};
