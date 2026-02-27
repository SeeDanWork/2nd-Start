import { CSSProperties } from 'react';
import { CalendarDay } from './CalendarDay';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  year: number;
  month: number; // 0-indexed
  assignments: Map<string, string>; // date string → parent role
}

export function CalendarMonth({ year, month, assignments }: Props) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={styles.container}>
      <div style={styles.title}>
        {MONTH_NAMES[month]} {year}
      </div>
      <div style={styles.grid}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={styles.dayHeader}>
            {d}
          </div>
        ))}
        {cells.map((dayNum, i) => {
          const dateStr = dayNum
            ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
            : '';
          return (
            <CalendarDay
              key={i}
              dayOfMonth={dayNum}
              assignedTo={dateStr ? assignments.get(dateStr) : undefined}
              isToday={dateStr === todayStr}
            />
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    marginBottom: 16,
  },
  title: {
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 4,
    color: '#1a1a2e',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 1,
  },
  dayHeader: {
    textAlign: 'center' as const,
    fontSize: 10,
    fontWeight: 600,
    color: '#9ca3af',
    paddingBottom: 2,
  },
};
