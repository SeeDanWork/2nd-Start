import { CSSProperties } from 'react';

const PARENT_COLORS: Record<string, string> = {
  parent_a: '#ffedd0',
  parent_b: '#dcfee5',
};

interface Props {
  dayOfMonth: number | null;
  assignedTo?: string;
  isToday?: boolean;
}

export function CalendarDay({ dayOfMonth, assignedTo, isToday }: Props) {
  if (dayOfMonth === null) {
    return <div style={styles.empty} />;
  }

  const bg = assignedTo ? (PARENT_COLORS[assignedTo] || '#f3f4f6') : '#fff';

  return (
    <div
      style={{
        ...styles.cell,
        backgroundColor: bg,
        ...(isToday ? styles.today : {}),
      }}
    >
      {dayOfMonth}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    fontSize: 11,
    borderRadius: 3,
    fontWeight: 500,
  },
  empty: {
    height: 28,
  },
  today: {
    outline: '2px solid #4A90D9',
    outlineOffset: -1,
    fontWeight: 700,
  },
};
