import { CSSProperties } from 'react';
import type { ScheduleDay } from './DeterministicSchedule';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PARENT_COLORS: Record<string, string> = {
  parent_a: '#ffedd0',
  parent_b: '#dcfee5',
};

/** Border colors for non-regular sources */
const SOURCE_INDICATORS: Record<string, { border: string; symbol: string }> = {
  'Disruption': { border: '#f59e0b', symbol: 'D' },
  'Max-consecutive cap': { border: '#8b5cf6', symbol: 'C' },
};

interface Props {
  days: ScheduleDay[];
}

export function DeterministicCalendar({ days }: Props) {
  if (days.length === 0) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>Calendar</div>
        <div style={styles.content}>
          <p style={styles.placeholder}>Waiting for schedule...</p>
        </div>
      </div>
    );
  }

  // Build lookup maps
  const assignmentMap = new Map<string, string>();
  const sourceMap = new Map<string, string>();
  for (const day of days) {
    assignmentMap.set(day.date, day.assignedTo);
    sourceMap.set(day.date, day.source);
  }

  // Determine months to render (from first day, 6 months)
  const firstDate = new Date(days[0].date + 'T00:00:00');
  const months: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(firstDate.getFullYear(), firstDate.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Calendar</div>
      <div style={styles.content}>
        {months.map(({ year, month }) => {
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          return (
            <div key={`${year}-${month}`} style={styles.monthContainer}>
              <div style={styles.monthTitle}>
                {MONTH_NAMES[month]} {year}
              </div>
              <div style={styles.grid}>
                {DAY_NAMES.map((d) => (
                  <div key={d} style={styles.dayHeader}>{d}</div>
                ))}
                {cells.map((dayNum, i) => {
                  if (dayNum === null) {
                    return <div key={i} style={styles.emptyCell} />;
                  }
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const assigned = assignmentMap.get(dateStr);
                  const source = sourceMap.get(dateStr) ?? '';
                  const bg = assigned ? (PARENT_COLORS[assigned] || '#fff') : '#fff';
                  const isToday = dateStr === todayStr;
                  const indicator = SOURCE_INDICATORS[source];

                  return (
                    <div
                      key={i}
                      title={source !== 'Regular schedule' && source ? source : undefined}
                      style={{
                        ...styles.cell,
                        backgroundColor: bg,
                        ...(isToday ? styles.today : {}),
                        ...(indicator ? {
                          border: `2px solid ${indicator.border}`,
                        } : {}),
                      }}
                    >
                      {dayNum}
                      {indicator && (
                        <span style={{
                          ...styles.sourceTag,
                          color: indicator.border,
                        }}>
                          {indicator.symbol}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: '#ffedd0' }} />
            <span>Father</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: '#dcfee5' }} />
            <span>Mother</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: '#fff', border: '2px solid #f59e0b' }} />
            <span>D = Disruption</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: '#fff', border: '2px solid #8b5cf6' }} />
            <span>C = Max-consecutive cap</span>
          </div>
        </div>
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
  monthContainer: {
    marginBottom: 16,
  },
  monthTitle: {
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
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    height: 28,
    fontSize: 11,
    borderRadius: 3,
    fontWeight: 500,
  },
  emptyCell: {
    height: 28,
  },
  today: {
    outline: '2px solid #4A90D9',
    outlineOffset: -1,
    fontWeight: 700,
  },
  sourceTag: {
    position: 'absolute' as const,
    top: 1,
    right: 2,
    fontSize: 7,
    fontWeight: 700,
    lineHeight: 1,
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 12,
    padding: '8px 0',
    fontSize: 11,
    color: '#6b7280',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
};
