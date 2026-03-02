import { useState, CSSProperties } from 'react';
import type {
  BaselineRecommendationInputV2,
  DisruptionEvent,
  ParentPreferenceInput,
  ScheduleMode,
  ThreeModeOutput,
  TemplateScoreV2,
} from '@adcp/shared';
import { TEMPLATES_V2 } from '@adcp/shared';
import { parseFamilyInput, parseDisruptionInput } from './parseInput';
import { computeMilestones, generateScheduleDays } from './milestones';
import type { MilestoneSnapshot, TemplateSchedule } from './milestones';
import { exportMilestoneReport } from './pdf/exportPdf';
import { FamilyInputPanel } from './FamilyInputPanel';
import { DisruptionInputPanel } from './DisruptionInputPanel';
import { ParentPreferencePanel } from './ParentPreferencePanel';
import { ScheduleModeSelector } from './ScheduleModeSelector';
import { MilestoneSelector } from './MilestoneSelector';
import { DisruptionMilestoneTable } from './DisruptionMilestoneTable';
import { DeterministicSchedule } from './DeterministicSchedule';
import { DeterministicCalendar } from './DeterministicCalendar';
import { ExplanationPanel } from './ExplanationPanel';
import { TechnicalDebugPanel } from './TechnicalDebugPanel';
import type { Preset } from './presets';
import type { FamilyPreset } from './familyPresets';

// ─── Tab Types ──────────────────────────────────────────────────────

type TabKind = 'template' | 'disruptions';

interface Tab {
  kind: TabKind;
  label: string;
  /** Index into templateSchedules (only for kind=template) */
  templateIdx?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

function getModeTemplateSchedules(
  modeResults: ThreeModeOutput | null,
  mode: ScheduleMode,
  lockMap: Map<string, string>,
  refDate: string | undefined,
  maxConsecutive: number | undefined,
): TemplateSchedule[] {
  if (!modeResults) return [];
  const result = mode === 'evidence' ? modeResults.evidence
    : mode === 'parent_vision' ? modeResults.parentVision
    : modeResults.balanced;
  const top4 = result.recommendedTemplates.slice(0, 4);
  return top4.map((ts) => {
    const tmpl = TEMPLATES_V2.find((t) => t.id === ts.templateId) ?? TEMPLATES_V2[0];
    return {
      template: ts,
      scheduleDays: generateScheduleDays(tmpl.pattern14, lockMap, refDate, maxConsecutive),
    };
  });
}

// ─── Main Component ──────────────────────────────────────────────────

export function DeterministicView() {
  // Input state
  const [familyText, setFamilyText] = useState('');
  const [disruptionText, setDisruptionText] = useState('');

  // Milestone-aware output state
  const [milestones, setMilestones] = useState<MilestoneSnapshot[]>([]);
  const [selectedMilestoneIdx, setSelectedMilestoneIdx] = useState(0);
  const [arrangement, setArrangement] = useState('shared');

  // Parsed input (needed for export)
  const [lastParsedInput, setLastParsedInput] = useState<BaselineRecommendationInputV2 | null>(null);

  // Three-mode state
  const [preferences, setPreferences] = useState<ParentPreferenceInput | null>(null);
  const [activeMode, setActiveMode] = useState<ScheduleMode>('evidence');

  // Tab state
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  // UI state
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsedDisruptionCount, setParsedDisruptionCount] = useState(0);
  const [activePresetId, setActivePresetId] = useState('');
  const [activeFamilyPresetId, setActiveFamilyPresetId] = useState('');
  const [exporting, setExporting] = useState(false);

  // Derive panel data from selected milestone
  const selected = milestones[selectedMilestoneIdx] ?? null;
  const recommendation = selected?.recommendation ?? null;
  const context = selected?.context ?? null;
  const overlays = selected?.overlays ?? [];
  const solverPayload = selected?.solverPayload ?? null;
  const presetOutput = selected?.presetOutput ?? null;
  const modeResults = selected?.modeResults ?? null;

  // Build lock map for active milestone
  const lockMap = new Map<string, string>();
  if (selected?.solverPayload) {
    for (const lock of selected.solverPayload.disruption_locks) {
      lockMap.set(lock.date, lock.parent);
    }
  }

  // Determine which template schedules to show based on mode
  const hasModes = modeResults !== null;
  const templateSchedules = hasModes
    ? getModeTemplateSchedules(
        modeResults,
        activeMode,
        lockMap,
        selected?.refDate,
        selected?.context?.hardConstraintFloors.maxConsecutive,
      )
    : selected?.templateSchedules ?? [];

  // Get mode-specific recommendation for panels
  const activeModeResult = hasModes
    ? (activeMode === 'evidence' ? modeResults.evidence
      : activeMode === 'parent_vision' ? modeResults.parentVision
      : modeResults.balanced)
    : null;

  // Build tabs from current template schedules
  const tabs: Tab[] = [];
  for (let i = 0; i < templateSchedules.length; i++) {
    const ts = templateSchedules[i];
    const conf = ts.template.confidence.toUpperCase();
    tabs.push({
      kind: 'template',
      label: `${ts.template.name} (${ts.template.score.toFixed(2)} ${conf})`,
      templateIdx: i,
    });
  }
  const hasOverlays = milestones.some((m) => m.overlays.length > 0);
  if (hasOverlays) {
    tabs.push({ kind: 'disruptions', label: 'Disruption Overlays' });
  }

  // Clamp active tab
  const safeTabIdx = Math.min(activeTabIdx, Math.max(tabs.length - 1, 0));
  const activeTab = tabs[safeTabIdx] ?? null;

  // Get schedule days for the active template tab
  const activeTemplateSched = activeTab?.kind === 'template' && activeTab.templateIdx != null
    ? templateSchedules[activeTab.templateIdx]
    : null;
  const displayDays = activeTemplateSched?.scheduleDays ?? selected?.scheduleDays ?? [];

  function loadFamilyPreset(preset: FamilyPreset) {
    setFamilyText(preset.familyText);
    setActiveFamilyPresetId(preset.id);
  }

  function loadPreset(preset: Preset) {
    setFamilyText(preset.familyText);
    setDisruptionText(preset.disruptionText);
    setActivePresetId(preset.id);
    setActiveFamilyPresetId('');
  }

  function handleApplyPreferences(prefs: ParentPreferenceInput) {
    setPreferences(prefs);
    // Re-compute if we already have family input
    if (lastParsedInput) {
      computeWithPreferences(prefs);
    }
  }

  function computeWithPreferences(prefs: ParentPreferenceInput | null) {
    setErrors([]);
    setWarnings([]);

    const familyResult = parseFamilyInput(familyText);
    setWarnings(familyResult.warnings);

    const input = familyResult.input;
    setLastParsedInput(input);

    const detectedArrangement = /\bprimary\b/.test(familyText.toLowerCase()) ? 'primary_visits' :
                                /\bundecided\b/.test(familyText.toLowerCase()) ? 'undecided' : 'shared';
    setArrangement(detectedArrangement);

    const events: DisruptionEvent[] = disruptionText.trim()
      ? parseDisruptionInput(disruptionText)
      : [];
    setParsedDisruptionCount(events.length);

    try {
      const snapshots = computeMilestones({
        familyInput: input,
        arrangement: detectedArrangement,
        disruptionEvents: events,
        preferences: prefs ?? undefined,
      });
      setMilestones(snapshots);
      setSelectedMilestoneIdx(0);
      setActiveTabIdx(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrors([`Computation error: ${msg}`]);
    }
  }

  function compute() {
    computeWithPreferences(preferences);
  }

  async function handleExportPdf() {
    if (!lastParsedInput || milestones.length === 0) return;
    setExporting(true);
    try {
      await exportMilestoneReport(lastParsedInput, arrangement, milestones);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrors((prev) => [...prev, `PDF export error: ${msg}`]);
    } finally {
      setExporting(false);
    }
  }

  const exportEnabled = milestones.length > 0 && !exporting;

  return (
    <div style={styles.root}>
      {/* Global header with actions */}
      <div style={styles.globalHeader}>
        <span style={styles.globalTitle}>Deterministic Model Tester</span>
        <div style={styles.globalActions}>
          <button style={styles.computeButton} onClick={compute}>
            Compute
          </button>
          <button
            style={{
              ...styles.exportButton,
              opacity: exportEnabled ? 1 : 0.5,
              cursor: exportEnabled ? 'pointer' : 'not-allowed',
            }}
            onClick={handleExportPdf}
            disabled={!exportEnabled}
          >
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Input panels row */}
      <div style={styles.inputRow}>
        <FamilyInputPanel
          value={familyText}
          onChange={setFamilyText}
          onLoadPreset={loadFamilyPreset}
          activeFamilyPresetId={activeFamilyPresetId}
          errors={errors}
          warnings={warnings}
        />
        <DisruptionInputPanel
          value={disruptionText}
          onChange={setDisruptionText}
          onLoadPreset={loadPreset}
          activePresetId={activePresetId}
          parsedCount={parsedDisruptionCount}
        />
        <ParentPreferencePanel onApply={handleApplyPreferences} />
      </div>

      {/* Schedule mode selector (only when preferences are active) */}
      {hasModes && (
        <ScheduleModeSelector
          activeMode={activeMode}
          onSelectMode={(mode) => {
            setActiveMode(mode);
            setActiveTabIdx(0);
          }}
          modeResults={modeResults}
        />
      )}

      {/* Milestone selector */}
      <MilestoneSelector
        milestones={milestones}
        selectedIndex={selectedMilestoneIdx}
        onSelect={(idx) => {
          setSelectedMilestoneIdx(idx);
          setActiveTabIdx(0);
        }}
      />

      {/* Tab bar */}
      {tabs.length > 0 && (
        <div style={styles.tabBar}>
          {tabs.map((tab, i) => {
            const isActive = i === safeTabIdx;
            return (
              <button
                key={i}
                onClick={() => setActiveTabIdx(i)}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                  ...(tab.kind === 'disruptions' ? styles.tabDisruption : {}),
                  ...(tab.kind === 'disruptions' && isActive ? styles.tabDisruptionActive : {}),
                }}
              >
                {tab.kind === 'template' && (
                  <span style={styles.tabRank}>#{(tab.templateIdx ?? 0) + 1}</span>
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content */}
      {activeTab?.kind === 'disruptions' ? (
        <div style={styles.disruptionContent}>
          <DisruptionMilestoneTable milestones={milestones} />
        </div>
      ) : (
        <div style={styles.panels}>
          <DeterministicSchedule days={displayDays} />
          <DeterministicCalendar days={displayDays} />
          <ExplanationPanel
            recommendation={recommendation}
            context={context}
            overlays={overlays}
            activeTemplate={activeTemplateSched?.template ?? null}
            activeMode={hasModes ? activeMode : undefined}
            activeModeResult={activeModeResult}
          />
          <TechnicalDebugPanel
            recommendation={recommendation}
            context={context}
            overlays={overlays}
            solverPayload={solverPayload}
            presets={presetOutput}
            arrangement={arrangement}
            activeMode={hasModes ? activeMode : undefined}
            activeModeResult={activeModeResult}
          />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  globalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#1a1a2e',
    borderBottom: '1px solid #e5e7eb',
  },
  globalTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: '#fff',
  },
  globalActions: {
    display: 'flex',
    gap: 8,
  },
  computeButton: {
    padding: '6px 16px',
    backgroundColor: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  exportButton: {
    padding: '6px 16px',
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  inputRow: {
    display: 'flex',
  },
  tabBar: {
    display: 'flex',
    gap: 0,
    padding: '0 8px',
    backgroundColor: '#f3f4f6',
    borderBottom: '2px solid #e5e7eb',
    overflow: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 14px',
    fontSize: 11,
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: '#4A90D9',
    fontWeight: 700,
    borderBottomColor: '#4A90D9',
    backgroundColor: '#fff',
  },
  tabDisruption: {
    color: '#92400e',
  },
  tabDisruptionActive: {
    color: '#92400e',
    borderBottomColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  tabRank: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#e5e7eb',
    fontSize: 9,
    fontWeight: 700,
    color: '#374151',
  },
  panels: {
    display: 'flex',
  },
  disruptionContent: {
  },
};
