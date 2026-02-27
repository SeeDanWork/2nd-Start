import { CSSProperties } from 'react';
import type { LedgerWindow } from '../../hooks/useLedgerData';

interface Props {
  windows: LedgerWindow[];
}

export function FairnessGauge({ windows }: Props) {
  if (windows.length === 0) {
    return <p style={styles.empty}>No ledger data</p>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>Overnight Split</div>
      {windows.map((w) => (
        <div key={w.windowWeeks} style={styles.row}>
          <span style={styles.label}>{w.windowWeeks}w</span>
          <div style={styles.barContainer}>
            <div
              style={{
                ...styles.barA,
                width: `${w.parentA.pct}%`,
              }}
            />
            <div
              style={{
                ...styles.barB,
                width: `${w.parentB.pct}%`,
              }}
            />
          </div>
          <span style={styles.pct}>
            {Math.round(w.parentA.pct)}–{Math.round(w.parentB.pct)}
          </span>
        </div>
      ))}
      <div style={styles.legend}>
        <span style={{ ...styles.legendDot, backgroundColor: '#ffedd0' }} /> Father
        <span style={{ ...styles.legendDot, backgroundColor: '#dcfee5', marginLeft: 12 }} /> Mother
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
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  label: {
    width: 24,
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textAlign: 'right' as const,
  },
  barContainer: {
    flex: 1,
    display: 'flex',
    height: 14,
    borderRadius: 3,
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
  },
  barA: {
    backgroundColor: '#ffedd0',
    height: '100%',
  },
  barB: {
    backgroundColor: '#dcfee5',
    height: '100%',
  },
  pct: {
    width: 44,
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#9ca3af',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 4,
    fontSize: 10,
    color: '#6b7280',
  },
  legendDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 3,
  },
  empty: {
    color: '#9ca3af',
    fontSize: 12,
  },
};
