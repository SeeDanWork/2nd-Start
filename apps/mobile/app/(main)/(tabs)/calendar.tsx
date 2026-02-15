import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../../src/theme/colors';
import { useAuthStore } from '../../../src/stores/auth';
import { calendarApi } from '../../../src/api/client';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarDay {
  date: string;
  assignment: { assignedTo: string; isTransition: boolean } | null;
  handoffs: Array<{ type: string; fromParent: string; toParent: string }>;
  holidayLabel: string | null;
  daycareClosed: boolean;
}

function getMonthDates(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun

  const days: Array<{ date: string; dayNum: number } | null> = [];
  // Pad start
  for (let i = 0; i < startPad; i++) days.push(null);
  // Fill month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    days.push({
      date: dt.toISOString().split('T')[0],
      dayNum: d,
    });
  }
  return days;
}

function formatMonth(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function CalendarScreen() {
  const { family } = useAuthStore();
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

  const monthDates = getMonthDates(year, month);
  const today = new Date().toISOString().split('T')[0];
  const selectedDay = selectedDate ? calendarData.get(selectedDate) : null;

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
          <Text style={styles.navText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{formatMonth(year, month)}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Text style={styles.navText}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {DAY_NAMES.map((d) => (
          <Text key={d} style={styles.dayHeaderText}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.parentA} />
        </View>
      ) : (
        <View style={styles.grid}>
          {monthDates.map((cell, i) => {
            if (!cell) {
              return <View key={`pad-${i}`} style={styles.cell} />;
            }
            const dayData = calendarData.get(cell.date);
            const parent = dayData?.assignment?.assignedTo;
            const isTransition = dayData?.assignment?.isTransition;
            const isToday = cell.date === today;
            const isSelected = cell.date === selectedDate;

            let bgColor = colors.surface;
            if (parent === 'parent_a') bgColor = colors.parentALight;
            else if (parent === 'parent_b') bgColor = colors.parentBLight;

            return (
              <TouchableOpacity
                key={cell.date}
                style={[
                  styles.cell,
                  { backgroundColor: bgColor },
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
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.parentALight }]} />
          <Text style={styles.legendText}>Parent A</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.parentBLight }]} />
          <Text style={styles.legendText}>Parent B</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>Handoff</Text>
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
                Overnight: {selectedDay.assignment.assignedTo === 'parent_a' ? 'Parent A' : 'Parent B'}
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
                {h.type}: {h.fromParent} → {h.toParent}
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
          {!selectedDay.assignment && (
            <Text style={styles.detailEmpty}>No schedule data for this day.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navButton: { padding: 8 },
  navText: { fontSize: 20, color: colors.parentA, fontWeight: '600' },
  monthTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 1,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: colors.parentA,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  cellText: {
    fontSize: 14,
    color: colors.text,
  },
  cellTextToday: {
    fontWeight: '700',
  },
  transitionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.warning,
    position: 'absolute',
    bottom: 4,
  },
  holidayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.success,
    position: 'absolute',
    bottom: 4,
    right: '30%',
  },
  loadingContainer: {
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginHorizontal: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 12, color: colors.textSecondary },
  detail: {
    flex: 1,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailDate: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detailBadge: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  detailText: { fontSize: 14, color: colors.text },
  detailHoliday: { fontSize: 14, color: colors.success, fontWeight: '600' },
  detailNote: { fontSize: 12, color: colors.textSecondary },
  detailEmpty: { fontSize: 14, color: colors.textSecondary, fontStyle: 'italic' },
});
