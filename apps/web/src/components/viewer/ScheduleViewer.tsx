import { useEffect, useState, CSSProperties } from 'react';
import { useViewer } from './ViewerLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Assignment {
  date: string;
  parentId: string;
  isExchange?: boolean;
}

interface ScheduleData {
  parentAId?: string;
  parentBId?: string;
  parentAName?: string;
  parentBName?: string;
  assignments?: Assignment[];
}

export function ScheduleViewer() {
  const { familyId, token } = useViewer();
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [error, setError] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetch(`${API_BASE}/families/${familyId}/schedules/active`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data) => setSchedule(data))
      .catch(() => setError(true));
  }, [familyId, token]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  if (error) {
    return <p style={styles.noData}>No schedule available.</p>;
  }

  if (!schedule) {
    return <p style={styles.loading}>Loading schedule...</p>;
  }

  // Build the calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a map of date string -> assignment
  const assignmentMap = new Map<string, Assignment>();
  if (schedule.assignments) {
    for (const a of schedule.assignments) {
      assignmentMap.set(a.date, a);
    }
  }

  const cells: Array<{ day: number; assignment?: Assignment } | null> = [];
  // Leading empty cells
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, assignment: assignmentMap.get(dateStr) });
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  return (
    <div>
      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendSwatch, backgroundColor: '#ffedd0' }} />
          {schedule.parentAName || 'Parent A'}
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendSwatch, backgroundColor: '#dcfee5' }} />
          {schedule.parentBName || 'Parent B'}
        </span>
      </div>

      {/* Month nav */}
      <div style={styles.monthNav}>
        <button style={styles.navButton} onClick={prevMonth}>&larr;</button>
        <span style={styles.monthLabel}>{monthName} {year}</span>
        <button style={styles.navButton} onClick={nextMonth}>&rarr;</button>
      </div>

      {/* Day headers */}
      <div style={styles.grid}>
        {DAY_LABELS.map((label) => (
          <div key={label} style={styles.dayHeader}>{label}</div>
        ))}

        {/* Calendar cells */}
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} style={styles.emptyCell} />;
          }
          const isA = cell.assignment && cell.assignment.parentId === schedule.parentAId;
          const isB = cell.assignment && cell.assignment.parentId === schedule.parentBId;
          const bg = isA ? '#ffedd0' : isB ? '#dcfee5' : '#ffffff';

          return (
            <div key={cell.day} style={{ ...styles.cell, backgroundColor: bg }}>
              <span style={styles.dayNumber}>{cell.day}</span>
              {cell.assignment?.isExchange && (
                <span style={styles.exchangeMarker} title="Exchange day">&#x21C4;</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  noData: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
    padding: 40,
  },
  loading: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    padding: 40,
  },
  legend: {
    display: 'flex',
    gap: 20,
    marginBottom: 12,
    fontSize: 13,
    color: '#374151',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    display: 'inline-block',
    width: 14,
    height: 14,
    borderRadius: 3,
    border: '1px solid #d1d5db',
  },
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  navButton: {
    padding: '4px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: 16,
  },
  monthLabel: {
    fontWeight: 600,
    fontSize: 18,
    minWidth: 180,
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 2,
    maxWidth: 560,
    margin: '0 auto',
  },
  dayHeader: {
    padding: '6px 0',
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  emptyCell: {
    minHeight: 52,
  },
  cell: {
    minHeight: 52,
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    padding: 4,
    position: 'relative',
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: 500,
    color: '#1f2937',
  },
  exchangeMarker: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    fontSize: 12,
    color: '#9333ea',
  },
};
