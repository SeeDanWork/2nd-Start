import { CSSProperties } from 'react';
import { useScheduleData } from '../../hooks/useScheduleData';
import { CalendarMonth } from './CalendarMonth';

interface Props {
  familyId: string;
  token: string;
}

export function MonthlyCalendar({ familyId, token }: Props) {
  const { days, loading, error } = useScheduleData(familyId, token);

  if (loading) return <p style={styles.status}>Loading...</p>;
  if (error) return <p style={styles.error}>{error}</p>;
  if (days.length === 0) return <p style={styles.status}>No schedule data yet.</p>;

  // Build assignment map
  const assignments = new Map<string, string>();
  for (const d of days) {
    assignments.set(d.date, d.assignedTo);
  }

  // Generate 6 months starting from current month
  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div style={styles.container}>
      {months.map(({ year, month }) => (
        <CalendarMonth
          key={`${year}-${month}`}
          year={year}
          month={month}
          assignments={assignments}
        />
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    padding: 4,
  },
  status: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center' as const,
    padding: 24,
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center' as const,
    padding: 24,
  },
};
