import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export type ScheduleMode = 'evidence' | 'vision' | 'balanced';

interface Props {
  activeMode: ScheduleMode;
  onSelectMode: (mode: ScheduleMode) => void;
  onDisabledTap?: () => void;
}

const MODES: { key: ScheduleMode; label: string; color: string }[] = [
  { key: 'evidence', label: 'Evidence Best', color: colors.modeEvidence },
  { key: 'vision', label: 'Parent Vision', color: colors.modeVision },
  { key: 'balanced', label: 'Balanced', color: colors.modeBalanced },
];

export function ModeSelector({ activeMode, onSelectMode, onDisabledTap }: Props) {
  return (
    <View style={styles.container}>
      {MODES.map((mode) => {
        const isActive = activeMode === mode.key;
        const isDisabled = mode.key !== 'evidence';

        return (
          <TouchableOpacity
            key={mode.key}
            style={[
              styles.pill,
              isActive && { backgroundColor: mode.color + '15', borderColor: mode.color },
              isDisabled && styles.pillDisabled,
            ]}
            onPress={() => {
              if (isDisabled) {
                onDisabledTap?.();
              } else {
                onSelectMode(mode.key);
              }
            }}
            activeOpacity={isDisabled ? 0.5 : 0.7}
          >
            <Text
              style={[
                styles.pillText,
                isActive && { color: mode.color, fontWeight: '700' },
                isDisabled && styles.pillTextDisabled,
              ]}
            >
              {mode.label}
            </Text>
            {isDisabled && (
              <Text style={styles.subText}>Apply preferences</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDisabled: {
    opacity: 0.5,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  pillTextDisabled: {
    color: colors.neutral,
  },
  subText: {
    fontSize: 8,
    color: colors.neutral,
    marginTop: 1,
  },
});
