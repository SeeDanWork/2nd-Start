import { useState, CSSProperties } from 'react';
import type {
  BaselineRecommendationInputV2,
  DisruptionEvent,
} from '@adcp/shared';
import { parseFamilyInput, parseDisruptionInput } from './parseInput';
import { computeMilestones } from './milestones';
import type { MilestoneSnapshot } from './milestones';
import { exportMilestoneReport } from './pdf/exportPdf';
import { FamilyInputPanel } from './FamilyInputPanel';
import { DisruptionInputPanel } from './DisruptionInputPanel';
import { MilestoneSelector } from './MilestoneSelector';
import { DisruptionMilestoneTable } from './DisruptionMilestoneTable';
import { DeterministicSchedule } from './DeterministicSchedule';
import { DeterministicCalendar } from './DeterministicCalendar';
import { ExplanationPanel } from './ExplanationPanel';
import { TechnicalDebugPanel } from './TechnicalDebugPanel';
import type { Preset } from './presets';

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

  // UI state
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsedDisruptionCount, setParsedDisruptionCount] = useState(0);
  const [activePresetId, setActivePresetId] = useState('');
  const [exporting, setExporting] = useState(false);

  // Derive panel data from selected milestone
  const selected = milestones[selectedMilestoneIdx] ?? null;
  const recommendation = selected?.recommendation ?? null;
  const context = selected?.context ?? null;
  const overlays = selected?.overlays ?? [];
  const solverPayload = selected?.solverPayload ?? null;
  const presetOutput = selected?.presetOutput ?? null;
  const scheduleDays = selected?.scheduleDays ?? [];

  function loadPreset(preset: Preset) {
    setFamilyText(preset.familyText);
    setDisruptionText(preset.disruptionText);
    setActivePresetId(preset.id);
  }

  function compute() {
    setErrors([]);
    setWarnings([]);

    // 1. Parse family input
    const familyResult = parseFamilyInput(familyText);
    setWarnings(familyResult.warnings);

    const input = familyResult.input;
    setLastParsedInput(input);

    // 2. Detect arrangement
    const detectedArrangement = /\bprimary\b/.test(familyText.toLowerCase()) ? 'primary_visits' :
                                /\bundecided\b/.test(familyText.toLowerCase()) ? 'undecided' : 'shared';
    setArrangement(detectedArrangement);

    // 3. Parse disruption events
    const events: DisruptionEvent[] = disruptionText.trim()
      ? parseDisruptionInput(disruptionText)
      : [];
    setParsedDisruptionCount(events.length);

    // 4. Compute all milestones in one pass
    try {
      const snapshots = computeMilestones({
        familyInput: input,
        arrangement: detectedArrangement,
        disruptionEvents: events,
      });
      setMilestones(snapshots);
      setSelectedMilestoneIdx(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrors([`Computation error: ${msg}`]);
    }
  }

  async function handleExportPdf() {
    if (!lastParsedInput || milestones.length === 0) return;
    setExporting(true);
    try {
      // Reuse already-computed milestones — no recomputation needed
      await exportMilestoneReport(lastParsedInput, arrangement, milestones);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrors((prev) => [...prev, `PDF export error: ${msg}`]);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* Input panels row */}
      <div style={styles.panels}>
        <FamilyInputPanel
          value={familyText}
          onChange={setFamilyText}
          onCompute={compute}
          onExportPdf={handleExportPdf}
          exportEnabled={milestones.length > 0 && !exporting}
          exporting={exporting}
          errors={errors}
          warnings={warnings}
        />
        <DisruptionInputPanel
          value={disruptionText}
          onChange={setDisruptionText}
          onCompute={compute}
          onLoadPreset={loadPreset}
          activePresetId={activePresetId}
          parsedCount={parsedDisruptionCount}
        />
      </div>

      {/* Milestone selector */}
      <MilestoneSelector
        milestones={milestones}
        selectedIndex={selectedMilestoneIdx}
        onSelect={setSelectedMilestoneIdx}
      />

      {/* Disruption milestone table (visible when overlays exist) */}
      <DisruptionMilestoneTable milestones={milestones} />

      {/* Output panels row */}
      <div style={styles.panels}>
        <DeterministicSchedule days={scheduleDays} />
        <DeterministicCalendar days={scheduleDays} />
        <ExplanationPanel
          recommendation={recommendation}
          context={context}
          overlays={overlays}
        />
        <TechnicalDebugPanel
          recommendation={recommendation}
          context={context}
          overlays={overlays}
          solverPayload={solverPayload}
          presets={presetOutput}
          arrangement={arrangement}
        />
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  panels: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
};
