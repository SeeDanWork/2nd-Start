import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { ChipOption } from '../../chat/types';

interface ChipRowProps {
  chips: ChipOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export function ChipRow({ chips, onSelect, disabled }: ChipRowProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handlePress = (value: string) => {
    if (disabled || selected) return;
    setSelected(value);
    onSelect(value);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chips.map((chip) => {
        const isSelected = selected === chip.value;
        const isDisabled = disabled || (selected !== null && !isSelected);
        return (
          <TouchableOpacity
            key={chip.value}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              isDisabled && styles.chipDisabled,
            ]}
            onPress={() => handlePress(chip.value)}
            disabled={isDisabled}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
                isDisabled && styles.chipTextDisabled,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.parentA,
    borderColor: colors.parentA,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipTextDisabled: {
    color: colors.neutral,
  },
});
