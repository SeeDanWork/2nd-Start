import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { MiniCalendar } from './MiniCalendar';
import { ScheduleOption } from '../../stores/chat';

interface ScheduleOptionCardProps {
  option: ScheduleOption;
  onSelect: (optionId: string) => void;
  onDetail?: (optionId: string) => void;
}

export function ScheduleOptionCard({ option, onSelect, onDetail }: ScheduleOptionCardProps) {
  // Build a 14-day assignment pattern from the option's assignments
  // Default to alternating if no assignments
  const pattern = buildPattern(option);
  const transitions = findTransitions(pattern);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onDetail?.(option.id)}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{option.profileName}</Text>
        </View>
      </View>

      <View style={styles.scoresRow}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreValue}>{option.stats.stabilityScore.toFixed(2)}</Text>
          <Text style={styles.scoreLabel}>Stability</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreValue}>{option.stats.fairnessScore.toFixed(2)}</Text>
          <Text style={styles.scoreLabel}>Fairness</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreValue}>{option.stats.weekendParityScore.toFixed(2)}</Text>
          <Text style={styles.scoreLabel}>Weekends</Text>
        </View>
      </View>

      <MiniCalendar assignments={pattern} transitionDays={transitions} />

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {option.stats.parentANights}/{option.stats.parentBNights}
          </Text>
          <Text style={styles.statLabel}>nights</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{option.stats.handoffs}</Text>
          <Text style={styles.statLabel}>handoffs</Text>
        </View>
      </View>

      {option.explanation.slice(0, 2).map((bullet, i) => (
        <Text key={i} style={styles.bullet}>
          {'\u2022'} {bullet}
        </Text>
      ))}

      <TouchableOpacity
        style={styles.selectButton}
        onPress={() => onSelect(option.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.selectButtonText}>Use This Schedule</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function buildPattern(option: ScheduleOption): string[] {
  if (option.assignments.length >= 14) {
    // Determine start day-of-week from the first assignment's date
    const firstDate = new Date(option.assignments[0].date + 'T00:00:00');
    const startDow = firstDate.getDay(); // 0=Sun..6=Sat

    // Build a 14-cell grid aligned to Sunday starts
    // Pad the front if the schedule doesn't start on Sunday
    const grid: string[] = new Array(startDow).fill('');
    for (const a of option.assignments) {
      const parent = (a.parentId || '').toLowerCase().includes('b') ? 'B' : 'A';
      grid.push(parent);
    }
    // Pad the end to fill the last week row
    while (grid.length % 7 !== 0) {
      grid.push('');
    }
    return grid.slice(0, 21); // up to 3 weeks if needed
  }
  // Fallback: alternating pattern
  return [
    'A', 'A', 'B', 'B', 'A', 'A', 'B',
    'B', 'A', 'A', 'B', 'B', 'A', 'A',
  ];
}

function findTransitions(pattern: string[]): number[] {
  const transitions: number[] = [];
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i] !== pattern[i - 1]) {
      transitions.push(i);
    }
  }
  return transitions;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
    width: 280,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: colors.parentALight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.parentA,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  scoreLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    marginBottom: 8,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bullet: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 2,
  },
  selectButton: {
    backgroundColor: colors.parentA,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
