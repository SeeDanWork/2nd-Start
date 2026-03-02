import { CSSProperties } from 'react';

export interface ScheduleDay {
  date: string;
  assignedTo: 'parent_a' | 'parent_b';
  source: string;
}

const PARENT_COLORS: Record<string, string> = {
  parent_a: '#ffedd0',
  parent_b: '#dcfee5',
};

const PARENT_LABELS: Record<string, string> = {
  parent_a: 'Father',
  parent_b: 'Mother',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

interface Props {
  days: ScheduleDay[];
}

export function DeterministicSchedule({ days }: Props) {
  if (days.length === 0) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>Schedule List</div>
        <div style={styles.content}>
          <p style={styles.placeholder}>Paste a family description and click Compute</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Schedule List ({days.length} days)</div>
      <div style={styles.content}>
        {days.map((day, i) => {
          const prev = i > 0 ? days[i - 1] : undefined;
          const isTransition = prev && prev.assignedTo !== day.assignedTo;
          const bg = PARENT_COLORS[day.assignedTo] || '#f3f4f6';

          return (
            <div key={day.date} style={{ ...styles.row, backgroundColor: bg }}>
              {isTransition && <div style={styles.transitionDot} />}
              <span style={styles.date}>{formatDate(day.date)}</span>
              <span style={styles.label}>{PARENT_LABELS[day.assignedTo] || day.assignedTo}</span>
              <span style={styles.source}>{day.source}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 240,
    borderRight: '1px solid #e5e7eb',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8f9fa',
    fontWeight: 600,
    fontSize: 13,
  },
  content: {
    padding: 8,
  },
  placeholder: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center' as const,
    padding: 24,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 36,
    padding: '0 10px',
    borderRadius: 4,
    marginBottom: 2,
    fontSize: 12,
    position: 'relative' as const,
  },
  date: {
    fontWeight: 600,
    minWidth: 90,
  },
  label: {
    flex: 1,
  },
  source: {
    color: '#9ca3af',
    fontSize: 10,
    textTransform: 'uppercase' as const,
  },
  transitionDot: {
    position: 'absolute' as const,
    left: 2,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 4,
    height: 4,
    borderRadius: '50%',
    backgroundColor: '#ef4444',
  },
};
