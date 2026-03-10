import { useState, CSSProperties } from 'react';
import { useScenarioStore } from '../../stores/scenario';
import { SCENARIO_PRESETS, SCENARIO_CATEGORIES } from './scenarioPresets';
import { generateChaosEvents } from './scheduleEngine';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ScenarioControls({ open, onClose }: Props) {
  const store = useScenarioStore();
  const [activeSection, setActiveSection] = useState<string>('scenarios');
  const [chaosDays, setChaosDays] = useState(60);

  if (!open) return null;

  function runChaos() {
    const events = generateChaosEvents(store.currentDate, chaosDays);
    for (const e of events) {
      store.addDisruption(e);
    }
  }

  const sectionButton = (id: string, label: string) => (
    <button
      style={{
        ...s.sectionBtn,
        ...(activeSection === id ? s.sectionBtnActive : {}),
      }}
      onClick={() => setActiveSection(id)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div style={s.backdrop} onClick={onClose} />
      <div style={s.panel}>
        <div style={s.header}>
          <span style={s.headerTitle}>Scenario Controls</span>
          <button style={s.closeBtn} onClick={onClose}>x</button>
        </div>

        {/* Section tabs */}
        <div style={s.sectionBar}>
          {sectionButton('scenarios', 'Scenarios')}
          {sectionButton('family', 'Family')}
          {sectionButton('constraints', 'Constraints')}
          {sectionButton('chaos', 'Chaos')}
        </div>

        <div style={s.body}>
          {/* Scenario Library */}
          {activeSection === 'scenarios' && (
            <div style={s.section}>
              {SCENARIO_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <div style={s.catLabel}>{cat}</div>
                  {SCENARIO_PRESETS.filter((p) => p.category === cat).map((preset) => (
                    <button
                      key={preset.id}
                      style={{
                        ...s.presetBtn,
                        ...(store.scenarioName === preset.name ? s.presetBtnActive : {}),
                      }}
                      onClick={() => { store.loadPreset(preset); onClose(); }}
                      title={preset.description}
                    >
                      <div style={s.presetName}>{preset.name}</div>
                      <div style={s.presetDesc}>{preset.description}</div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Family Configuration */}
          {activeSection === 'family' && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Family Setup</div>
              <label style={s.label}>
                Children: {store.family.childCount}
                <input type="range" min={1} max={5} value={store.family.childCount}
                  onChange={(e) => {
                    const count = Number(e.target.value);
                    const ages = store.family.childAges.slice(0, count);
                    while (ages.length < count) ages.push(7);
                    store.setFamily({ childCount: count, childAges: ages });
                  }}
                  style={s.slider} />
              </label>
              <div style={s.ageRow}>
                {store.family.childAges.map((age, i) => (
                  <label key={i} style={s.ageLabel}>
                    Child {i + 1}
                    <input type="number" min={0} max={18} value={age}
                      onChange={(e) => {
                        const ages = [...store.family.childAges];
                        ages[i] = Number(e.target.value);
                        store.setFamily({ childAges: ages });
                      }}
                      style={s.numberInput} />
                  </label>
                ))}
              </div>
              <label style={s.label}>
                Distance: {store.family.distanceMiles} mi
                <input type="range" min={1} max={120} value={store.family.distanceMiles}
                  onChange={(e) => store.setFamily({ distanceMiles: Number(e.target.value) })}
                  style={s.slider} />
              </label>
              <label style={s.label}>
                Target Split: {store.family.targetSplit}/{100 - store.family.targetSplit}
                <input type="range" min={20} max={80} value={store.family.targetSplit}
                  onChange={(e) => store.setFamily({ targetSplit: Number(e.target.value) })}
                  style={s.slider} />
              </label>
              <label style={s.label}>
                Arrangement
                <select value={store.family.arrangement}
                  onChange={(e) => store.setFamily({ arrangement: e.target.value as any })}
                  style={s.select}>
                  <option value="shared">Shared</option>
                  <option value="primary_visits">Primary + Visits</option>
                  <option value="undecided">Undecided</option>
                </select>
              </label>
              <label style={s.label}>
                School Anchor
                <input type="text" value={store.family.schoolAnchor}
                  onChange={(e) => store.setFamily({ schoolAnchor: e.target.value })}
                  style={s.textInput} />
              </label>
              <label style={s.label}>
                Exchange Location
                <input type="text" value={store.family.exchangeLocation}
                  onChange={(e) => store.setFamily({ exchangeLocation: e.target.value })}
                  style={s.textInput} />
              </label>
            </div>
          )}

          {/* Constraint Editor */}
          {activeSection === 'constraints' && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Constraints</div>
              <label style={s.label}>
                Max Consecutive: {store.constraints.maxConsecutive}
                <input type="range" min={1} max={14} value={store.constraints.maxConsecutive}
                  onChange={(e) => store.setConstraints({ maxConsecutive: Number(e.target.value) })}
                  style={s.slider} />
              </label>
              <label style={s.label}>
                Min Consecutive: {store.constraints.minConsecutive}
                <input type="range" min={1} max={7} value={store.constraints.minConsecutive}
                  onChange={(e) => store.setConstraints({ minConsecutive: Number(e.target.value) })}
                  style={s.slider} />
              </label>
              <label style={s.label}>
                Max Transitions/Week: {store.constraints.maxTransitionsPerWeek}
                <input type="range" min={1} max={7} value={store.constraints.maxTransitionsPerWeek}
                  onChange={(e) => store.setConstraints({ maxTransitionsPerWeek: Number(e.target.value) })}
                  style={s.slider} />
              </label>
              <label style={s.label}>
                Fairness Band: +/- {store.constraints.fairnessBand}%
                <input type="range" min={1} max={20} value={store.constraints.fairnessBand}
                  onChange={(e) => store.setConstraints({ fairnessBand: Number(e.target.value) })}
                  style={s.slider} />
              </label>
              <label style={s.label}>
                Weekend Split
                <select value={store.constraints.weekendSplit}
                  onChange={(e) => store.setConstraints({ weekendSplit: e.target.value as any })}
                  style={s.select}>
                  <option value="alternating">Alternating</option>
                  <option value="split">Split</option>
                  <option value="none">None</option>
                </select>
              </label>
              <div style={s.lockGrid}>
                <div style={s.lockLabel}>Locked Nights (click to cycle: none → A → B)</div>
                <div style={s.dayRow}>
                  {DAYS.map((day, i) => {
                    const locked = store.constraints.lockedNights[String(i)];
                    return (
                      <button key={i}
                        style={{
                          ...s.dayCell,
                          backgroundColor: locked === 'parent_a' ? '#ffedd0' : locked === 'parent_b' ? '#dcfee5' : '#f3f4f6',
                          fontWeight: locked ? 700 : 400,
                        }}
                        onClick={() => {
                          const next = !locked ? 'parent_a' : locked === 'parent_a' ? 'parent_b' : undefined;
                          const newLocks = { ...store.constraints.lockedNights };
                          if (next) newLocks[String(i)] = next;
                          else delete newLocks[String(i)];
                          store.setConstraints({ lockedNights: newLocks });
                        }}>
                        <div style={s.dayCellDay}>{day}</div>
                        <div style={s.dayCellVal}>{locked ? (locked === 'parent_a' ? 'A' : 'B') : '-'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Chaos Mode */}
          {activeSection === 'chaos' && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Chaos Mode</div>
              <p style={s.chaosDesc}>
                Generate random disruptions over a simulated timeline to stress-test the scheduler.
              </p>
              <label style={s.label}>
                Days to simulate: {chaosDays}
                <input type="range" min={7} max={180} value={chaosDays}
                  onChange={(e) => setChaosDays(Number(e.target.value))}
                  style={s.slider} />
              </label>
              <button style={s.chaosBtn} onClick={() => { runChaos(); onClose(); }}>
                Generate Chaos ({chaosDays} days)
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const s: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 200,
  },
  panel: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    bottom: 0,
    width: 380,
    backgroundColor: '#fff',
    zIndex: 201,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    flexShrink: 0,
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: 14,
  },
  closeBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  sectionBar: {
    display: 'flex',
    gap: 0,
    padding: '0 4px',
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  sectionBtn: {
    flex: 1,
    padding: '8px 4px',
    fontSize: 11,
    fontWeight: 500,
    border: 'none',
    borderBottom: '2px solid transparent',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#6b7280',
    textAlign: 'center' as const,
  },
  sectionBtnActive: {
    color: '#4A90D9',
    fontWeight: 700,
    borderBottomColor: '#4A90D9',
    backgroundColor: '#fff',
  },
  body: {
    flex: 1,
    overflow: 'auto',
  },
  section: {
    padding: '12px 14px',
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 12,
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  catLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  presetBtn: {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '8px 10px',
    fontSize: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    backgroundColor: '#fff',
    cursor: 'pointer',
    color: '#374151',
    marginBottom: 4,
  },
  presetBtnActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
    color: '#1e40af',
  },
  presetName: {
    fontWeight: 600,
    marginBottom: 2,
  },
  presetDesc: {
    fontSize: 10,
    color: '#9ca3af',
    lineHeight: '14px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: 12,
    color: '#374151',
    fontWeight: 500,
    marginBottom: 10,
    gap: 4,
  },
  slider: {
    width: '100%',
    accentColor: '#4A90D9',
  },
  select: {
    padding: '6px 8px',
    fontSize: 12,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  textInput: {
    padding: '6px 8px',
    fontSize: 12,
    border: '1px solid #d1d5db',
    borderRadius: 4,
  },
  numberInput: {
    width: 52,
    padding: '4px 6px',
    fontSize: 12,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    textAlign: 'center' as const,
  },
  ageRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap' as const,
  },
  ageLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: 11,
    color: '#6b7280',
    gap: 4,
  },
  lockGrid: {
    marginTop: 12,
  },
  lockLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 6,
  },
  dayRow: {
    display: 'flex',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '6px 0',
    borderRadius: 4,
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    fontSize: 11,
  },
  dayCellDay: {
    fontSize: 9,
    color: '#9ca3af',
  },
  dayCellVal: {
    fontSize: 14,
    fontWeight: 600,
  },
  chaosDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: '18px',
  },
  chaosBtn: {
    width: '100%',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
};
