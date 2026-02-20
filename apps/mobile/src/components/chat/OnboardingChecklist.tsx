import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface ChecklistItem {
  label: string;
  done: boolean;
}

interface OnboardingChecklistProps {
  items: ChecklistItem[];
}

export function OnboardingChecklist({ items }: OnboardingChecklistProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Getting Started</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.icon}>{item.done ? '\u2713' : '\u25CB'}</Text>
          <Text style={[styles.label, item.done && styles.labelDone]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginVertical: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 16,
    marginRight: 10,
    color: colors.success,
    width: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    color: colors.text,
  },
  labelDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
});
