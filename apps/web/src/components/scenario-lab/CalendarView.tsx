import { useState, CSSProperties } from 'react';
import { DisruptionEventType, RequestType, RequestUrgency, ParentRole } from '@adcp/shared';
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

const QUICK_DISRUPTIONS: Array<{ type: DisruptionEventType; label: string; color: string }> = [
  { type: DisruptionEventType.SCHOOL_CLOSED, label: 'School Closed', color: '#f59e0b' },
  { type: DisruptionEventType.CHILD_SICK, label: 'Sick Child', color: '#ef4444' },
  { type: DisruptionEventType.PARENT_TRAVEL, label: 'Parent Travel', color: '#3b82f6' },
  { type: DisruptionEventType.WEATHER_EMERGENCY, label: 'Weather', color: '#6366f1' },
  { type: DisruptionEventType.CAMP_WEEK, label: 'Camp Week', color: '#22c55e' },
  { type: DisruptionEventType.PUBLIC_HOLIDAY, label: 'Holiday', color: '#ec4899' },
  { type: DisruptionEventType.TRANSPORT_FAILURE, label: 'Transport Fail', color: '#64748b' },
];

const QUICK_REQUESTS: Array<{ type: RequestType; label: string }> = [
  { type: RequestType.NEED_COVERAGE, label: 'Need Coverage' },
  { type: RequestType.WANT_TIME, label: 'Want Time' },
  { type: RequestType.SWAP_DATE, label: 'Swap Day' },
];

let nextId = 1000;

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
  const store = useScenarioStore();
  const { schedule, disruptions, currentDate } = store;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);

  // Build lookup maps
  const assignMap = new Map<string, ScheduleDay>();
  for (const day of schedule) assignMap.set(day.date, day);

  const disruptionMap = new Map<string, DisruptionEntry>();
  for (const d of disruptions) {
    let current = d.startDate;
    while (current <= d.endDate) {
      disruptionMap.set(current, d);
      current = addDays(current, 1);
    }
  }

  // Determine months
  const startDate = new Date(currentDate + 'T00:00:00');
  const months: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  function handleCellClick(dateStr: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSelectedDate(dateStr);
    setPopoverPos({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
    setDragStart(null);
    setDragEnd(null);
  }

  function handleCellMouseDown(dateStr: string) {
    setDragStart(dateStr);
    setDragEnd(dateStr);
  }

  function handleCellMouseEnter(dateStr: string) {
    if (dragStart) setDragEnd(dateStr);
  }

  function handleCellMouseUp() {
    // If we dragged a range, open popover for that range
    if (dragStart && dragEnd && dragStart !== dragEnd) {
      const [start, end] = dragStart <= dragEnd ? [dragStart, dragEnd] : [dragEnd, dragStart];
      setSelectedDate(start);
      setDragStart(start);
      setDragEnd(end);
      // Show popover near center of screen
      setPopoverPos({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    } else {
      setDragStart(null);
      setDragEnd(null);
    }
  }

  function isInDragRange(dateStr: string): boolean {
    if (!dragStart || !dragEnd) return false;
    const [start, end] = dragStart <= dragEnd ? [dragStart, dragEnd] : [dragEnd, dragStart];
    return dateStr >= start && dateStr <= end;
  }

  function addDisruption(type: DisruptionEventType) {
    const start = dragStart && dragEnd ? (dragStart <= dragEnd ? dragStart : dragEnd) : selectedDate;
    const end = dragStart && dragEnd ? (dragStart <= dragEnd ? dragEnd : dragStart) : selectedDate;
    if (!start || !end) return;

    store.addDisruption({
      id: `dis-cal-${nextId++}`,
      type,
      startDate: start,
      endDate: end,
      description: `${type} (${start}${end !== start ? ' to ' + end : ''})`,
    });
    closePopover();
  }

  function addRequest(type: RequestType) {
    if (!selectedDate) return;
    store.addRequest({
      id: `req-cal-${nextId++}`,
      type,
      urgency: RequestUrgency.NORMAL,
      requestingParent: ParentRole.PARENT_A,
      dates: [selectedDate],
      reason: `${type} on ${selectedDate}`,
    });
    closePopover();
  }

  function removeDisruptionOnDate() {
    if (!selectedDate) return;
    const dis = disruptionMap.get(selectedDate);
    if (dis) store.removeDisruption(dis.id);
    closePopover();
  }

  function closePopover() {
    setSelectedDate(null);
    setPopoverPos(null);
    setDragStart(null);
    setDragEnd(null);
  }

  const rangeLabel = dragStart && dragEnd && dragStart !== dragEnd
    ? `${dragStart <= dragEnd ? dragStart : dragEnd} to ${dragStart <= dragEnd ? dragEnd : dragStart}`
    : selectedDate;

  return (
    <div style={s.root}>
      {/* Header */}
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

      {/* Active disruptions strip */}
      {disruptions.length > 0 && (
        <div style={s.disruptionStrip}>
          {disruptions.map((d) => (
            <div key={d.id} style={s.disruptionTag}>
              <span style={s.disruptionTagType}>{d.type.replace(/_/g, ' ')}</span>
              <span style={s.disruptionTagDate}>{d.startDate}{d.endDate !== d.startDate ? ` → ${d.endDate}` : ''}</span>
              <button style={s.disruptionTagX} onClick={() => store.removeDisruption(d.id)}>x</button>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div style={s.calendarBody} onMouseUp={handleCellMouseUp}>
        {schedule.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>&#128197;</div>
            <div style={s.emptyText}>Click "Run Simulation" to generate a schedule</div>
            <div style={s.emptyHint}>Click or drag dates to add disruptions</div>
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
              selectedDate={selectedDate}
              isInDragRange={isInDragRange}
              onCellClick={handleCellClick}
              onCellMouseDown={handleCellMouseDown}
              onCellMouseEnter={handleCellMouseEnter}
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
            <span style={s.legendHint}>Click date to add event. Drag for range.</span>
          </div>
        )}
      </div>

      {/* Date popover */}
      {selectedDate && popoverPos && (
        <>
          <div style={s.backdrop} onClick={closePopover} />
          <div style={{
            ...s.popover,
            left: Math.min(popoverPos.x - 140, window.innerWidth - 300),
            top: Math.min(popoverPos.y, window.innerHeight - 300),
          }}>
            <div style={s.popoverHeader}>
              <span style={s.popoverDate}>{rangeLabel}</span>
              <button style={s.popoverClose} onClick={closePopover}>x</button>
            </div>

            {/* Existing disruption on this date */}
            {disruptionMap.has(selectedDate) && (
              <div style={s.popoverExisting}>
                <span>Active: {disruptionMap.get(selectedDate)!.type}</span>
                <button style={s.popoverRemoveBtn} onClick={removeDisruptionOnDate}>Remove</button>
              </div>
            )}

            <div style={s.popoverSection}>
              <div style={s.popoverSectionTitle}>Add Disruption</div>
              <div style={s.popoverGrid}>
                {QUICK_DISRUPTIONS.map((d) => (
                  <button
                    key={d.type}
                    style={{ ...s.popoverBtn, borderColor: d.color, color: d.color }}
                    onClick={() => addDisruption(d.type)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.popoverSection}>
              <div style={s.popoverSectionTitle}>Add Request</div>
              <div style={s.popoverGrid}>
                {QUICK_REQUESTS.map((r) => (
                  <button
                    key={r.type}
                    style={{ ...s.popoverBtn, borderColor: '#8b5cf6', color: '#8b5cf6' }}
                    onClick={() => addRequest(r.type)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
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
  selectedDate,
  isInDragRange,
  onCellClick,
  onCellMouseDown,
  onCellMouseEnter,
}: {
  year: number;
  month: number;
  assignMap: Map<string, ScheduleDay>;
  disruptionMap: Map<string, DisruptionEntry>;
  currentDate: string;
  overlayToggles: Props['overlayToggles'];
  selectedDate: string | null;
  isInDragRange: (d: string) => boolean;
  onCellClick: (d: string, e: React.MouseEvent) => void;
  onCellMouseDown: (d: string) => void;
  onCellMouseEnter: (d: string) => void;
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
          const isSelected = dateStr === selectedDate;
          const inRange = isInDragRange(dateStr);
          const assigned = schedDay?.assignedTo;
          const isHandoff = schedDay?.isHandoff;

          let bg = '#fff';
          if (assigned) bg = PARENT_COLORS[assigned];
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
                ...(isSelected ? s.selectedCell : {}),
                ...(inRange ? s.dragRangeCell : {}),
              }}
              title={[
                dateStr,
                assigned ? `Assigned: ${assigned}` : '',
                disruption ? `Disruption: ${disruption.type}` : '',
                isHandoff ? 'Handoff day' : '',
              ].filter(Boolean).join('\n')}
              onClick={(e) => onCellClick(dateStr, e)}
              onMouseDown={(e) => { e.preventDefault(); onCellMouseDown(dateStr); }}
              onMouseEnter={() => onCellMouseEnter(dateStr)}
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
      <div style={{
        width: dot ? 8 : 12, height: dot ? 8 : 12,
        borderRadius: dot ? '50%' : 2, backgroundColor: color,
        border: '1px solid rgba(0,0,0,0.1)',
      }} />
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
    position: 'relative' as const,
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
  // Disruption strip
  disruptionStrip: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    padding: '4px 12px',
    backgroundColor: '#fffbeb',
    borderBottom: '1px solid #fcd34d',
    flexShrink: 0,
  },
  disruptionTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    backgroundColor: '#fff',
    border: '1px solid #fcd34d',
    borderRadius: 4,
    fontSize: 9,
  },
  disruptionTagType: {
    fontWeight: 600,
    color: '#92400e',
    textTransform: 'capitalize' as const,
  },
  disruptionTagDate: {
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  disruptionTagX: {
    width: 14,
    height: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 700,
    color: '#ef4444',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  // Calendar
  calendarBody: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
    userSelect: 'none',
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
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: 'center' as const },
  emptyHint: { fontSize: 11, color: '#d1d5db', marginTop: 4 },
  monthContainer: { marginBottom: 20 },
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
    cursor: 'pointer',
    transition: 'box-shadow 0.1s',
  },
  emptyCell: { height: 44 },
  todayCell: {
    outline: '2px solid #4A90D9',
    outlineOffset: -1,
    zIndex: 1,
  },
  selectedCell: {
    boxShadow: '0 0 0 2px #4A90D9',
    zIndex: 2,
  },
  dragRangeCell: {
    boxShadow: 'inset 0 0 0 2px #4A90D9',
    opacity: 0.85,
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
    top: 2, right: 2,
    width: 6, height: 6,
    borderRadius: '50%',
    backgroundColor: '#f59e0b',
  },
  handoffLine: {
    position: 'absolute' as const,
    left: 0, top: 0, bottom: 0,
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
    alignItems: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  legendHint: {
    fontSize: 10,
    color: '#d1d5db',
    fontStyle: 'italic' as const,
    marginLeft: 8,
  },
  // Popover
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 99,
  },
  popover: {
    position: 'fixed' as const,
    zIndex: 100,
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  popoverHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #e5e7eb',
  },
  popoverDate: {
    fontWeight: 700,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#1a1a2e',
  },
  popoverClose: {
    width: 20, height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '50%',
  },
  popoverExisting: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    backgroundColor: '#fef3c7',
    borderBottom: '1px solid #fcd34d',
    fontSize: 10,
    fontWeight: 600,
    color: '#92400e',
  },
  popoverRemoveBtn: {
    padding: '2px 8px',
    fontSize: 9,
    color: '#ef4444',
    backgroundColor: '#fff',
    border: '1px solid #fca5a5',
    borderRadius: 3,
    cursor: 'pointer',
  },
  popoverSection: {
    padding: '8px 12px',
    borderBottom: '1px solid #f3f4f6',
  },
  popoverSectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  popoverGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
  },
  popoverBtn: {
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 500,
    border: '1px solid',
    borderRadius: 4,
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
};
