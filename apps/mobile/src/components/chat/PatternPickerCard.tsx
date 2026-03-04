import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useChatStore } from '../../stores/chat';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type WeekendPref = 'alternate' | 'fixed' | 'flexible';

interface GeneratedPattern {
  id: number;
  pattern: (0 | 1)[];
  nightsA: number;
  nightsB: number;
  handoffs: number;
  maxBlockA: number;
  maxBlockB: number;
  splitPct: number;
  weekendPref: WeekendPref;
}

function generateRandomPattern(id: number): GeneratedPattern {
  const pattern: (0 | 1)[] = [];
  const strategy = Math.random();

  if (strategy < 0.3) {
    let current: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    while (pattern.length < 14) {
      const maxRemaining = 14 - pattern.length;
      const blockLen = Math.min(maxRemaining, Math.floor(Math.random() * 5) + 1);
      for (let i = 0; i < blockLen; i++) pattern.push(current);
      current = current === 0 ? 1 : 0;
    }
  } else if (strategy < 0.6) {
    for (let week = 0; week < 2; week++) {
      const weekdayParent: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
      const weekendParent: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
      for (let d = 0; d < 5; d++) {
        if (d === 2 && Math.random() < 0.4) {
          pattern.push(weekdayParent === 0 ? 1 : 0);
        } else {
          pattern.push(weekdayParent);
        }
      }
      pattern.push(weekendParent, weekendParent);
    }
  } else {
    const base: (0 | 1)[] = [];
    let current: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    while (base.length < 7) {
      const blockLen = Math.min(7 - base.length, Math.floor(Math.random() * 4) + 1);
      for (let i = 0; i < blockLen; i++) base.push(current);
      current = current === 0 ? 1 : 0;
    }
    if (Math.random() < 0.5) {
      pattern.push(...base, ...base.map((v) => (v === 0 ? 1 : 0) as 0 | 1));
    } else {
      pattern.push(...base, ...base);
    }
  }

  const nightsA = pattern.filter((v) => v === 0).length;
  const nightsB = 14 - nightsA;

  let handoffs = 0;
  for (let i = 1; i < 14; i++) {
    if (pattern[i] !== pattern[i - 1]) handoffs++;
  }

  let maxBlockA = 0;
  let maxBlockB = 0;
  let runLen = 1;
  for (let i = 1; i < 14; i++) {
    if (pattern[i] === pattern[i - 1]) {
      runLen++;
    } else {
      if (pattern[i - 1] === 0) maxBlockA = Math.max(maxBlockA, runLen);
      else maxBlockB = Math.max(maxBlockB, runLen);
      runLen = 1;
    }
  }
  if (pattern[13] === 0) maxBlockA = Math.max(maxBlockA, runLen);
  else maxBlockB = Math.max(maxBlockB, runLen);

  const splitPct = Math.round((nightsA / 14) * 100);

  const wk1Sat = pattern[5];
  const wk1Sun = pattern[6];
  const wk2Sat = pattern[12];
  const wk2Sun = pattern[13];
  const wk1A = (wk1Sat === 0 ? 1 : 0) + (wk1Sun === 0 ? 1 : 0);
  const wk2A = (wk2Sat === 0 ? 1 : 0) + (wk2Sun === 0 ? 1 : 0);
  let weekendPref: WeekendPref;
  if ((wk1A >= 2 && wk2A === 0) || (wk1A === 0 && wk2A >= 2)) {
    weekendPref = 'alternate';
  } else if (wk1A + wk2A >= 2) {
    weekendPref = 'flexible';
  } else {
    weekendPref = 'fixed';
  }

  return { id, pattern, nightsA, nightsB, handoffs, maxBlockA, maxBlockB, splitPct, weekendPref };
}

function generateFivePatterns(): GeneratedPattern[] {
  return Array.from({ length: 5 }, (_, i) => generateRandomPattern(i));
}

interface Props {
  disabled?: boolean;
}

export function PatternPickerCard({ disabled }: Props) {
  const [patterns, setPatterns] = useState<GeneratedPattern[]>(generateFivePatterns);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const setWizardField = useChatStore((s) => s.setWizardField);
  const advanceOnboarding = useChatStore((s) => s.advanceOnboarding);

  const handleSelect = useCallback((idx: number) => {
    if (disabled) return;
    setSelectedIdx(idx);
    const gp = patterns[idx];
    setWizardField('targetSharePct', gp.splitPct);
    setWizardField('maxHandoffsPerWeek', Math.max(1, Math.min(7, Math.round(gp.handoffs / 2))));
    setWizardField('maxConsecutiveAway', Math.max(1, Math.min(14, Math.max(gp.maxBlockA, gp.maxBlockB))));
    setWizardField('weekendPreference', gp.weekendPref);
  }, [patterns, disabled, setWizardField]);

  const handleShuffle = () => {
    if (disabled) return;
    setPatterns(generateFivePatterns());
    setSelectedIdx(null);
  };

  const handleConfirm = () => {
    if (selectedIdx === null || disabled) return;
    advanceOnboarding();
  };

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.parentALight }]} />
          <Text style={styles.legendText}>Father</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.parentBLight }]} />
          <Text style={styles.legendText}>Mother</Text>
        </View>
      </View>

      {/* Pattern cards */}
      {patterns.map((gp, idx) => {
        const isSelected = selectedIdx === idx;
        const handoffsPerWeek = (gp.handoffs / 2).toFixed(1);
        return (
          <TouchableOpacity
            key={`${gp.id}-${gp.pattern.join('')}`}
            style={[
              styles.patternCard,
              isSelected && styles.patternCardSelected,
            ]}
            onPress={() => handleSelect(idx)}
            disabled={disabled}
            activeOpacity={0.7}
          >
            {/* Week 1 */}
            <View style={styles.weekRow}>
              <Text style={styles.weekLabel}>Wk1</Text>
              {gp.pattern.slice(0, 7).map((v, i) => (
                <View
                  key={`w1-${i}`}
                  style={[
                    styles.dayCell,
                    { backgroundColor: v === 0 ? colors.parentALight : colors.parentBLight },
                  ]}
                >
                  <Text style={styles.dayCellText}>{DAY_LABELS[i]}</Text>
                </View>
              ))}
            </View>
            {/* Week 2 */}
            <View style={styles.weekRow}>
              <Text style={styles.weekLabel}>Wk2</Text>
              {gp.pattern.slice(7, 14).map((v, i) => (
                <View
                  key={`w2-${i}`}
                  style={[
                    styles.dayCell,
                    { backgroundColor: v === 0 ? colors.parentALight : colors.parentBLight },
                  ]}
                >
                  <Text style={styles.dayCellText}>{DAY_LABELS[i]}</Text>
                </View>
              ))}
            </View>
            {/* Stats */}
            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {gp.splitPct}%/{100 - gp.splitPct}%
              </Text>
              <Text style={styles.statsText}>{handoffsPerWeek} handoffs/wk</Text>
              <Text style={styles.statsText}>
                max {Math.max(gp.maxBlockA, gp.maxBlockB)}d
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.shuffleButton}
          onPress={handleShuffle}
          disabled={disabled}
        >
          <Text style={styles.shuffleButtonText}>Shuffle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            selectedIdx === null && styles.buttonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={selectedIdx === null || disabled}
        >
          <Text style={styles.confirmButtonText}>Use This Pattern</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 6,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  patternCard: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    backgroundColor: colors.background,
    gap: 4,
  },
  patternCardSelected: {
    borderColor: colors.success,
    backgroundColor: '#f0fdf4',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  weekLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.neutral,
    width: 22,
    textAlign: 'right',
    marginRight: 2,
  },
  dayCell: {
    flex: 1,
    height: 24,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 2,
  },
  statsText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  shuffleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
  },
  shuffleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
