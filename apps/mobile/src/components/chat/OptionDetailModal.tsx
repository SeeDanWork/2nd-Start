import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { colors } from '../../theme/colors';
import { MiniCalendar } from './MiniCalendar';
import { ScheduleOption } from '../../stores/chat';

interface OptionDetailModalProps {
  option: ScheduleOption | null;
  visible: boolean;
  onClose: () => void;
  onSelect: (optionId: string) => void;
}

export function OptionDetailModal({
  option,
  visible,
  onClose,
  onSelect,
}: OptionDetailModalProps) {
  if (!option) return null;

  // Build pattern from assignments (same logic as ScheduleOptionCard)
  const pattern =
    option.assignments.length >= 14
      ? option.assignments.slice(0, 14).map((a: any) =>
          typeof a === 'string' ? a : a.parentId?.includes('B') ? 'B' : 'A',
        )
      : Array(14)
          .fill(null)
          .map((_, i) => (i % 4 < 2 ? 'A' : 'B'));

  const transitions: number[] = [];
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i] !== pattern[i - 1]) transitions.push(i);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{option.profileName}</Text>

            <View style={styles.calendarContainer}>
              <MiniCalendar assignments={pattern} transitionDays={transitions} />
            </View>

            <View style={styles.statsTable}>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>Parent A nights</Text>
                <Text style={styles.statsValue}>{option.stats.parentANights}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>Parent B nights</Text>
                <Text style={styles.statsValue}>{option.stats.parentBNights}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>Handoffs/week</Text>
                <Text style={styles.statsValue}>{option.stats.handoffs}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>Score</Text>
                <Text style={styles.statsValue}>{option.stats.score.toFixed(1)}</Text>
              </View>
            </View>

            {option.explanation.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>How it works</Text>
                {option.explanation.map((bullet, i) => (
                  <Text key={i} style={styles.bullet}>
                    {'\u2022'} {bullet}
                  </Text>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => onSelect(option.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.selectButtonText}>Use This Schedule</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  calendarContainer: {
    marginBottom: 20,
  },
  statsTable: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statsLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  selectButton: {
    backgroundColor: colors.parentA,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
