// ─── PDF Report Header ───────────────────────────────────────────
//
// Family summary: children, arrangement, goals, anchor, distance.

import { View, Text } from '@react-pdf/renderer';
import type { BaselineRecommendationInputV2 } from '@adcp/shared';
import type { ChildSnapshot } from '../milestones';
import { pdfStyles, COLORS } from './styles';

interface Props {
  familyInput: BaselineRecommendationInputV2;
  arrangement: string;
  children: ChildSnapshot[];
  generatedAt: string;
}

export function ReportHeader({ familyInput, arrangement, children, generatedAt }: Props) {
  const goals: string[] = [];
  if (familyInput.goals.stabilityFirst) goals.push('Stability');
  if (familyInput.goals.minimizeSeparation) goals.push('Minimize Separation');
  if (familyInput.goals.fairnessStrict) goals.push('Strict Fairness');
  if (goals.length === 0) goals.push('None specified');

  const anchorLabel = familyInput.anchor.type === 'none'
    ? 'None'
    : familyInput.anchor.type.charAt(0).toUpperCase() + familyInput.anchor.type.slice(1);

  const distanceLabel = familyInput.distanceBetweenHomesMinutes != null
    ? `${familyInput.distanceBetweenHomesMinutes} min`
    : 'Not specified';

  return (
    <View>
      <Text style={pdfStyles.title}>ADCP Deterministic Model Report</Text>
      <Text style={pdfStyles.subtitle}>
        Generated {generatedAt} — Model Evolution Over Time
      </Text>

      <View style={pdfStyles.table}>
        <SummaryRow label="Children" value={childSummary(children)} />
        <SummaryRow label="Arrangement" value={arrangement} />
        <SummaryRow label="Goals" value={goals.join(', ')} />
        <SummaryRow label="Anchor" value={anchorLabel} />
        <SummaryRow label="Distance" value={distanceLabel} />
        <SummaryRow label="Exchange" value={familyInput.exchangePreference.replace(/_/g, ' ')} />
        <SummaryRow label="Aggregation" value={familyInput.aggregationMode ?? 'youngest_child_rules'} />
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={pdfStyles.summaryRow}>
      <Text style={pdfStyles.summaryLabel}>{label}</Text>
      <Text style={pdfStyles.summaryValue}>{value}</Text>
    </View>
  );
}

function childSummary(children: ChildSnapshot[]): string {
  return children
    .map((c) => {
      const aging = c.hasBirthdate ? '' : ' (fixed band)';
      return `${c.childId}: ${c.ageBand}${aging}`;
    })
    .join('; ');
}
