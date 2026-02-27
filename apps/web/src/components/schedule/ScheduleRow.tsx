import { CSSProperties } from 'react';
import type { ScheduleDay } from '../../hooks/useScheduleData';

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
  day: ScheduleDay;
  prevDay?: ScheduleDay;
}

export function ScheduleRow({ day, prevDay }: Props) {
  const isTransition = prevDay && prevDay.assignedTo !== day.assignedTo;
  const bg = PARENT_COLORS[day.assignedTo] || '#f3f4f6';

  return (
    <div style={{ ...styles.row, backgroundColor: bg }}>
      {isTransition && <div style={styles.transitionDot} />}
      <span style={styles.date}>{formatDate(day.date)}</span>
      <span style={styles.label}>{PARENT_LABELS[day.assignedTo] || day.assignedTo}</span>
      {day.source && <span style={styles.source}>{day.source}</span>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 36,
    padding: '0 10px',
    borderRadius: 4,
    marginBottom: 2,
    fontSize: 12,
    position: 'relative',
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
