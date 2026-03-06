import { CSSProperties } from 'react';
import { useScenarioStore } from '../../stores/scenario';
import type { ScheduleDay, DisruptionEntry } from '../../stores/scenario';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PARENT_COLORS = {
  parent_a: '#ffedd0',
  parent_b: '#dcfee5',
};

const DISRUPTION_COLORS: Record<string, string> = {
  school_closed: '#fef3c7',
  parent_travel: '#dbeafe',
  child_sick: '#fee2e2',
  weather_emergency: '#ede9fe',
  camp_week: '#dcfce7',
  public_holiday: '#fce7f3',
  break: '#fef9c3',
};

interface Props {
  overlayToggles: {
    disruptions: boolean;
    transitions: boolean;
    fairness: boolean;
    templates: boolean;
  };
  onToggle: (key: string) => void;
}

export function CalendarView({ overlayToggles, onToggle }: Props) {
  const { schedule, disruptions, currentDate, metrics } = useScenarioStore();

  // Build lookup maps
  const assignMap = new Map<string, ScheduleDay>();
  for (const day of schedule) {
    assignMap.set(day.date, day);
  }

  const disruptionMap = new Map<string, DisruptionEntry>();
  for (const d of disruptions) {
    let current = d.startDate;
    while (current <= d.endDate) {
      disruptionMap.set(current, d);
      current = addDays(current, 1);
    }
  }

  // Determine months to render
  const startDate = new Date(currentDate + 'T00:00:00');
  const months: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div style={s.root}>
      {/* Header with toggles */}
      <div style={s.header}>
        <span style={s.headerTitle}>Calendar View</span>
        <div style={s.toggles}>
          {(['disruptions', 'transitions', 'fairness', 'templates'] as const).map((key) => (
            <label key={key} style={s.toggle}>
              <input
                type="checkbox"
                checked={overlayToggles[key]}
                onChange={() => onToggle(key)}
                style={s.checkbox}
              />
              <span style={s.toggleLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div style={s.calendarBody}>
        {schedule.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>&#128197;</div>
            <div style={s.emptyText}>Click "Run Simulation" to generate a schedule</div>
          </div>
        ) : (
          months.map(({ year, month }) => (
            <MonthGrid
              key={`${year}-${month}`}
              year={year}
              month={month}
              assignMap={assignMap}
              disruptionMap={disruptionMap}
              currentDate={currentDate}
              overlayToggles={overlayToggles}
            />
          ))
        )}

        {/* Legend */}
        {schedule.length > 0 && (
          <div style={s.legend}>
            <LegendItem color={PARENT_COLORS.parent_a} label="Parent A" />
            <LegendItem color={PARENT_COLORS.parent_b} label="Parent B" />
            <LegendItem color="#f59e0b" label="Disruption" dot />
            <LegendItem color="#8b5cf6" label="Handoff" dot />
          </div>
        )}
      </div>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  assignMap,
  disruptionMap,
  currentDate,
  overlayToggles,
}: {
  year: number;
  month: number;
  assignMap: Map<string, ScheduleDay>;
  disruptionMap: Map<string, DisruptionEntry>;
  currentDate: string;
  overlayToggles: Props['overlayToggles'];
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={s.monthContainer}>
      <div style={s.monthTitle}>{MONTH_NAMES[month]} {year}</div>
      <div style={s.grid}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={s.dayHeader}>{d}</div>
        ))}
        {cells.map((dayNum, i) => {
          if (dayNum === null) return <div key={i} style={s.emptyCell} />;

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const schedDay = assignMap.get(dateStr);
          const disruption = disruptionMap.get(dateStr);
          const isToday = dateStr === currentDate;
          const assigned = schedDay?.assignedTo;
          const isHandoff = schedDay?.isHandoff;

          let bg = '#fff';
          if (assigned) {
            bg = PARENT_COLORS[assigned];
          }
          if (disruption && overlayToggles.disruptions) {
            const dColor = DISRUPTION_COLORS[disruption.type];
            if (dColor) bg = dColor;
          }

          return (
            <div
              key={i}
              style={{
                ...s.cell,
                backgroundColor: bg,
                ...(isToday ? s.todayCell : {}),
              }}
              title={[
                assigned ? `Assigned: ${assigned}` : '',
                disruption ? `Disruption: ${disruption.type}` : '',
                isHandoff ? 'Handoff day' : '',
              ].filter(Boolean).join('\n')}
            >
              <span style={s.cellDate}>{dayNum}</span>
              {assigned && (
                <span style={s.cellParent}>
                  {assigned === 'parent_a' ? 'A' : 'B'}
                </span>
              )}
              {disruption && overlayToggles.disruptions && (
                <div style={s.disruptionDot} />
              )}
              {isHandoff && overlayToggles.transitions && (
                <div style={s.handoffLine} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendItem({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <div style={s.legendItem}>
      <div
        style={{
          width: dot ? 8 : 12,
          height: dot ? 8 : 12,
          borderRadius: dot ? '50%' : 2,
          backgroundColor: color,
          border: '1px solid rgba(0,0,0,0.1)',
        }}
      />
      <span>{label}</span>
    </div>
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: 13,
    color: '#1a1a2e',
  },
  toggles: {
    display: 'flex',
    gap: 10,
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    cursor: 'pointer',
  },
  checkbox: {
    margin: 0,
    accentColor: '#4A90D9',
  },
  toggleLabel: {
    fontSize: 10,
    color: '#374151',
    fontWeight: 500,
  },
  calendarBody: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 200,
    color: '#9ca3af',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center' as const,
  },
  monthContainer: {
    marginBottom: 20,
  },
  monthTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: '#1a1a2e',
    marginBottom: 6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 2,
  },
  dayHeader: {
    textAlign: 'center' as const,
    fontSize: 10,
    fontWeight: 600,
    color: '#9ca3af',
    paddingBottom: 4,
  },
  cell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    height: 44,
    borderRadius: 4,
    border: '1px solid #e5e7eb',
    cursor: 'default',
    transition: 'background-color 0.1s',
  },
  emptyCell: {
    height: 44,
  },
  todayCell: {
    outline: '2px solid #4A90D9',
    outlineOffset: -1,
    zIndex: 1,
  },
  cellDate: {
    fontSize: 11,
    fontWeight: 500,
    color: '#374151',
  },
  cellParent: {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: '14px',
  },
  disruptionDot: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#f59e0b',
  },
  handoffLine: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#8b5cf6',
    borderRadius: '2px 0 0 2px',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 14,
    padding: '10px 0',
    fontSize: 11,
    color: '#6b7280',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
};
