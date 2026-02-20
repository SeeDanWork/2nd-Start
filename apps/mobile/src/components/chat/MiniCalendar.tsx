import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface MiniCalendarProps {
  /** 14-element array: 'A' for parentA, 'B' for parentB */
  assignments: string[];
  /** Days that are transition/handoff days (indices 0-13) */
  transitionDays?: number[];
}

export function MiniCalendar({ assignments, transitionDays = [] }: MiniCalendarProps) {
  const week1 = assignments.slice(0, 7);
  const week2 = assignments.slice(7, 14);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={styles.headerCell}>
            <Text style={styles.headerText}>{d}</Text>
          </View>
        ))}
      </View>
      {[week1, week2].map((week, weekIdx) => (
        <View key={weekIdx} style={styles.weekRow}>
          {week.map((parent, dayIdx) => {
            const globalIdx = weekIdx * 7 + dayIdx;
            const isTransition = transitionDays.includes(globalIdx);
            return (
              <View
                key={dayIdx}
                style={[
                  styles.dayCell,
                  parent === 'A' ? styles.parentA : styles.parentB,
                ]}
              >
                {isTransition && <View style={styles.transitionDot} />}
              </View>
            );
          })}
        </View>
      ))}
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
  transitionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
});
