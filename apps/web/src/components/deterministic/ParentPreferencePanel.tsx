import { useState, useCallback, CSSProperties } from 'react';
import type { ParentPreferenceInput, TemplateId } from '@adcp/shared';
import { TEMPLATES_V2 } from '@adcp/shared';

interface Props {
  onApply: (prefs: ParentPreferenceInput) => void;
}

type SubTab = 'sliders' | 'patterns';

const WEEKEND_OPTIONS: { value: ParentPreferenceInput['weekendPreference']; label: string }[] = [
  { value: 'equal', label: 'Equal weekends' },
  { value: 'primary_a', label: 'More to Father' },
  { value: 'primary_b', label: 'More to Mother' },
  { value: 'alternating', label: 'Alternating' },
];

// Match DeterministicCalendar / DeterministicSchedule color scheme
const FATHER_BG = '#ffedd0';
const MOTHER_BG = '#dcfee5';
const FATHER_TEXT = '#92400e';
const MOTHER_TEXT = '#166534';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Random Pattern Generation ───────────────────────────────────

interface GeneratedPattern {
  id: number;
  pattern: (0 | 1)[];
  nightsA: number;
  nightsB: number;
  handoffs: number;
  maxBlockA: number;
  maxBlockB: number;
  splitPct: number;
  weekendPref: ParentPreferenceInput['weekendPreference'];
}

/** Generate a random 14-day pattern using block-based approach for realistic schedules */
function generateRandomPattern(id: number): GeneratedPattern {
  const pattern: (0 | 1)[] = [];

  // Pick a strategy to get varied patterns
  const strategy = Math.random();

  if (strategy < 0.3) {
    // Block-based: alternate blocks of varying lengths
    let current: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    while (pattern.length < 14) {
      const maxRemaining = 14 - pattern.length;
      const blockLen = Math.min(maxRemaining, Math.floor(Math.random() * 5) + 1);
      for (let i = 0; i < blockLen; i++) pattern.push(current);
      current = current === 0 ? 1 : 0;
    }
  } else if (strategy < 0.6) {
    // Week-aligned: different patterns per week
    for (let week = 0; week < 2; week++) {
      const weekdayParent: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
      const weekendParent: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
      // Weekdays (Mon-Fri)
      for (let d = 0; d < 5; d++) {
        // Occasionally flip a mid-week day
        if (d === 2 && Math.random() < 0.4) {
          pattern.push(weekdayParent === 0 ? 1 : 0);
        } else {
          pattern.push(weekdayParent);
        }
      }
      // Weekend (Sat-Sun)
      pattern.push(weekendParent, weekendParent);
    }
  } else {
    // Symmetric rotation: repeating a 7-day sub-pattern
    const base: (0 | 1)[] = [];
    let current: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    while (base.length < 7) {
      const blockLen = Math.min(7 - base.length, Math.floor(Math.random() * 4) + 1);
      for (let i = 0; i < blockLen; i++) base.push(current);
      current = current === 0 ? 1 : 0;
    }
    // Week 2: flip the pattern for fairness variety
    if (Math.random() < 0.5) {
      pattern.push(...base, ...base.map((v) => (v === 0 ? 1 : 0) as 0 | 1));
    } else {
      pattern.push(...base, ...base);
    }
  }

  // Compute stats
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
  // Final run
  if (pattern[13] === 0) maxBlockA = Math.max(maxBlockA, runLen);
  else maxBlockB = Math.max(maxBlockB, runLen);

  const splitPct = Math.round((nightsA / 14) * 100);

  // Detect weekend preference from pattern
  const wk1Sat = pattern[5];
  const wk1Sun = pattern[6];
  const wk2Sat = pattern[12];
  const wk2Sun = pattern[13];
  const wk1A = (wk1Sat === 0 ? 1 : 0) + (wk1Sun === 0 ? 1 : 0);
  const wk2A = (wk2Sat === 0 ? 1 : 0) + (wk2Sun === 0 ? 1 : 0);
  let weekendPref: ParentPreferenceInput['weekendPreference'];
  if ((wk1A >= 2 && wk2A === 0) || (wk1A === 0 && wk2A >= 2)) {
    weekendPref = 'alternating';
  } else if (wk1A + wk2A === 2) {
    weekendPref = 'equal';
  } else if (wk1A + wk2A > 2) {
    weekendPref = 'primary_a';
  } else {
    weekendPref = 'primary_b';
  }

  return { id, pattern, nightsA, nightsB, handoffs, maxBlockA, maxBlockB, splitPct, weekendPref };
}

function generateFivePatterns(): GeneratedPattern[] {
  return Array.from({ length: 5 }, (_, i) => generateRandomPattern(i));
}

// ─── Pattern Grid Component ─────────────────────────────────────

function PatternGrid({ gp, selected, onSelect }: {
  gp: GeneratedPattern;
  selected: boolean;
  onSelect: () => void;
}) {
  const handoffsPerWeek = (gp.handoffs / 2).toFixed(1);

  return (
    <button
      onClick={onSelect}
      style={{
        ...styles.patternCard,
        borderColor: selected ? '#16a34a' : '#e5e7eb',
        backgroundColor: selected ? '#f0fdf4' : '#fff',
      }}
    >
      {/* 2-row grid: week 1 and week 2 */}
      <div style={styles.patternWeekRow}>
        <span style={styles.weekLabel}>Wk1</span>
        {gp.pattern.slice(0, 7).map((v, i) => (
          <div
            key={`w1-${i}`}
            style={{
              ...styles.dayCell,
              backgroundColor: v === 0 ? FATHER_BG : MOTHER_BG,
              color: v === 0 ? FATHER_TEXT : MOTHER_TEXT,
            }}
            title={`${DAY_LABELS[i]}: ${v === 0 ? 'Father' : 'Mother'}`}
          >
            {DAY_LABELS[i]}
          </div>
        ))}
      </div>
      <div style={styles.patternWeekRow}>
        <span style={styles.weekLabel}>Wk2</span>
        {gp.pattern.slice(7, 14).map((v, i) => (
          <div
            key={`w2-${i}`}
            style={{
              ...styles.dayCell,
              backgroundColor: v === 0 ? FATHER_BG : MOTHER_BG,
              color: v === 0 ? FATHER_TEXT : MOTHER_TEXT,
            }}
            title={`${DAY_LABELS[i]}: ${v === 0 ? 'Father' : 'Mother'}`}
          >
            {DAY_LABELS[i]}
          </div>
        ))}
      </div>
      {/* Stats line */}
      <div style={styles.patternStats}>
        <span><b>{gp.splitPct}%</b>/<b>{100 - gp.splitPct}%</b></span>
        <span>{handoffsPerWeek} handoffs/wk</span>
        <span>max {Math.max(gp.maxBlockA, gp.maxBlockB)}d</span>
      </div>
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function ParentPreferencePanel({ onApply }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('sliders');

  // Slider state
  const [targetSharePct, setTargetSharePct] = useState(50);
  const [maxHandoffsPerWeek, setMaxHandoffsPerWeek] = useState(3);
  const [maxConsecutiveAway, setMaxConsecutiveAway] = useState(5);
  const [weekendPreference, setWeekendPreference] = useState<ParentPreferenceInput['weekendPreference']>('equal');
  const [preferredTemplateId, setPreferredTemplateId] = useState<string>('');
  const [timeSplit, setTimeSplit] = useState(0.8);
  const [handoffs, setHandoffs] = useState(0.5);
  const [weekends, setWeekends] = useState(0.5);

  // Pattern tab state
  const [patterns, setPatterns] = useState<GeneratedPattern[]>(generateFivePatterns);
  const [selectedPatternIdx, setSelectedPatternIdx] = useState<number | null>(null);

  function buildPrefs(): ParentPreferenceInput {
    return {
      targetSharePct,
      maxHandoffsPerWeek,
      maxConsecutiveAway,
      weekendPreference,
      ...(preferredTemplateId ? { preferredTemplateId: preferredTemplateId as TemplateId } : {}),
      priorityWeights: { timeSplit, handoffs, weekends },
    };
  }

  function handleApply() {
    onApply(buildPrefs());
  }

  function handleShuffle() {
    setPatterns(generateFivePatterns());
    setSelectedPatternIdx(null);
  }

  const handleSelectPattern = useCallback((idx: number) => {
    setSelectedPatternIdx(idx);
    const gp = patterns[idx];

    // Auto-populate sliders from pattern stats
    setTargetSharePct(gp.splitPct);
    setMaxHandoffsPerWeek(Math.max(1, Math.min(7, Math.round(gp.handoffs / 2))));
    setMaxConsecutiveAway(Math.max(1, Math.min(14, Math.max(gp.maxBlockA, gp.maxBlockB))));
    setWeekendPreference(gp.weekendPref);

    // Auto-apply with derived preferences
    onApply({
      targetSharePct: gp.splitPct,
      maxHandoffsPerWeek: Math.max(1, Math.min(7, Math.round(gp.handoffs / 2))),
      maxConsecutiveAway: Math.max(1, Math.min(14, Math.max(gp.maxBlockA, gp.maxBlockB))),
      weekendPreference: gp.weekendPref,
      priorityWeights: { timeSplit, handoffs, weekends },
    });
  }, [patterns, onApply, timeSplit, handoffs, weekends]);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Parent Preferences</div>

      {/* Subtab bar */}
      <div style={styles.subTabBar}>
        <button
          onClick={() => setSubTab('sliders')}
          style={{
            ...styles.subTab,
            ...(subTab === 'sliders' ? styles.subTabActive : {}),
          }}
        >
          Preference Sliders
        </button>
        <button
          onClick={() => setSubTab('patterns')}
          style={{
            ...styles.subTab,
            ...(subTab === 'patterns' ? styles.subTabActive : {}),
          }}
        >
          Visual Patterns
        </button>
      </div>

      {/* ─── Sliders subtab ────────────────────────────────── */}
      {subTab === 'sliders' && (
        <div style={styles.content}>
          <div style={styles.field}>
            <label style={styles.label}>
              Time split (Father): <span style={styles.value}>{targetSharePct}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={targetSharePct}
              onChange={(e) => setTargetSharePct(Number(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.sliderLabels}>
              <span>0% (all Mother)</span>
              <span>50/50</span>
              <span>100% (all Father)</span>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              Max handoffs/week: <span style={styles.value}>{maxHandoffsPerWeek}</span>
            </label>
            <input
              type="range"
              min={1}
              max={7}
              value={maxHandoffsPerWeek}
              onChange={(e) => setMaxHandoffsPerWeek(Number(e.target.value))}
              style={styles.slider}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              Max nights away: <span style={styles.value}>{maxConsecutiveAway}</span>
            </label>
            <input
              type="range"
              min={1}
              max={14}
              value={maxConsecutiveAway}
              onChange={(e) => setMaxConsecutiveAway(Number(e.target.value))}
              style={styles.slider}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Weekend preference</label>
            <select
              value={weekendPreference}
              onChange={(e) => setWeekendPreference(e.target.value as ParentPreferenceInput['weekendPreference'])}
              style={styles.select}
            >
              {WEEKEND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Preferred template (optional)</label>
            <select
              value={preferredTemplateId}
              onChange={(e) => setPreferredTemplateId(e.target.value)}
              style={styles.select}
            >
              <option value="">None</option>
              {TEMPLATES_V2.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.splitRatio})</option>
              ))}
            </select>
          </div>

          <div style={styles.prioritySection}>
            <div style={styles.priorityTitle}>How much each preference matters:</div>
            <div style={styles.field}>
              <label style={styles.label}>
                Time split: <span style={styles.value}>{timeSplit.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={timeSplit * 10}
                onChange={(e) => setTimeSplit(Number(e.target.value) / 10)}
                style={styles.slider}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>
                Handoffs: <span style={styles.value}>{handoffs.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={handoffs * 10}
                onChange={(e) => setHandoffs(Number(e.target.value) / 10)}
                style={styles.slider}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>
                Weekends: <span style={styles.value}>{weekends.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={weekends * 10}
                onChange={(e) => setWeekends(Number(e.target.value) / 10)}
                style={styles.slider}
              />
            </div>
          </div>

          <button onClick={handleApply} style={styles.button}>
            Apply Preferences
          </button>
        </div>
      )}

      {/* ─── Visual Patterns subtab ────────────────────────── */}
      {subTab === 'patterns' && (
        <div style={styles.content}>
          <div style={styles.patternLegend}>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendSwatch, backgroundColor: FATHER_BG, border: `1px solid ${FATHER_TEXT}` }} />
              Father
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendSwatch, backgroundColor: MOTHER_BG, border: `1px solid ${MOTHER_TEXT}` }} />
              Mother
            </span>
          </div>

          <div style={styles.patternHint}>
            Pick a two-week pattern that feels right. Sliders will update to match.
          </div>

          <div style={styles.patternList}>
            {patterns.map((gp, idx) => (
              <PatternGrid
                key={`${gp.id}-${gp.pattern.join('')}`}
                gp={gp}
                selected={selectedPatternIdx === idx}
                onSelect={() => handleSelectPattern(idx)}
              />
            ))}
          </div>

          <div style={styles.patternButtons}>
            <button onClick={handleShuffle} style={styles.shuffleButton}>
              Shuffle Patterns
            </button>
            <button onClick={handleApply} style={styles.button}>
              Apply Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 220,
    borderRight: '1px solid #e5e7eb',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f0fdf4',
    fontWeight: 600,
    fontSize: 13,
    color: '#166534',
  },

  // ── Subtab bar ───────────────
  subTabBar: {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
  },
  subTab: {
    flex: 1,
    padding: '6px 8px',
    fontSize: 10,
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  subTabActive: {
    color: '#166534',
    fontWeight: 700,
    backgroundColor: '#fff',
    borderBottomColor: '#16a34a',
  },

  // ── Content ──────────────────
  content: {
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: '#374151',
  },
  value: {
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#166534',
  },
  slider: {
    width: '100%',
    height: 4,
    accentColor: '#16a34a',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    color: '#9ca3af',
  },
  select: {
    fontSize: 11,
    padding: '4px 6px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  prioritySection: {
    marginTop: 4,
    padding: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  priorityTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: '#6b7280',
  },
  button: {
    flex: 1,
    padding: '8px 16px',
    backgroundColor: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },

  // ── Pattern tab ──────────────
  patternLegend: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    padding: '4px 0',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    color: '#374151',
  },
  legendSwatch: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  patternHint: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center' as const,
    padding: '2px 0 4px',
  },
  patternList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  patternCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 6,
    border: '2px solid #e5e7eb',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background-color 0.15s',
    textAlign: 'left' as const,
    background: '#fff',
  },
  patternWeekRow: {
    display: 'flex',
    gap: 2,
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: '#9ca3af',
    width: 20,
    textAlign: 'right' as const,
    marginRight: 2,
  },
  dayCell: {
    flex: 1,
    height: 20,
    borderRadius: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 8,
    fontWeight: 700,
  },
  patternStats: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    color: '#6b7280',
    padding: '2px 22px 0',
  },
  patternButtons: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  },
  shuffleButton: {
    flex: 1,
    padding: '8px 16px',
    backgroundColor: '#fff',
    color: '#166534',
    border: '2px solid #16a34a',
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  },
};
