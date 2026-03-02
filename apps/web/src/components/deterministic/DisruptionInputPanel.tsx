import { CSSProperties } from 'react';
import { DisruptionEventType } from '@adcp/shared';
import { PRESETS, PRESET_CATEGORIES, type Preset } from './presets';

const EVENT_DESCRIPTIONS: Array<{ type: string; description: string }> = [
  { type: DisruptionEventType.PUBLIC_HOLIDAY, description: 'Public holiday' },
  { type: DisruptionEventType.SCHOOL_CLOSED, description: 'School closed / closure' },
  { type: DisruptionEventType.SCHOOL_HALF_DAY, description: 'School half-day' },
  { type: DisruptionEventType.EMERGENCY_CLOSURE, description: 'Emergency closure' },
  { type: DisruptionEventType.CHILD_SICK, description: 'Child sick' },
  { type: DisruptionEventType.CAREGIVER_SICK, description: 'Caregiver / parent sick' },
  { type: DisruptionEventType.PARENT_TRAVEL, description: 'Parent travel / trip' },
  { type: DisruptionEventType.TRANSPORT_FAILURE, description: 'Transport failure / car broke' },
  { type: DisruptionEventType.FAMILY_EVENT, description: 'Family event / wedding / funeral' },
  { type: DisruptionEventType.CAMP_WEEK, description: 'Camp week' },
  { type: DisruptionEventType.BREAK, description: 'Break (spring/winter)' },
  { type: DisruptionEventType.SUMMER_PERIOD, description: 'Summer period' },
  { type: DisruptionEventType.OTHER_DECLARED, description: 'Other (fallback)' },
];

const PLACEHOLDER = `One disruption per line. Examples:
child sick 2026-03-10 3 days
holiday March 15
father travel 2026-04-01 5 days
school closed 2026-03-20
camp 2026-06-15 2 weeks`;

interface Props {
  value: string;
  onChange: (v: string) => void;
  onCompute: () => void;
  onLoadPreset: (preset: Preset) => void;
  activePresetId: string;
  parsedCount: number;
}

export function DisruptionInputPanel({ value, onChange, onCompute, onLoadPreset, activePresetId, parsedCount }: Props) {
  return (
    <div style={styles.panel}>
      <div style={styles.header}>Disruption Scenarios</div>
      <div style={styles.content}>
        {/* Preset dropdown */}
        <div>
          <select
            style={styles.select}
            value={activePresetId}
            onChange={(e) => {
              const preset = PRESETS.find((p) => p.id === e.target.value);
              if (preset) onLoadPreset(preset);
            }}
          >
            <option value="">Load preset scenario...</option>
            {PRESET_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {PRESETS.filter((p) => p.category === cat).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {activePresetId && (
            <div style={styles.presetDesc}>
              {PRESETS.find((p) => p.id === activePresetId)?.description}
            </div>
          )}
        </div>

        <div style={styles.guide}>
          <div style={styles.guideTitle}>Event Types (keywords)</div>
          {EVENT_DESCRIPTIONS.map((e) => (
            <div key={e.type} style={styles.guideRow}>
              <code style={styles.badge}>{e.type}</code>
              <span style={styles.guideDesc}>{e.description}</span>
            </div>
          ))}
        </div>

        <textarea
          style={styles.textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
        />

        <button style={styles.computeButton} onClick={onCompute}>
          Compute
        </button>

        <div style={styles.statusBar}>
          Parsed <strong>{parsedCount}</strong> event{parsedCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 240,
    borderRight: '1px solid #e5e7eb',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8f9fa',
    fontWeight: 600,
    fontSize: 13,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  select: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: 11,
    backgroundColor: '#fff',
    color: '#1a1a2e',
    cursor: 'pointer',
    outline: 'none',
  },
  presetDesc: {
    fontSize: 10,
    color: '#6b7280',
    fontStyle: 'italic',
    padding: '4px 0 0',
    lineHeight: '14px',
  },
  guide: {
    fontSize: 11,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  guideTitle: {
    fontWeight: 600,
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  guideRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    lineHeight: '16px',
  },
  badge: {
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: 3,
    padding: '0 4px',
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#6b7280',
    whiteSpace: 'nowrap',
    minWidth: 100,
  },
  guideDesc: {
    color: '#1a1a2e',
    fontSize: 10,
  },
  textarea: {
    flex: 1,
    minHeight: 100,
    padding: 8,
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 12,
    resize: 'vertical',
    outline: 'none',
  },
  computeButton: {
    padding: '8px 16px',
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  statusBar: {
    fontSize: 11,
    color: '#6b7280',
    padding: '4px 0',
  },
};
