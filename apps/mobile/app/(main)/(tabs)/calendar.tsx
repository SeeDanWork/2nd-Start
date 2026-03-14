import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { fonts } from '../../../src/theme/fonts';
import { useAuthStore } from '../../../src/stores/auth';
import { useParentLabel, useParentNames } from '../../../src/hooks/useParentName';
import { calendarApi } from '../../../src/api/client';
import { ChatSheet } from '../../../src/components/chat/ChatSheet';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const CELL_SIZE = 48;
const CELL_HEIGHT = 72;
const CELL_GAP = 4;
const CELL_RADIUS = 8;
const MONTHS_AHEAD = 3;
const MONTHS_BEHIND = 1;

interface CalendarDay {
  date: string;
  assignment: { assignedTo: string; isTransition: boolean } | null;
  handoffs: Array<{ type: string; fromParent: string; toParent: string }>;
  holidayLabel: string | null;
  daycareClosed: boolean;
  source?: string;
}

interface DayCell {
  date: string;
  dayNum: number;
  isOverflow: boolean; // day belongs to adjacent month
}

function getMonthGrid(year: number, month: number): DayCell[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun

  const cells: DayCell[] = [];

  // Overflow days from previous month
  if (startPad > 0) {
    const prevLastDay = new Date(year, month, 0);
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevLastDay.getDate() - i;
      const dt = new Date(year, month - 1, d);
      cells.push({
        date: dt.toISOString().split('T')[0],
        dayNum: d,
        isOverflow: true,
      });
    }
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    cells.push({
      date: dt.toISOString().split('T')[0],
      dayNum: d,
      isOverflow: false,
    });
  }

  // Overflow days from next month
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      cells.push({
        date: dt.toISOString().split('T')[0],
        dayNum: d,
        isOverflow: true,
      });
    }
  }

  const rows: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long' });
}

function formatDayLabel(date: string, dayNum: number, month: number): string {
  const d = new Date(date);
  // Show "Apr 1", "May 1" etc. for first day of each month
  if (dayNum === 1) {
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    return `${monthName} ${dayNum}`;
  }
  return String(dayNum);
}

export default function CalendarScreen() {
  const router = useRouter();
  const { family } = useAuthStore();
  const parentNames = useParentNames();
  const [calendarData, setCalendarData] = useState<Map<string, CalendarDay>>(new Map());
  const [loading, setLoading] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const scrollRef = useRef<ScrollView>(null);
  const monthOffsets = useRef<Record<string, number>>({});
  const hasScrolled = useRef(false);

  const handleMonthLayout = useCallback((key: string, e: LayoutChangeEvent) => {
    monthOffsets.current[key] = e.nativeEvent.layout.y;
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
    if (!hasScrolled.current && monthOffsets.current[currentKey] != null) {
      hasScrolled.current = true;
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: monthOffsets.current[currentKey], animated: false });
      }, 50);
    }
  }, []);

  // Generate month list: 1 month back, current, 3 months ahead
  const months = useMemo(() => {
    const now = new Date();
    const result: Array<{ year: number; month: number }> = [];
    for (let offset = -MONTHS_BEHIND; offset <= MONTHS_AHEAD; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return result;
  }, []);

  const fetchCalendar = useCallback(async () => {
    if (!family) return;
    setLoading(true);
    try {
      const first = months[0];
      const last = months[months.length - 1];
      const start = new Date(first.year, first.month, 1).toISOString().split('T')[0];
      const end = new Date(last.year, last.month + 1, 0).toISOString().split('T')[0];
      const { data } = await calendarApi.getCalendar(family.id, start, end);
      const map = new Map<string, CalendarDay>();
      for (const day of data.days) {
        map.set(day.date, day);
      }
      setCalendarData(map);
    } catch {
      // empty calendar
    } finally {
      setLoading(false);
    }
  }, [family, months]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const isPast = useCallback(
    (date: string) => date < today,
    [today],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.accountButton}
          onPress={() => router.push('/(main)/(tabs)/settings')}
        >
          <Text style={styles.accountIcon}>{'\u{1F464}'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Schedule</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.fab} size="large" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {months.map(({ year, month }) => {
            const grid = getMonthGrid(year, month);
            const label = formatMonthLabel(year, month);
            const key = `${year}-${month}`;

            return (
              <View key={key} style={styles.monthContainer} onLayout={(e) => handleMonthLayout(key, e)}>
                {/* Month title */}
                <Text style={styles.monthTitle}>{label}</Text>

                {/* Day-of-week header */}
                <View style={styles.dayHeaders}>
                  {DAY_NAMES.map((d) => (
                    <View key={d} style={styles.dayHeaderCell}>
                      <Text style={styles.dayHeaderText}>{d}</Text>
                    </View>
                  ))}
                </View>

                {/* Week rows */}
                {grid.map((row, ri) => (
                  <View key={ri} style={styles.weekRow}>
                    {row.map((cell) => {
                      const dayData = calendarData.get(cell.date);
                      const parent = dayData?.assignment?.assignedTo;
                      const isToday = cell.date === today;

                      // Determine cell style
                      let cellStyle: any[] = [styles.cell];
                      let textStyle: any[] = [styles.cellText];

                      // Only fade days from previous months, not current month
                      const currentMonth = new Date().getMonth();
                      const cellMonth = new Date(cell.date).getMonth();
                      const isPreviousMonth = cellMonth < currentMonth || (currentMonth === 0 && cellMonth === 11);

                      if (cell.isOverflow) {
                        cellStyle.push(styles.cellOverflow);
                        textStyle.push(styles.cellTextOverflow);
                      } else if (parent === 'parent_a') {
                        cellStyle.push(styles.cellParentA);
                        textStyle.push(styles.cellTextAssigned);
                        if (isPreviousMonth) cellStyle.push(styles.cellPastMonth);
                      } else if (parent === 'parent_b') {
                        cellStyle.push(styles.cellParentB);
                        textStyle.push(styles.cellTextAssigned);
                        if (isPreviousMonth) cellStyle.push(styles.cellPastMonth);
                      } else {
                        cellStyle.push(styles.cellUnassigned);
                      }

                      if (isToday) {
                        cellStyle.push(styles.cellToday);
                        textStyle.push(styles.cellTextToday);
                      }

                      const displayLabel = formatDayLabel(cell.date, cell.dayNum, month);

                      return (
                        <View key={cell.date} style={cellStyle}>
                          <Text style={textStyle}>{displayLabel}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            );
          })}

          {/* Bottom spacer for FAB */}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Chat FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setChatVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>{'\uD83D\uDCAC'}</Text>
      </TouchableOpacity>

      {/* Chat bottom sheet */}
      <ChatSheet visible={chatVisible} onClose={() => setChatVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
  },
  accountButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  accountIcon: {
    fontSize: 20,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 34,
    color: colors.text,
    letterSpacing: 0.4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 21,
  },
  monthContainer: {
    marginBottom: 40,
  },
  monthTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.text,
    opacity: 0.75,
    textAlign: 'center',
    marginBottom: 8,
  },
  dayHeaders: {
    flexDirection: 'row',
    gap: CELL_GAP,
    marginBottom: CELL_GAP,
  },
  dayHeaderCell: {
    width: CELL_SIZE,
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeaderText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textTertiary,
    textTransform: 'lowercase',
  },
  weekRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
    marginBottom: CELL_GAP,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    borderRadius: CELL_RADIUS,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  cellText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.text,
    opacity: 0.55,
  },
  cellTextAssigned: {
    opacity: 0.7,
  },

  // Parent A: gold with dark border
  cellParentA: {
    backgroundColor: colors.parentA,
    borderWidth: 0.65,
    borderColor: colors.parentABorder,
  },

  // Parent B: green, no border
  cellParentB: {
    backgroundColor: colors.parentB,
  },

  // Previous month days: reduced opacity
  cellPastMonth: {
    opacity: 0.45,
  },

  // No assignment
  cellUnassigned: {
    backgroundColor: colors.unassigned,
  },

  // Overflow (adjacent month)
  cellOverflow: {
    backgroundColor: colors.overflow,
    borderWidth: 0.5,
    borderColor: colors.overflowBorder,
  },
  cellTextOverflow: {
    opacity: 0.2,
  },

  // Today highlight
  cellToday: {
    borderWidth: 1,
    borderColor: colors.todayBorder,
    opacity: 1,
  },
  cellTextToday: {
    color: colors.todayText,
    opacity: 1,
  },

  // Chat FAB
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 21,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.fab,
    borderWidth: 1.25,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.32,
        shadowRadius: 25,
      },
      android: { elevation: 12 },
    }),
  },
  fabIcon: {
    fontSize: 28,
  },
});
