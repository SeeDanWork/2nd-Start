import { CSSProperties } from 'react';
import type { MilestoneSnapshot } from './milestones';

interface Props {
  milestones: MilestoneSnapshot[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function MilestoneSelector({ milestones, selectedIndex, onSelect }: Props) {
  if (milestones.length === 0) return null;

  const selected = milestones[selectedIndex];

  return (
    <div style={styles.bar}>
      <label style={styles.label}>Milestone:</label>
      <select
        style={styles.select}
        value={selectedIndex}
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        {milestones.map((m, i) => {
          const changeCount = m.changes.length;
          const suffix = i > 0 && changeCount > 0
            ? ` [${changeCount} change${changeCount !== 1 ? 's' : ''}]`
            : '';
          return (
            <option key={i} value={i}>
              {m.label} ({m.refDate}){suffix}
            </option>
          );
        })}
      </select>
      {selected && (
        <span style={styles.badge}>
          {selected.youngestBand} / {selected.weightProfile}
        </span>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
    fontSize: 12,
  },
  label: {
    fontWeight: 600,
    color: '#1a1a2e',
    whiteSpace: 'nowrap',
  },
  select: {
    padding: '4px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: 12,
    backgroundColor: '#fff',
    color: '#1a1a2e',
    cursor: 'pointer',
    outline: 'none',
  },
  badge: {
    padding: '2px 8px',
    backgroundColor: '#ede9fe',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 500,
    color: '#5b21b6',
    whiteSpace: 'nowrap',
  },
};
