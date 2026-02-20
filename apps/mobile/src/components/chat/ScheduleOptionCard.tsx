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
        <Text style={styles.score}>
          Score: {option.stats.score.toFixed(1)}
        </Text>
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
    return option.assignments.slice(0, 14).map((a: any) =>
      typeof a === 'string' ? a : a.parentId?.includes('B') ? 'B' : 'A',
    );
  }
  // Fallback: generate an alternating pattern based on profile name
  const name = option.profileName.toLowerCase();
  if (name.includes('week-on')) {
    return [
      'A', 'A', 'A', 'A', 'A', 'A', 'A',
      'B', 'B', 'B', 'B', 'B', 'B', 'B',
    ];
  }
  if (name.includes('2-2-3') || name.includes('223')) {
    return [
      'A', 'A', 'B', 'B', 'A', 'A', 'A',
      'B', 'B', 'A', 'A', 'B', 'B', 'B',
    ];
  }
  if (name.includes('3-4-4-3') || name.includes('3443')) {
    return [
      'A', 'A', 'A', 'B', 'B', 'B', 'B',
      'A', 'A', 'A', 'A', 'B', 'B', 'B',
    ];
  }
  if (name.includes('5-2')) {
    return [
      'A', 'A', 'A', 'A', 'A', 'B', 'B',
      'A', 'A', 'A', 'A', 'A', 'B', 'B',
    ];
  }
  // Default alternating
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
  score: {
    fontSize: 12,
    color: colors.textSecondary,
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
