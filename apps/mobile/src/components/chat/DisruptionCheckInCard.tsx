import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useChatStore } from '../../stores/chat';

const DISRUPTION_SCENARIOS = [
  { id: 'school_closed', label: 'School closed today', icon: '🏫' },
  { id: 'child_sick', label: 'Child is sick', icon: '🤒' },
  { id: 'parent_a_traveling', label: 'Parent traveling (Father)', icon: '✈️' },
  { id: 'parent_b_traveling', label: 'Parent traveling (Mother)', icon: '✈️' },
  { id: 'holiday', label: 'Holiday / special event', icon: '🎉' },
  { id: 'supervised', label: 'Supervised visit required', icon: '👁️' },
  { id: 'weather', label: 'Weather/emergency closure', icon: '⛈️' },
  { id: 'other', label: 'Other', icon: '📝' },
];

interface Props {
  date?: string;
  disabled?: boolean;
}

export function DisruptionCheckInCard({ date, disabled }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const addMessage = useChatStore((s) => s.addMessage);

  const toggleItem = (id: string) => {
    if (disabled || submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0 || submitted || disabled) return;
    setSubmitted(true);

    const labels = DISRUPTION_SCENARIOS
      .filter((s) => selected.has(s.id))
      .map((s) => s.label.toLowerCase());
    const joined = labels.join(', ');

    const dateStr = date || new Date().toISOString().split('T')[0];

    addMessage({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      role: 'bot',
      content: `Got it — I've noted ${joined} for ${dateStr}. Your schedule has been adjusted.`,
      timestamp: Date.now(),
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.dateLabel}>
        {date || new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </Text>

      {DISRUPTION_SCENARIOS.map((scenario) => {
        const isSelected = selected.has(scenario.id);
        return (
          <TouchableOpacity
            key={scenario.id}
            style={[
              styles.row,
              isSelected && styles.rowSelected,
              submitted && styles.rowDisabled,
            ]}
            onPress={() => toggleItem(scenario.id)}
            disabled={disabled || submitted}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{scenario.icon}</Text>
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {scenario.label}
            </Text>
            <View style={[styles.radio, isSelected && styles.radioSelected]}>
              {isSelected && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[
          styles.submitButton,
          (selected.size === 0 || submitted) && styles.submitDisabled,
        ]}
        onPress={handleSubmit}
        disabled={selected.size === 0 || submitted || disabled}
      >
        <Text style={styles.submitText}>
          {submitted ? 'Submitted' : 'Submit'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 4,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 8,
  },
  rowSelected: {
    borderColor: colors.parentA,
    backgroundColor: colors.parentALight + '40',
  },
  rowDisabled: {
    opacity: 0.6,
  },
  icon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  labelSelected: {
    fontWeight: '600',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: colors.parentA,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.parentA,
  },
  submitButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.parentA,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
