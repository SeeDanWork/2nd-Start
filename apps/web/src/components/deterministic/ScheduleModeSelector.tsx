import { CSSProperties } from 'react';
import type { ScheduleMode, ThreeModeOutput } from '@adcp/shared';

interface Props {
  activeMode: ScheduleMode;
  onSelectMode: (mode: ScheduleMode) => void;
  modeResults: ThreeModeOutput | null;
  /** When true, Parent Vision and Balanced are shown but not clickable */
  disabled?: boolean;
}

const MODE_CONFIG: { mode: ScheduleMode; label: string; color: string; bgColor: string; activeBg: string }[] = [
  { mode: 'evidence', label: 'Evidence Best', color: '#1d4ed8', bgColor: '#eff6ff', activeBg: '#dbeafe' },
  { mode: 'parent_vision', label: 'Parent Vision', color: '#166534', bgColor: '#f0fdf4', activeBg: '#dcfce7' },
  { mode: 'balanced', label: 'Balanced', color: '#7c3aed', bgColor: '#f5f3ff', activeBg: '#ede9fe' },
];

function getModeTopTemplate(modeResults: ThreeModeOutput | null, mode: ScheduleMode): string | null {
  if (!modeResults) return null;
  const result = mode === 'evidence' ? modeResults.evidence
    : mode === 'parent_vision' ? modeResults.parentVision
    : modeResults.balanced;
  return result.recommendedTemplates[0]?.name ?? null;
}

export function ScheduleModeSelector({ activeMode, onSelectMode, modeResults, disabled }: Props) {
  return (
    <div style={styles.bar}>
      {MODE_CONFIG.map((cfg) => {
        const isActive = cfg.mode === activeMode;
        const topName = getModeTopTemplate(modeResults, cfg.mode);
        // In disabled mode, only evidence is active; the other two are greyed out
        const isLocked = disabled && cfg.mode !== 'evidence';
        return (
          <button
            key={cfg.mode}
            onClick={() => !isLocked && onSelectMode(cfg.mode)}
            disabled={isLocked}
            title={isLocked ? 'Apply parent preferences to unlock' : undefined}
            style={{
              ...styles.modeButton,
              ...(isLocked ? {
                color: '#9ca3af',
                backgroundColor: '#f3f4f6',
                borderColor: 'transparent',
                fontWeight: 500,
                cursor: 'default',
                opacity: 0.6,
              } : {
                color: cfg.color,
                backgroundColor: isActive ? cfg.activeBg : cfg.bgColor,
                borderColor: isActive ? cfg.color : 'transparent',
                fontWeight: isActive ? 700 : 500,
              }),
            }}
          >
            <span style={styles.modeLabel}>{cfg.label}</span>
            {topName && !isLocked && (
              <span style={{ ...styles.modeSubtitle, color: cfg.color, opacity: isActive ? 0.8 : 0.5 }}>
                {topName}
              </span>
            )}
            {isLocked && (
              <span style={styles.modeSubtitle}>Apply preferences</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  bar: {
    display: 'flex',
    gap: 4,
    padding: '6px 8px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  },
  modeButton: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '8px 12px',
    border: '2px solid transparent',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modeLabel: {
    fontSize: 12,
  },
  modeSubtitle: {
    fontSize: 9,
    fontFamily: 'monospace',
  },
};
