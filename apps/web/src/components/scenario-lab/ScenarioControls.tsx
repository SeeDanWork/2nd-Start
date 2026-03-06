import { useState, CSSProperties } from 'react';
import { DisruptionEventType, RequestType, RequestUrgency, ParentRole } from '@adcp/shared';
import { useScenarioStore } from '../../stores/scenario';
import type { DisruptionEntry, RequestEntry } from '../../stores/scenario';
import { SCENARIO_PRESETS, SCENARIO_CATEGORIES } from './scenarioPresets';
import { generateChaosEvents } from './scheduleEngine';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DISRUPTION_BUTTONS: Array<{ type: DisruptionEventType; label: string; color: string }> = [
  { type: DisruptionEventType.SCHOOL_CLOSED, label: 'School Closure', color: '#f59e0b' },
  { type: DisruptionEventType.CHILD_SICK, label: 'Sick Child', color: '#ef4444' },
  { type: DisruptionEventType.PARENT_TRAVEL, label: 'Parent Travel', color: '#3b82f6' },
  { type: DisruptionEventType.WEATHER_EMERGENCY, label: 'Weather', color: '#6366f1' },
  { type: DisruptionEventType.CAMP_WEEK, label: 'Camp Week', color: '#22c55e' },
  { type: DisruptionEventType.PUBLIC_HOLIDAY, label: 'Holiday', color: '#ec4899' },
  { type: DisruptionEventType.TRANSPORT_FAILURE, label: 'Transport Fail', color: '#64748b' },
];

let nextId = 1;

export function ScenarioControls() {
  const store = useScenarioStore();
  const [disruptionStart, setDisruptionStart] = useState('');
  const [disruptionEnd, setDisruptionEnd] = useState('');
  const [selectedDisType, setSelectedDisType] = useState<DisruptionEventType>(DisruptionEventType.SCHOOL_CLOSED);
  const [affectedParent, setAffectedParent] = useState('');
  const [activeSection, setActiveSection] = useState<string>('family');
  const [chaosDays, setChaosDays] = useState(60);

  function addDisruption() {
    if (!disruptionStart) return;
    const entry: DisruptionEntry = {
      id: `dis-${nextId++}`,
      type: selectedDisType,
      startDate: disruptionStart,
      endDate: disruptionEnd || disruptionStart,
      affectedParent: affectedParent || undefined,
      description: `${selectedDisType}`,
    };
    store.addDisruption(entry);
    setDisruptionStart('');
    setDisruptionEnd('');
  }

  function addQuickDisruption(type: DisruptionEventType) {
    const today = store.currentDate;
    const entry: DisruptionEntry = {
      id: `dis-${nextId++}`,
      type,
      startDate: today,
      endDate: today,
      description: `Quick: ${type}`,
    };
    store.addDisruption(entry);
  }

  function addRequest(type: RequestType) {
    const entry: RequestEntry = {
      id: `req-${nextId++}`,
      type,
      urgency: RequestUrgency.NORMAL,
      requestingParent: ParentRole.PARENT_A,
      dates: [store.currentDate],
      reason: `${type} request`,
    };
    store.addRequest(entry);
  }

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
      onClick={() => setActiveSection(activeSection === id ? '' : id)}
    >
      {label}
    </button>
  );

  return (
    <div style={s.root}>
      <div style={s.header}>Scenario Control</div>

      {/* Scenario Library */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Scenario Library</div>
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
                onClick={() => store.loadPreset(preset)}
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Collapsible sections */}
      <div style={s.sectionBar}>
        {sectionButton('family', 'Family')}
        {sectionButton('constraints', 'Constraints')}
        {sectionButton('disruptions', 'Disruptions')}
        {sectionButton('requests', 'Requests')}
        {sectionButton('chaos', 'Chaos')}
      </div>

      {/* Family Configuration */}
      {activeSection === 'family' && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Family Setup</div>
          <label style={s.label}>
            Children: {store.family.childCount}
            <input
              type="range"
              min={1}
              max={5}
              value={store.family.childCount}
              onChange={(e) => {
                const count = Number(e.target.value);
                const ages = store.family.childAges.slice(0, count);
                while (ages.length < count) ages.push(7);
                store.setFamily({ childCount: count, childAges: ages });
              }}
              style={s.slider}
            />
          </label>
          <div style={s.ageRow}>
            {store.family.childAges.map((age, i) => (
              <label key={i} style={s.ageLabel}>
                Child {i + 1}
                <input
                  type="number"
                  min={0}
                  max={18}
                  value={age}
                  onChange={(e) => {
                    const ages = [...store.family.childAges];
                    ages[i] = Number(e.target.value);
                    store.setFamily({ childAges: ages });
                  }}
                  style={s.numberInput}
                />
              </label>
            ))}
          </div>
          <label style={s.label}>
            Distance: {store.family.distanceMiles} mi
            <input
              type="range"
              min={1}
              max={120}
              value={store.family.distanceMiles}
              onChange={(e) => store.setFamily({ distanceMiles: Number(e.target.value) })}
              style={s.slider}
            />
          </label>
          <label style={s.label}>
            Target Split: {store.family.targetSplit}/{100 - store.family.targetSplit}
            <input
              type="range"
              min={20}
              max={80}
              value={store.family.targetSplit}
              onChange={(e) => store.setFamily({ targetSplit: Number(e.target.value) })}
              style={s.slider}
            />
          </label>
          <label style={s.label}>
            Arrangement
            <select
              value={store.family.arrangement}
              onChange={(e) => store.setFamily({ arrangement: e.target.value as any })}
              style={s.select}
            >
              <option value="shared">Shared</option>
              <option value="primary_visits">Primary + Visits</option>
              <option value="undecided">Undecided</option>
            </select>
          </label>
          <label style={s.label}>
            School Anchor
            <input
              type="text"
              value={store.family.schoolAnchor}
              onChange={(e) => store.setFamily({ schoolAnchor: e.target.value })}
              style={s.textInput}
            />
          </label>
          <label style={s.label}>
            Exchange Location
            <input
              type="text"
              value={store.family.exchangeLocation}
              onChange={(e) => store.setFamily({ exchangeLocation: e.target.value })}
              style={s.textInput}
            />
          </label>
        </div>
      )}

      {/* Constraint Editor */}
      {activeSection === 'constraints' && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Constraints</div>
          <label style={s.label}>
            Max Consecutive: {store.constraints.maxConsecutive}
            <input
              type="range"
              min={1}
              max={14}
              value={store.constraints.maxConsecutive}
              onChange={(e) => store.setConstraints({ maxConsecutive: Number(e.target.value) })}
              style={s.slider}
            />
          </label>
          <label style={s.label}>
            Min Consecutive: {store.constraints.minConsecutive}
            <input
              type="range"
              min={1}
              max={7}
              value={store.constraints.minConsecutive}
              onChange={(e) => store.setConstraints({ minConsecutive: Number(e.target.value) })}
              style={s.slider}
            />
          </label>
          <label style={s.label}>
            Max Transitions/Week: {store.constraints.maxTransitionsPerWeek}
            <input
              type="range"
              min={1}
              max={7}
              value={store.constraints.maxTransitionsPerWeek}
              onChange={(e) => store.setConstraints({ maxTransitionsPerWeek: Number(e.target.value) })}
              style={s.slider}
            />
          </label>
          <label style={s.label}>
            Fairness Band: +/- {store.constraints.fairnessBand}%
            <input
              type="range"
              min={1}
              max={20}
              value={store.constraints.fairnessBand}
              onChange={(e) => store.setConstraints({ fairnessBand: Number(e.target.value) })}
              style={s.slider}
            />
          </label>
          <label style={s.label}>
            Weekend Split
            <select
              value={store.constraints.weekendSplit}
              onChange={(e) => store.setConstraints({ weekendSplit: e.target.value as any })}
              style={s.select}
            >
              <option value="alternating">Alternating</option>
              <option value="split">Split</option>
              <option value="none">None</option>
            </select>
          </label>
          <div style={s.lockGrid}>
            <div style={s.lockLabel}>Locked Nights</div>
            <div style={s.dayRow}>
              {DAYS.map((day, i) => {
                const locked = store.constraints.lockedNights[String(i)];
                return (
                  <button
                    key={i}
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
                    }}
                    title={`Click to cycle: none → A → B → none`}
                  >
                    <div style={s.dayCellDay}>{day}</div>
                    <div style={s.dayCellVal}>{locked ? (locked === 'parent_a' ? 'A' : 'B') : '-'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Disruption Generator */}
      {activeSection === 'disruptions' && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Disruptions</div>
          <div style={s.quickBtns}>
            {DISRUPTION_BUTTONS.map((d) => (
              <button
                key={d.type}
                style={{ ...s.quickBtn, borderColor: d.color, color: d.color }}
                onClick={() => addQuickDisruption(d.type)}
                title={`Add ${d.label} on ${store.currentDate}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div style={s.formRow}>
            <select
              value={selectedDisType}
              onChange={(e) => setSelectedDisType(e.target.value as DisruptionEventType)}
              style={s.select}
            >
              {Object.values(DisruptionEventType).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={s.formRow}>
            <input type="date" value={disruptionStart} onChange={(e) => setDisruptionStart(e.target.value)} style={s.dateInput} />
            <span style={s.formSep}>to</span>
            <input type="date" value={disruptionEnd} onChange={(e) => setDisruptionEnd(e.target.value)} style={s.dateInput} />
          </div>
          <div style={s.formRow}>
            <select value={affectedParent} onChange={(e) => setAffectedParent(e.target.value)} style={s.select}>
              <option value="">No specific parent</option>
              <option value="parent_a">Parent A</option>
              <option value="parent_b">Parent B</option>
            </select>
            <button style={s.addBtn} onClick={addDisruption}>+ Add</button>
          </div>
          {/* Active disruptions list */}
          {store.disruptions.length > 0 && (
            <div style={s.activeList}>
              {store.disruptions.map((d) => (
                <div key={d.id} style={s.activeItem}>
                  <span style={s.activeType}>{d.type}</span>
                  <span style={s.activeDates}>{d.startDate}{d.endDate !== d.startDate ? ` → ${d.endDate}` : ''}</span>
                  <button style={s.removeBtn} onClick={() => store.removeDisruption(d.id)}>x</button>
                </div>
              ))}
              <button style={s.clearBtn} onClick={store.clearDisruptions}>Clear All</button>
            </div>
          )}
        </div>
      )}

      {/* Request Generator */}
      {activeSection === 'requests' && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Requests</div>
          <div style={s.quickBtns}>
            <button style={s.reqBtn} onClick={() => addRequest(RequestType.NEED_COVERAGE)}>Need Coverage</button>
            <button style={s.reqBtn} onClick={() => addRequest(RequestType.WANT_TIME)}>Want Extra Time</button>
            <button style={s.reqBtn} onClick={() => addRequest(RequestType.SWAP_DATE)}>Swap Days</button>
            <button style={s.reqBtn} onClick={() => addRequest(RequestType.BONUS_WEEK)}>Bonus Weekend</button>
          </div>
          {store.requests.length > 0 && (
            <div style={s.activeList}>
              {store.requests.map((r) => (
                <div key={r.id} style={s.activeItem}>
                  <span style={s.activeType}>{r.type}</span>
                  <span style={s.activeDates}>{r.requestingParent}</span>
                  <button style={s.removeBtn} onClick={() => store.removeRequest(r.id)}>x</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chaos Mode */}
      {activeSection === 'chaos' && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Chaos Mode</div>
          <p style={s.chaosDesc}>
            Generate random disruptions and requests over a simulated timeline.
          </p>
          <label style={s.label}>
            Days to simulate: {chaosDays}
            <input
              type="range"
              min={7}
              max={180}
              value={chaosDays}
              onChange={(e) => setChaosDays(Number(e.target.value))}
              style={s.slider}
            />
          </label>
          <button style={s.chaosBtn} onClick={runChaos}>
            Generate Chaos ({chaosDays} days)
          </button>
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: 280,
    minWidth: 280,
    borderRight: '1px solid #e5e7eb',
    height: '100%',
    overflow: 'auto',
    backgroundColor: '#fafafa',
  },
  header: {
    padding: '10px 12px',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },
  section: {
    padding: '8px 10px',
    borderBottom: '1px solid #e5e7eb',
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 11,
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionBar: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 2,
    padding: '6px 10px',
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
  },
  sectionBtn: {
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 500,
    border: '1px solid #d1d5db',
    borderRadius: 3,
    backgroundColor: '#fff',
    cursor: 'pointer',
    color: '#6b7280',
  },
  sectionBtnActive: {
    backgroundColor: '#4A90D9',
    color: '#fff',
    borderColor: '#4A90D9',
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: 11,
    color: '#374151',
    fontWeight: 500,
    marginBottom: 6,
    gap: 2,
  },
  slider: {
    width: '100%',
    accentColor: '#4A90D9',
  },
  select: {
    padding: '4px 6px',
    fontSize: 11,
    border: '1px solid #d1d5db',
    borderRadius: 3,
    backgroundColor: '#fff',
    flex: 1,
  },
  textInput: {
    padding: '4px 6px',
    fontSize: 11,
    border: '1px solid #d1d5db',
    borderRadius: 3,
  },
  numberInput: {
    width: 48,
    padding: '3px 4px',
    fontSize: 11,
    border: '1px solid #d1d5db',
    borderRadius: 3,
    textAlign: 'center' as const,
  },
  ageRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap' as const,
  },
  ageLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: 10,
    color: '#6b7280',
    gap: 2,
  },
  catLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 2,
  },
  presetBtn: {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '4px 8px',
    fontSize: 11,
    border: 'none',
    borderRadius: 3,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#374151',
    marginBottom: 1,
  },
  presetBtnActive: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    fontWeight: 600,
  },
  lockGrid: {
    marginTop: 8,
  },
  lockLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 4,
  },
  dayRow: {
    display: 'flex',
    gap: 2,
  },
  dayCell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '4px 0',
    borderRadius: 3,
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    fontSize: 10,
  },
  dayCellDay: {
    fontSize: 8,
    color: '#9ca3af',
  },
  dayCellVal: {
    fontSize: 12,
    fontWeight: 600,
  },
  quickBtns: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 3,
    marginBottom: 8,
  },
  quickBtn: {
    padding: '3px 7px',
    fontSize: 10,
    fontWeight: 500,
    border: '1px solid',
    borderRadius: 3,
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  reqBtn: {
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 500,
    border: '1px solid #8b5cf6',
    borderRadius: 3,
    backgroundColor: '#fff',
    cursor: 'pointer',
    color: '#8b5cf6',
  },
  formRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 4,
    alignItems: 'center',
  },
  formSep: {
    fontSize: 10,
    color: '#9ca3af',
  },
  dateInput: {
    flex: 1,
    padding: '3px 4px',
    fontSize: 10,
    border: '1px solid #d1d5db',
    borderRadius: 3,
  },
  addBtn: {
    padding: '4px 10px',
    fontSize: 10,
    fontWeight: 600,
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
  },
  activeList: {
    marginTop: 6,
    borderTop: '1px solid #e5e7eb',
    paddingTop: 6,
  },
  activeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 0',
    fontSize: 10,
    borderBottom: '1px solid #f3f4f6',
  },
  activeType: {
    fontWeight: 600,
    color: '#374151',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  activeDates: {
    color: '#6b7280',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  removeBtn: {
    width: 16,
    height: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 700,
    color: '#ef4444',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '50%',
  },
  clearBtn: {
    marginTop: 4,
    padding: '3px 8px',
    fontSize: 9,
    color: '#ef4444',
    backgroundColor: 'transparent',
    border: '1px solid #fca5a5',
    borderRadius: 3,
    cursor: 'pointer',
  },
  chaosDesc: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: '14px',
  },
  chaosBtn: {
    width: '100%',
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
};
