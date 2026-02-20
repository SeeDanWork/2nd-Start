import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayChipRowProps {
  selected: number[];
  onChange: (days: number[]) => void;
  label?: string;
  disabled?: boolean;
}

export function DayChipRow({ selected, onChange, label, disabled }: DayChipRowProps) {
  const toggle = (day: number) => {
    if (disabled) return;
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day));
    } else {
      onChange([...selected, day]);
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {DAY_LABELS.map((dayLabel, index) => {
          const isActive = selected.includes(index);
          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayChip, isActive && styles.dayChipActive]}
              onPress={() => toggle(index)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.dayChipText, isActive && styles.dayChipTextActive]}
              >
                {dayLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: colors.parentA,
    borderColor: colors.parentA,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
});
