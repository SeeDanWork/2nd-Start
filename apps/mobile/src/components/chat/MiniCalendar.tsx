import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface MiniCalendarProps {
  /** Array of 'A', 'B', or '' (empty/padding). Length is a multiple of 7. */
  assignments: string[];
  /** Days that are transition/handoff days (global indices) */
  transitionDays?: number[];
}

export function MiniCalendar({ assignments, transitionDays = [] }: MiniCalendarProps) {
  // Split into week rows (7 cells each)
  const weeks: string[][] = [];
  for (let i = 0; i < assignments.length; i += 7) {
    weeks.push(assignments.slice(i, i + 7));
  }
  // Show at most 3 weeks
  const visibleWeeks = weeks.slice(0, 3);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={styles.headerCell}>
            <Text style={styles.headerText}>{d}</Text>
          </View>
        ))}
      </View>
      {visibleWeeks.map((week, weekIdx) => (
        <View key={weekIdx} style={styles.weekRow}>
          {week.map((parent, dayIdx) => {
            const globalIdx = weekIdx * 7 + dayIdx;
            const isTransition = transitionDays.includes(globalIdx);
            const isEmpty = parent === '';
            return (
              <View
                key={dayIdx}
                style={[
                  styles.dayCell,
                  isEmpty
                    ? styles.emptyCell
                    : parent === 'A'
                      ? styles.parentA
                      : styles.parentB,
                ]}
              >
                {isTransition && !isEmpty && <View style={styles.transitionDot} />}
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.parentA]} />
          <Text style={styles.legendText}>You</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.parentB]} />
          <Text style={styles.legendText}>Co-parent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Handoff</Text>
        </View>
      </View>
    </View>
  );
}

const CELL_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentA: {
    backgroundColor: colors.parentALight,
  },
  parentB: {
    backgroundColor: colors.parentBLight,
  },
  emptyCell: {
    backgroundColor: 'transparent',
  },
  transitionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
