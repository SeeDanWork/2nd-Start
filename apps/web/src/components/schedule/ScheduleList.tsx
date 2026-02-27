import { CSSProperties } from 'react';
import { useScheduleData } from '../../hooks/useScheduleData';
import { ScheduleRow } from './ScheduleRow';

interface Props {
  familyId: string;
  token: string;
}

export function ScheduleList({ familyId, token }: Props) {
  const { days, loading, error } = useScheduleData(familyId, token);

  if (loading) {
    return <p style={styles.status}>Loading schedule...</p>;
  }

  if (error) {
    return <p style={styles.error}>{error}</p>;
  }

  if (days.length === 0) {
    return <p style={styles.status}>No schedule data yet. Generate a schedule via chat.</p>;
  }

  return (
    <div style={styles.list}>
      {days.map((day, i) => (
        <ScheduleRow key={day.date} day={day} prevDay={i > 0 ? days[i - 1] : undefined} />
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
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
