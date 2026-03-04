import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors } from '../../../src/theme/colors';
import { useAuthStore } from '../../../src/stores/auth';
import { useParentLabel, useParentNames } from '../../../src/hooks/useParentName';
import { calendarApi } from '../../../src/api/client';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarDay {
  date: string;
  assignment: { assignedTo: string; isTransition: boolean } | null;
  handoffs: Array<{ type: string; fromParent: string; toParent: string }>;
  holidayLabel: string | null;
  daycareClosed: boolean;
  source?: string;
}

type DayCell = { date: string; dayNum: number } | null;

function getMonthRows(year: number, month: number): DayCell[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun

  const days: DayCell[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    days.push({ date: dt.toISOString().split('T')[0], dayNum: d });
  }
  while (days.length % 7 !== 0) days.push(null);

  const rows: DayCell[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }
  return rows;
}

function formatMonth(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function CalendarScreen() {
  const { family } = useAuthStore();
  const parentLabel = useParentLabel();
  const parentNames = useParentNames();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [calendarData, setCalendarData] = useState<Map<string, CalendarDay>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    if (!family) return;
    setLoading(true);
    try {
      const start = new Date(year, month, 1).toISOString().split('T')[0];
      const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const { data } = await calendarApi.getCalendar(family.id, start, end);
      const map = new Map<string, CalendarDay>();
      for (const day of data.days) {
        map.set(day.date, day);
      }
      setCalendarData(map);
    } catch {
      // Silently handle — empty calendar shown
    } finally {
      setLoading(false);
    }
  }, [family, year, month]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const goToPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const goToNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const monthRows = getMonthRows(year, month);
  const today = new Date().toISOString().split('T')[0];
  const selectedDay = selectedDate ? calendarData.get(selectedDate) : null;

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
          <Text style={styles.navText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {formatMonth(year, month).toUpperCase()}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Text style={styles.navText}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {DAY_NAMES.map((d) => (
          <View key={d} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.parentA} />
        </View>
      ) : (
        <View style={styles.grid}>
          {monthRows.map((row, ri) => (
            <View key={ri} style={styles.weekRow}>
              {row.map((cell, ci) => {
                if (!cell) {
                  return <View key={`pad-${ci}`} style={styles.cell} />;
                }
                const dayData = calendarData.get(cell.date);
                const parent = dayData?.assignment?.assignedTo;
                const isTransition = dayData?.assignment?.isTransition;
                const isToday = cell.date === today;
                const isSelected = cell.date === selectedDate;
                const isDisruption = dayData?.source === 'disruption';
                const isMaxConsecutive = dayData?.source === 'max_consecutive';

                const hasAssignment = !!parent;
                let bgColor: string | undefined;
                if (parent === 'parent_a') bgColor = colors.parentALight;
                else if (parent === 'parent_b') bgColor = colors.parentBLight;

                return (
                  <TouchableOpacity
                    key={cell.date}
                    style={[
                      styles.cell,
                      hasAssignment ? styles.cellAssigned : styles.cellUnassigned,
                      bgColor ? { backgroundColor: bgColor } : undefined,
                      isToday && styles.cellToday,
                      isSelected && styles.cellSelected,
                    ]}
                    onPress={() => setSelectedDate(cell.date)}
                  >
                    <Text style={[
                      styles.cellText,
                      isToday && styles.cellTextToday,
                    ]}>
                      {cell.dayNum}
                    </Text>
                    {isTransition && <View style={styles.transitionDot} />}
                    {dayData?.holidayLabel && <View style={styles.holidayDot} />}
                    {isDisruption && (
                      <View style={styles.disruptionTriangle} />
                    )}
                    {isMaxConsecutive && (
                      <View style={styles.maxConsecutiveTriangle} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.parentALight }]} />
          <Text style={styles.legendText}>{parentNames.parent_a}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.parentBLight }]} />
          <Text style={styles.legendText}>{parentNames.parent_b}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>Handoff</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendTriangle} />
          <Text style={styles.legendText}>Adjusted</Text>
        </View>
      </View>

      {/* Selected day detail */}
      {selectedDay && (
        <ScrollView style={styles.detail}>
          <Text style={styles.detailDate}>{selectedDate}</Text>
          {selectedDay.assignment && (
            <View style={styles.detailRow}>
              <View style={[
                styles.detailBadge,
                { backgroundColor: selectedDay.assignment.assignedTo === 'parent_a' ? colors.parentA : colors.parentB },
              ]} />
              <Text style={styles.detailText}>
                Overnight: {parentLabel(selectedDay.assignment.assignedTo)}
              </Text>
            </View>
          )}
          {selectedDay.assignment?.isTransition && (
            <View style={styles.detailRow}>
              <View style={[styles.detailBadge, { backgroundColor: colors.warning }]} />
              <Text style={styles.detailText}>Handoff day</Text>
            </View>
          )}
          {selectedDay.handoffs.map((h, idx) => (
            <View key={idx} style={styles.detailRow}>
              <Text style={styles.detailText}>
                {h.type}: {parentLabel(h.fromParent)} → {parentLabel(h.toParent)}
              </Text>
            </View>
          ))}
          {selectedDay.holidayLabel && (
            <View style={styles.detailRow}>
              <Text style={styles.detailHoliday}>{selectedDay.holidayLabel}</Text>
              {selectedDay.daycareClosed && (
                <Text style={styles.detailNote}> (daycare closed)</Text>
              )}
            </View>
          )}
          {/* Disruption info */}
          {selectedDay.source === 'disruption' && (
            <View style={styles.detailInfoCard}>
              <Text style={styles.detailInfoTitle}>Disruption Override</Text>
              <Text style={styles.detailInfoText}>
                Schedule adjusted for a temporary change.
              </Text>
            </View>
          )}
          {selectedDay.source === 'max_consecutive' && (
            <View style={[styles.detailInfoCard, { borderLeftColor: colors.maxConsecutive }]}>
              <Text style={[styles.detailInfoTitle, { color: colors.maxConsecutive }]}>
                Max Consecutive Cap
              </Text>
              <Text style={styles.detailInfoText}>
                Adjusted to respect max consecutive nights rule.
              </Text>
            </View>
          )}
          {!selectedDay.assignment && (
            <Text style={styles.detailEmpty}>No schedule data for this day.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const CELL_GAP = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5E5EA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  navButton: { padding: 8 },
  navText: { fontSize: 18, color: '#8E8E93', fontWeight: '600' },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C7C7CC',
    letterSpacing: 1,
  },
  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 2,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  grid: {
    paddingHorizontal: 24,
  },
  weekRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
    marginBottom: CELL_GAP,
  },
  cell: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  cellAssigned: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  cellUnassigned: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  cellToday: {
    borderWidth: 2,
    borderColor: '#3A3A3C',
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: '#1A1A2E',
  },
  cellText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    opacity: 0.65,
  },
  cellTextToday: {
    fontWeight: '700',
    opacity: 1,
    color: '#3A3A3C',
  },
  transitionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.warning,
    position: 'absolute',
    bottom: 3,
  },
  holidayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.success,
    position: 'absolute',
    bottom: 3,
    right: '25%',
  },
  disruptionTriangle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: colors.disruption,
    borderLeftWidth: 8,
    borderLeftColor: 'transparent',
  },
  maxConsecutiveTriangle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: colors.maxConsecutive,
    borderLeftWidth: 8,
    borderLeftColor: 'transparent',
  },
  loadingContainer: {
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
    marginHorizontal: 24,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 12, color: '#8E8E93' },
  legendTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: colors.disruption,
    borderLeftWidth: 8,
    borderLeftColor: 'transparent',
  },
  detail: {
    flex: 1,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
  },
  detailDate: { fontSize: 16, fontWeight: '700', color: '#3A3A3C', marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detailBadge: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  detailText: { fontSize: 14, color: '#3A3A3C' },
  detailHoliday: { fontSize: 14, color: colors.success, fontWeight: '600' },
  detailNote: { fontSize: 12, color: '#8E8E93' },
  detailEmpty: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic' },
  detailInfoCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.disruption,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  detailInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.disruption,
    marginBottom: 2,
  },
  detailInfoText: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
