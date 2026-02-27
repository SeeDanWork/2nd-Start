import { CSSProperties } from 'react';

interface Props {
  profile: string | null;
  weights: Record<string, number> | null;
}

const WEIGHT_LABELS: Record<string, string> = {
  fairnessDeviation: 'Fairness',
  totalTransitions: 'Transitions',
  nonDaycareHandoffs: 'Handoffs',
  weekendFragmentation: 'Weekends',
  schoolNightDisruption: 'School Nights',
};

export function WeightProfile({ profile, weights }: Props) {
  if (!profile && !weights) {
    return <p style={styles.empty}>No solver metadata available</p>;
  }

  const maxWeight = weights
    ? Math.max(...Object.values(weights), 1)
    : 100;

  return (
    <div style={styles.container}>
      {profile && (
        <div style={styles.profileBadge}>
          Profile: <strong>{profile}</strong>
        </div>
      )}
      {weights && (
        <div style={styles.bars}>
          {Object.entries(weights).map(([key, value]) => (
            <div key={key} style={styles.barRow}>
              <span style={styles.barLabel}>{WEIGHT_LABELS[key] || key}</span>
              <div style={styles.barTrack}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${(value / maxWeight) * 100}%`,
                  }}
                />
              </div>
              <span style={styles.barValue}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    marginBottom: 16,
  },
  profileBadge: {
    fontSize: 12,
    marginBottom: 8,
    padding: '4px 8px',
    backgroundColor: '#ede9fe',
    borderRadius: 4,
    display: 'inline-block',
  },
  bars: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
  },
  barLabel: {
    width: 80,
    flexShrink: 0,
    color: '#6b7280',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#7B61C1',
    borderRadius: 4,
    transition: 'width 0.3s',
  },
  barValue: {
    width: 30,
    textAlign: 'right' as const,
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#9ca3af',
  },
  empty: {
    color: '#9ca3af',
    fontSize: 12,
  },
};
