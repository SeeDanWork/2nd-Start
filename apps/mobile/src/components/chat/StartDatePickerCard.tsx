import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { colors } from '../../theme/colors';
import { useChatStore } from '../../stores/chat';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_TO_SHOW = 6;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

interface MonthData {
  year: number;
  month: number;
  rows: Array<Array<{ day: number; dateStr: string } | null>>;
}

function buildMonth(year: number, month: number): MonthData {
  const firstDow = new Date(year, month, 1).getDay();
  const total = daysInMonth(year, month);
  const cells: Array<{ day: number; dateStr: string } | null> = [];

  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: MonthData['rows'] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return { year, month, rows };
}

interface Props {
  disabled?: boolean;
}

export function StartDatePickerCard({ disabled }: Props) {
  const today = new Date();
  const todayStr = localDateStr(today);
  const [selected, setSelected] = useState<string | null>(null);

  const setWizardField = useChatStore((s) => s.setWizardField);
  const advanceOnboarding = useChatStore((s) => s.advanceOnboarding);

  const months = useMemo(() => {
    const result: MonthData[] = [];
    let y = today.getFullYear();
    let m = today.getMonth();
    for (let i = 0; i < MONTHS_TO_SHOW; i++) {
      result.push(buildMonth(y, m));
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return result;
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selected || disabled) return;
    setWizardField('scheduleStartDate', selected);
    advanceOnboarding();
  }, [selected, disabled, setWizardField, advanceOnboarding]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} nestedScrollEnabled>
        {/* Sticky-style DOW header */}
        <View style={styles.dowRow}>
          {DOW_LABELS.map((label, i) => (
            <View key={i} style={styles.dowCell}>
              <Text style={styles.dowText}>{label}</Text>
            </View>
          ))}
        </View>

        {months.map((md) => (
          <View key={`${md.year}-${md.month}`} style={styles.monthBlock}>
            <Text style={styles.monthTitle}>
              {MONTH_NAMES[md.month].toUpperCase()} {md.year}
            </Text>
            {md.rows.map((row, ri) => (
              <View key={ri} style={styles.weekRow}>
                {row.map((cell, ci) => {
                  if (!cell) {
                    return <View key={ci} style={styles.dayCell} />;
                  }
                  const isPast = cell.dateStr < todayStr;
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selected;

                  return (
                    <TouchableOpacity
                      key={ci}
                      style={[
                        styles.dayCell,
                        isPast ? styles.dayCellInactive : styles.dayCellActive,
                        isToday && !isSelected && styles.dayCellToday,
                        isSelected && styles.dayCellSelected,
                      ]}
                      disabled={isPast || disabled}
                      onPress={() => setSelected(cell.dateStr)}
                      activeOpacity={0.6}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isPast && styles.dayTextPast,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Confirm button pinned below scroll */}
      <TouchableOpacity
        style={[styles.confirmButton, !selected && styles.buttonDisabled]}
        onPress={handleConfirm}
        disabled={!selected || disabled}
      >
        <Text style={styles.confirmButtonText}>
          {selected ? `Start on ${selected}` : 'Select a date'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const CELL_SIZE = 44;
const CELL_GAP = 4;

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    padding: 12,
  },
  scroll: {
    maxHeight: 400,
  },
  dowRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
    marginBottom: CELL_GAP,
  },
  dowCell: {
    width: CELL_SIZE,
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dowText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  monthBlock: {
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C7C7CC',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1,
  },
  weekRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
    marginBottom: CELL_GAP,
  },
  dayCell: {
    flex: 1,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  dayCellActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  dayCellInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: colors.parentA,
  },
  dayCellSelected: {
    backgroundColor: colors.parentA,
    ...Platform.select({
      ios: {
        shadowColor: colors.parentA,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: `0px 4px 8px rgba(74, 144, 217, 0.3)`,
      },
    }),
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  dayTextPast: {
    color: '#C7C7CC',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  confirmButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
