import { CSSProperties } from 'react';

const FIELD_GUIDE = [
  { label: 'Children', examples: ['kids ages 3 and 7', 'child born 2022-05-15', '8 month old'] },
  { label: 'Arrangement', examples: ['shared', 'primary', 'undecided'] },
  { label: 'Goals', examples: ['stability', 'fairness', '50/50', 'minimize separation'] },
  { label: 'Anchor', examples: ['school', 'daycare'] },
  { label: 'Distance', examples: ['30 minutes apart'] },
  { label: 'Exchange', examples: ['prefer anchor', 'in person'] },
  { label: 'Constraints', examples: ['2 locked nights', 'shift work', 'no in-person'] },
];

const PLACEHOLDER = `Example:
kids ages 3 and 7
shared arrangement
stability and fairness goals
school anchor
20 minutes apart
prefer anchor exchange`;

interface Props {
  value: string;
  onChange: (v: string) => void;
  errors: string[];
  warnings: string[];
}

export function FamilyInputPanel({ value, onChange, errors, warnings }: Props) {
  return (
    <div style={styles.panel}>
      <div style={styles.header}>Family Description</div>
      <div style={styles.content}>
        <div style={styles.guide}>
          <div style={styles.guideTitle}>Accepted Fields</div>
          {FIELD_GUIDE.map((f) => (
            <div key={f.label} style={styles.guideRow}>
              <span style={styles.guideLabel}>{f.label}:</span>
              <span style={styles.guideExamples}>
                {f.examples.map((e) => (
                  <code key={e} style={styles.badge}>{e}</code>
                ))}
              </span>
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

        {warnings.length > 0 && (
          <div style={styles.warningBox}>
            {warnings.map((w, i) => (
              <div key={i} style={styles.warningText}>{w}</div>
            ))}
          </div>
        )}

        {errors.length > 0 && (
          <div style={styles.errorBox}>
            {errors.map((e, i) => (
              <div key={i} style={styles.errorText}>{e}</div>
            ))}
          </div>
        )}
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
  guide: {
    fontSize: 11,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  guideTitle: {
    fontWeight: 600,
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  guideRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 4,
    lineHeight: '18px',
  },
  guideLabel: {
    fontWeight: 600,
    color: '#1a1a2e',
    minWidth: 75,
    flexShrink: 0,
  },
  guideExamples: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 3,
  },
  badge: {
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: 3,
    padding: '0 4px',
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#6b7280',
    whiteSpace: 'nowrap',
  },
  textarea: {
    flex: 1,
    minHeight: 120,
    padding: 8,
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 12,
    resize: 'vertical',
    outline: 'none',
  },
  warningBox: {
    padding: 6,
    backgroundColor: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: 4,
  },
  warningText: {
    fontSize: 11,
    color: '#92400e',
  },
  errorBox: {
    padding: 6,
    backgroundColor: '#fee2e2',
    border: '1px solid #ef4444',
    borderRadius: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#991b1b',
  },
};
