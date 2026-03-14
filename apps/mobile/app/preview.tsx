/**
 * Temporary preview page — bypasses auth to show calendar UI.
 * Access at: http://localhost:8082/preview
 * DELETE THIS FILE when done previewing.
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const CELL_GAP = 4;
const CELL_HEIGHT = 72;
const CELL_RADIUS = 8;
const MONTHS_AHEAD = 3;
const MONTHS_BEHIND = 1;

interface DayCell {
  date: string;
  dayNum: number;
  isOverflow: boolean;
}

function getMonthGrid(year: number, month: number): DayCell[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const cells: DayCell[] = [];

  if (startPad > 0) {
    const prevLastDay = new Date(year, month, 0);
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevLastDay.getDate() - i;
      const dt = new Date(year, month - 1, d);
      cells.push({ date: dt.toISOString().split('T')[0], dayNum: d, isOverflow: true });
    }
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    cells.push({ date: dt.toISOString().split('T')[0], dayNum: d, isOverflow: false });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      cells.push({ date: dt.toISOString().split('T')[0], dayNum: d, isOverflow: true });
    }
  }
  const rows: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// Generate fake schedule data for preview
function generateFakeAssignments(): Map<string, 'parent_a' | 'parent_b'> {
  const map = new Map<string, 'parent_a' | 'parent_b'>();
  const now = new Date();

  // Fill 2 months back through 2 months ahead with a roughly alternating pattern
  for (let offset = -60; offset <= 90; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    // Simple pattern: Parent A gets Sun-Tue, some Wed-Thu; Parent B gets rest
    // With some variation to look realistic
    const weekNum = Math.floor(offset / 7);
    let parent: 'parent_a' | 'parent_b';

    if (weekNum % 2 === 0) {
      parent = dayOfWeek <= 2 || dayOfWeek === 5 ? 'parent_a' : 'parent_b';
    } else {
      parent = dayOfWeek >= 3 && dayOfWeek <= 6 ? 'parent_a' : 'parent_b';
    }

    map.set(dateStr, parent);
  }
  return map;
}

function formatDayLabel(dayNum: number, date: string): string {
  const d = new Date(date);
  if (dayNum === 1) {
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    return `${monthName} ${dayNum}`;
  }
  return String(dayNum);
}

export default function PreviewScreen() {
  const [chatVisible, setChatVisible] = useState(false);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const assignments = useMemo(() => generateFakeAssignments(), []);

  const months = useMemo(() => {
    const now = new Date();
    const result: Array<{ year: number; month: number }> = [];
    for (let offset = -MONTHS_BEHIND; offset <= MONTHS_AHEAD; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return result;
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const monthOffsets = useRef<Record<string, number>>({});
  const hasScrolled = useRef(false);

  const handleMonthLayout = useCallback((key: string, e: LayoutChangeEvent) => {
    monthOffsets.current[key] = e.nativeEvent.layout.y;
    // Scroll to current month once we have its offset
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
    if (!hasScrolled.current && monthOffsets.current[currentKey] != null) {
      hasScrolled.current = true;
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: monthOffsets.current[currentKey], animated: false });
      }, 50);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.accountButton}>
          <Text style={styles.accountIcon}>{'\u{1F464}'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Schedule</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {months.map(({ year, month }) => {
          const grid = getMonthGrid(year, month);
          const label = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long' });

          const key = `${year}-${month}`;
          return (
            <View key={key} style={styles.monthContainer} onLayout={(e) => handleMonthLayout(key, e)}>
              <Text style={styles.monthTitle}>{label}</Text>

              <View style={styles.dayHeaders}>
                {DAY_NAMES.map((d) => (
                  <View key={d} style={styles.dayHeaderCell}>
                    <Text style={styles.dayHeaderText}>{d}</Text>
                  </View>
                ))}
              </View>

              {grid.map((row, ri) => (
                <View key={ri} style={styles.weekRow}>
                  {row.map((cell) => {
                    const parent = cell.isOverflow ? null : assignments.get(cell.date) || null;
                    const isToday = cell.date === today;
                    // Only fade days from previous months, not current month past days
                    const currentMonth = new Date().getMonth();
                    const cellMonth = new Date(cell.date).getMonth();
                    const isPreviousMonth = cellMonth < currentMonth || (currentMonth === 0 && cellMonth === 11);

                    let cellStyle: any[] = [styles.cell];
                    let textStyle: any[] = [styles.cellText];

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

                    return (
                      <View key={cell.date} style={cellStyle}>
                        <Text style={textStyle}>
                          {formatDayLabel(cell.dayNum, cell.date)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Chat FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setChatVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>{'\uD83D\uDCAC'}</Text>
      </TouchableOpacity>

      {/* Chat modal preview */}
      <Modal
        visible={chatVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChatVisible(false)}
      >
        <View style={styles.sheetContainer}>
          <View style={styles.grabberRow}>
            <View style={styles.grabber} />
          </View>
          <View style={styles.sheetHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setChatVisible(false)}>
              <Text style={styles.closeIcon}>{'\u2715'}</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Chat</Text>
            <View style={styles.closeButton} />
          </View>

          {/* Fake chat content */}
          <View style={styles.chatContent}>
            <View style={styles.aiBubble}>
              <Text style={styles.aiText}>
                Hi! I'm your co-parenting assistant. I can help you with schedule changes, swap requests, and answer questions about your custody arrangement.
              </Text>
            </View>
            <View style={styles.userMsgRow}>
              <Text style={styles.userTimestamp}>Today  3:21 pm</Text>
              <Text style={styles.userMsgText}>
                Can you show me the schedule for next week?
              </Text>
            </View>
          </View>

          {/* Prompt chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
            <View style={styles.chip}>
              <Text style={styles.chipTitle}>Request a swap</Text>
              <Text style={styles.chipSub}>for next weekend</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipTitle}>Show fairness</Text>
              <Text style={styles.chipSub}>overnight balance</Text>
            </View>
          </ScrollView>

          {/* Input bar */}
          <View style={styles.inputBar}>
            <View style={styles.inputField}>
              <Text style={styles.inputPlaceholder}>Send a message.</Text>
            </View>
            <Text style={styles.sendArrow}>{'\u27A4'}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
  },
  accountButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
    }),
  },
  accountIcon: { fontSize: 20 },
  title: { fontFamily: fonts.bold, fontSize: 34, color: colors.text, letterSpacing: 0.4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 21 },
  monthContainer: { marginBottom: 40 },
  monthTitle: {
    fontFamily: fonts.semiBold, fontSize: 20, color: colors.text,
    opacity: 0.75, textAlign: 'center', marginBottom: 8,
  },
  dayHeaders: { flexDirection: 'row', gap: CELL_GAP, marginBottom: CELL_GAP },
  dayHeaderCell: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  dayHeaderText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textTertiary, textTransform: 'lowercase' },
  weekRow: { flexDirection: 'row', gap: CELL_GAP, marginBottom: CELL_GAP },
  cell: {
    flex: 1, height: CELL_HEIGHT, borderRadius: CELL_RADIUS,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12,
  },
  cellText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text, opacity: 0.55 },
  cellTextAssigned: { opacity: 0.7 },
  cellParentA: { backgroundColor: colors.parentA, borderWidth: 0.65, borderColor: colors.parentABorder },
  cellParentB: { backgroundColor: colors.parentB },
  cellPastMonth: { opacity: 0.45 },
  cellUnassigned: { backgroundColor: colors.unassigned },
  cellOverflow: { backgroundColor: colors.overflow, borderWidth: 0.5, borderColor: colors.overflowBorder },
  cellTextOverflow: { opacity: 0.2 },
  cellToday: { borderWidth: 1, borderColor: colors.todayBorder, opacity: 1 },
  cellTextToday: { color: colors.todayText, opacity: 1 },

  // FAB
  fab: {
    position: 'absolute', bottom: 30, right: 21, width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.fab, borderWidth: 1.25, borderColor: colors.text,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.32, shadowRadius: 25 },
      android: { elevation: 12 },
      web: { boxShadow: '0 10px 50px rgba(0,0,0,0.32)' },
    }),
  },
  fabIcon: { fontSize: 28 },

  // Chat sheet
  sheetContainer: { flex: 1, backgroundColor: colors.background },
  grabberRow: { alignItems: 'center', paddingTop: 8 },
  grabber: { width: 36, height: 5, borderRadius: 100, backgroundColor: '#CCC' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 17, color: colors.textSecondary },
  sheetTitle: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.text, letterSpacing: -0.43 },

  chatContent: { flex: 1, padding: 20 },
  aiBubble: {
    backgroundColor: colors.chatBubbleAI, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', marginBottom: 24,
  },
  aiText: { fontFamily: fonts.medium, fontSize: 14, color: '#494949', lineHeight: 22.4, letterSpacing: 0.14 },
  userMsgRow: { marginBottom: 16 },
  userTimestamp: {
    fontFamily: fonts.semiBold, fontSize: 14, color: colors.text, opacity: 0.45,
    marginBottom: 2, letterSpacing: -0.4,
  },
  userMsgText: { fontFamily: fonts.regular, fontSize: 14, color: '#000', lineHeight: 22.4, letterSpacing: -0.1 },

  chipsRow: { maxHeight: 70, marginBottom: 10 },
  chipsContent: { paddingHorizontal: 20, gap: 12, flexDirection: 'row' },
  chip: {
    backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
  },
  chipTitle: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text, letterSpacing: -0.4 },
  chipSub: { fontFamily: fonts.regular, fontSize: 16, color: colors.textSecondary, letterSpacing: -0.4 },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 30, paddingBottom: 30, paddingTop: 10,
  },
  inputField: {
    flex: 1, height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 7,
    justifyContent: 'center', paddingHorizontal: 14,
  },
  inputPlaceholder: { fontFamily: fonts.regular, fontSize: 16, color: '#A3A3A8', letterSpacing: 0.2 },
  sendArrow: { fontSize: 20, color: colors.text, marginLeft: 10 },
});
