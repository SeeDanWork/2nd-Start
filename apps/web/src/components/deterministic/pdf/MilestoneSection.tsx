// ─── PDF Milestone Section ───────────────────────────────────────
//
// Per-milestone: age bands, weights, top template, 14-day pattern
// grid, rationale, and changes from previous milestone.

import { View, Text } from '@react-pdf/renderer';
import type { MilestoneSnapshot } from '../milestones';
import { WeightTable } from './WeightTable';
import { pdfStyles, COLORS } from './styles';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  snapshot: MilestoneSnapshot;
  index: number;
  arrangement: string;
}

export function MilestoneSection({ snapshot, index, arrangement }: Props) {
  const { label, refDate, children, topTemplate, solverWeights, weightProfile, rationale, changes } = snapshot;

  // Build a simple summary for psychologist audience
  const summaryLine = buildSummary(snapshot);

  return (
    <View wrap={false}>
      {/* Section title */}
      <Text style={pdfStyles.sectionTitle}>
        Milestone {index + 1}: {label} — {refDate}
      </Text>

      {/* Simple summary */}
      {summaryLine && (
        <Text style={{ fontSize: 9, color: COLORS.textPrimary, marginBottom: 8, fontStyle: 'italic' }}>
          {summaryLine}
        </Text>
      )}

      {/* Age band table */}
      <Text style={pdfStyles.sectionSubtitle}>Age Bands</Text>
      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableHeader}>
          <Text style={{ ...pdfStyles.tableCellBold, width: '40%' }}>Child</Text>
          <Text style={{ ...pdfStyles.tableCellBold, width: '30%' }}>Age Band</Text>
          <Text style={{ ...pdfStyles.tableCellBold, width: '30%' }}>Profile</Text>
        </View>
        {children.map((c) => (
          <View key={c.childId} style={pdfStyles.tableRow}>
            <Text style={{ ...pdfStyles.tableCell, width: '40%' }}>
              {c.childId}{!c.hasBirthdate ? ' *' : ''}
            </Text>
            <Text style={{ ...pdfStyles.tableCell, width: '30%' }}>{c.ageBand}</Text>
            <Text style={{ ...pdfStyles.tableCell, width: '30%' }}>{c.profile}</Text>
          </View>
        ))}
      </View>
      {children.some((c) => !c.hasBirthdate) && (
        <Text style={{ fontSize: 7, color: COLORS.textSecondary, marginBottom: 4 }}>
          * Cannot simulate aging — band held constant
        </Text>
      )}

      {/* Top template */}
      {topTemplate && (
        <View>
          <Text style={pdfStyles.sectionSubtitle}>
            Top Template: {topTemplate.name} (score: {topTemplate.score.toFixed(2)}, confidence: {topTemplate.confidence})
          </Text>
          <PatternGrid pattern={topTemplate.patternSummary} />
        </View>
      )}

      {/* Weight table */}
      <WeightTable weights={solverWeights} profile={weightProfile} arrangement={arrangement} />

      {/* Rationale */}
      <Text style={pdfStyles.sectionSubtitle}>Rationale</Text>
      {rationale.map((r, i) => (
        <View key={i} style={pdfStyles.bullet}>
          <Text style={pdfStyles.bulletDot}>•</Text>
          <Text style={pdfStyles.bulletText}>{r}</Text>
        </View>
      ))}

      {/* Disruption overlays */}
      {snapshot.overlays.length > 0 && (
        <View>
          <Text style={pdfStyles.sectionSubtitle}>Disruption Overlays</Text>
          {snapshot.overlays.map((o, oi) => (
            <View key={oi} style={{ marginBottom: 6 }}>
              <View style={pdfStyles.tableRow}>
                <Text style={{ ...pdfStyles.tableCellBold, width: '25%' }}>{o.eventType}</Text>
                <Text style={{ ...pdfStyles.tableCell, width: '20%' }}>Action: {o.actionTaken}</Text>
                <Text style={{ ...pdfStyles.tableCell, width: '15%' }}>Locks: {o.locks.length}</Text>
                <Text style={{ ...pdfStyles.tableCell, width: '15%' }}>Comp: {o.compensatoryDays.length}</Text>
                <Text style={{ ...pdfStyles.tableCell, width: '25%' }}>Proposal: {o.requiresProposal ? 'Yes' : 'No'}</Text>
              </View>
              {o.reasons.length > 0 && o.reasons.map((r, ri) => (
                <View key={ri} style={pdfStyles.bullet}>
                  <Text style={pdfStyles.bulletDot}>•</Text>
                  <Text style={pdfStyles.bulletText}>{r}</Text>
                </View>
              ))}
            </View>
          ))}
          {snapshot.solverPayload && (
            <View style={{ marginTop: 4, marginBottom: 4 }}>
              <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>
                Merged payload: {snapshot.solverPayload.disruption_locks.length} locks, {Object.keys(snapshot.solverPayload.weight_adjustments).length} weight adjustments
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Changes callout */}
      {index === 0 ? null : changes.length > 0 ? (
        <View style={pdfStyles.changeBox}>
          <Text style={pdfStyles.changeTitle}>Changes from Previous Milestone</Text>
          {changes.map((c, i) => (
            <Text key={i} style={pdfStyles.changeItem}>→ {c.description}</Text>
          ))}
        </View>
      ) : (
        <View style={pdfStyles.noChangeBox}>
          <Text style={pdfStyles.noChangeText}>No changes from previous milestone</Text>
        </View>
      )}
    </View>
  );
}

// ─── Pattern Grid (14-day as 2×7 colored cells) ──────────────────

function PatternGrid({ pattern }: { pattern: string }) {
  // patternSummary is like "AABBAAABBAABBB" — 14 chars
  const chars = pattern.split('');
  const week1 = chars.slice(0, 7);
  const week2 = chars.slice(7, 14);

  return (
    <View style={pdfStyles.gridContainer}>
      {/* Day labels */}
      <View style={pdfStyles.gridRow}>
        <Text style={pdfStyles.gridLabel}></Text>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={pdfStyles.gridDayLabel}>{d}</Text>
        ))}
      </View>

      {/* Week 1 */}
      <View style={pdfStyles.gridRow}>
        <Text style={pdfStyles.gridLabel}>Week 1</Text>
        {week1.map((c, i) => (
          <View
            key={i}
            style={{
              ...pdfStyles.gridCell,
              backgroundColor: c === 'A' ? COLORS.parentA : COLORS.parentB,
            }}
          >
            <Text style={{
              ...pdfStyles.gridCellText,
              color: c === 'A' ? COLORS.parentAText : COLORS.parentBText,
            }}>
              {c}
            </Text>
          </View>
        ))}
      </View>

      {/* Week 2 */}
      <View style={pdfStyles.gridRow}>
        <Text style={pdfStyles.gridLabel}>Week 2</Text>
        {week2.map((c, i) => (
          <View
            key={i}
            style={{
              ...pdfStyles.gridCell,
              backgroundColor: c === 'A' ? COLORS.parentA : COLORS.parentB,
            }}
          >
            <Text style={{
              ...pdfStyles.gridCellText,
              color: c === 'A' ? COLORS.parentAText : COLORS.parentBText,
            }}>
              {c}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Summary Builder ─────────────────────────────────────────────

function buildSummary(snapshot: MilestoneSnapshot): string | null {
  const { changes, topTemplate, youngestBand, label } = snapshot;
  if (changes.length === 0 && label !== 'Start') return null;
  if (label === 'Start') {
    return topTemplate
      ? `At start, the model recommends ${topTemplate.name} based on the youngest child in the ${youngestBand} age band.`
      : `At start, the youngest child is in the ${youngestBand} age band.`;
  }

  const bandChanges = changes.filter((c) => c.type === 'band_transition');
  const templateChange = changes.find((c) => c.type === 'template_change');
  if (bandChanges.length > 0 && templateChange) {
    return `At ${label}, the recommended schedule shifts to ${topTemplate?.name ?? 'a new template'} because age band transitions occurred (${bandChanges.map((c) => c.description).join('; ')}).`;
  }
  if (bandChanges.length > 0) {
    return `At ${label}, age band transitions occurred (${bandChanges.map((c) => c.description).join('; ')}), but the recommended template remains the same.`;
  }
  if (templateChange) {
    return `At ${label}, the recommended template changed to ${topTemplate?.name ?? 'a new template'}.`;
  }
  return null;
}
