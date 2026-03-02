// ─── PDF Weight Table ────────────────────────────────────────────
//
// Solver weight table: 5 weights × 4 columns (base, age×, arr×, final).

import { View, Text } from '@react-pdf/renderer';
import type { SolverWeightRow } from '../milestones';
import { pdfStyles } from './styles';

const WEIGHT_LABELS: Record<string, string> = {
  fairnessDeviation: 'Fairness Deviation',
  totalTransitions: 'Total Transitions',
  nonDaycareHandoffs: 'Non-Daycare Handoffs',
  weekendFragmentation: 'Weekend Fragmentation',
  schoolNightDisruption: 'School Night Disruption',
};

const COL_WIDTHS = {
  name: '36%',
  base: '16%',
  age: '16%',
  arr: '16%',
  final: '16%',
};

interface Props {
  weights: SolverWeightRow[];
  profile: string;
  arrangement: string;
}

export function WeightTable({ weights, profile, arrangement }: Props) {
  return (
    <View style={pdfStyles.table}>
      <Text style={pdfStyles.sectionSubtitle}>
        Solver Weights (profile: {profile}, arrangement: {arrangement})
      </Text>

      {/* Header row */}
      <View style={pdfStyles.tableHeader}>
        <Text style={{ ...pdfStyles.tableCellBold, width: COL_WIDTHS.name }}>Weight</Text>
        <Text style={{ ...pdfStyles.tableCellBold, width: COL_WIDTHS.base, textAlign: 'right' }}>Base</Text>
        <Text style={{ ...pdfStyles.tableCellBold, width: COL_WIDTHS.age, textAlign: 'right' }}>Age ×</Text>
        <Text style={{ ...pdfStyles.tableCellBold, width: COL_WIDTHS.arr, textAlign: 'right' }}>Arr ×</Text>
        <Text style={{ ...pdfStyles.tableCellBold, width: COL_WIDTHS.final, textAlign: 'right' }}>Final</Text>
      </View>

      {/* Data rows */}
      {weights.map((w) => (
        <View key={w.name} style={pdfStyles.tableRow}>
          <Text style={{ ...pdfStyles.tableCell, width: COL_WIDTHS.name }}>
            {WEIGHT_LABELS[w.name] ?? w.name}
          </Text>
          <Text style={{ ...pdfStyles.tableCell, width: COL_WIDTHS.base, textAlign: 'right' }}>
            {w.base}
          </Text>
          <Text style={{ ...pdfStyles.tableCell, width: COL_WIDTHS.age, textAlign: 'right' }}>
            {w.ageMult}×
          </Text>
          <Text style={{ ...pdfStyles.tableCell, width: COL_WIDTHS.arr, textAlign: 'right' }}>
            {w.arrMult}×
          </Text>
          <Text style={{ ...pdfStyles.tableCell, width: COL_WIDTHS.final, textAlign: 'right' }}>
            {w.final}
          </Text>
        </View>
      ))}
    </View>
  );
}
