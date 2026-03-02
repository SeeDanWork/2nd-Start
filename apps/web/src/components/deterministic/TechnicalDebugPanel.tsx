import { CSSProperties } from 'react';
import type {
  BaselineRecommendationOutputV2,
  FamilyContextDefaults,
  DisruptionOverlayResult,
  SolverPayloadOverlay,
  PresetOutput,
  ScheduleMode,
  ThreeModeRecommendation,
} from '@adcp/shared';
import {
  DEFAULT_SOLVER_WEIGHTS,
  AGE_WEIGHT_MULTIPLIERS,
  LIVING_ARRANGEMENT_WEIGHT_MULTIPLIERS,
  SOLVER_PRECEDENCE_HIERARCHY,
  TEMPLATES_V2,
  MODE_WEIGHT_PROFILES,
} from '@adcp/shared';

interface Props {
  recommendation: BaselineRecommendationOutputV2 | null;
  context: FamilyContextDefaults | null;
  overlays: DisruptionOverlayResult[];
  solverPayload: SolverPayloadOverlay | null;
  presets: PresetOutput | null;
  arrangement: string;
  activeMode?: ScheduleMode;
  activeModeResult?: ThreeModeRecommendation | null;
}

function DetailsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details style={styles.details}>
      <summary style={styles.summary}>{title}</summary>
      <div style={styles.detailsContent}>{children}</div>
    </details>
  );
}

function Row({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{String(value)}</span>
    </div>
  );
}

export function TechnicalDebugPanel({ recommendation, context, overlays, solverPayload, presets, arrangement, activeMode, activeModeResult }: Props) {
  if (!recommendation || !context) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>Technical Debug</div>
        <div style={styles.content}>
          <p style={styles.placeholder}>Waiting for computation...</p>
        </div>
      </div>
    );
  }

  const profile = context.solverWeightProfile;
  const ageMultipliers = AGE_WEIGHT_MULTIPLIERS[profile] ?? {};
  const arrMultipliers = LIVING_ARRANGEMENT_WEIGHT_MULTIPLIERS[arrangement] ?? {};
  const weightKeys = Object.keys(DEFAULT_SOLVER_WEIGHTS) as Array<keyof typeof DEFAULT_SOLVER_WEIGHTS>;

  // Solver payload weight adjustments (from disruptions)
  const disruptionAdj = solverPayload?.weight_adjustments ?? {};

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Technical Debug</div>
      <div style={styles.content}>
        {/* 1. Family Context */}
        <DetailsSection title="Family Context">
          <Row label="Scoring Mode" value={context.scoringMode} />
          <Row label="Youngest Band" value={context.youngestBand} />
          <Row label="Weight Profile" value={profile} />
          <Row label="Living Arrangement" value={context.livingArrangement} />
          <Row label="Max Consecutive" value={context.hardConstraintFloors.maxConsecutive} />
          <Row label="Max Away" value={context.hardConstraintFloors.maxAway} />
          <Row label="Fairness Capped" value={context.fairnessCapped} />
          {context.perChild.length > 0 && (
            <div style={styles.subTable}>
              <div style={styles.subTableTitle}>Per-Child</div>
              {context.perChild.map((c) => (
                <div key={c.childId} style={styles.subRow}>
                  <span style={styles.mono}>{c.ageBand}</span>
                  <span style={styles.mono}>max {c.maxConsecutive} / away {c.maxAway}</span>
                </div>
              ))}
            </div>
          )}
        </DetailsSection>

        {/* 2. Solver Weights */}
        <DetailsSection title="Solver Weights">
          <div style={styles.weightGrid}>
            <div style={styles.weightHeader}>
              <span>Weight</span>
              <span>Base</span>
              <span>Age x</span>
              <span>Arr x</span>
              <span>Final</span>
            </div>
            {weightKeys.map((key) => {
              const base = DEFAULT_SOLVER_WEIGHTS[key];
              const ageMul = ageMultipliers[key] ?? 1;
              const arrMul = arrMultipliers[key] ?? 1;
              const disMul = disruptionAdj[key] ?? 1;
              const final = base * ageMul * arrMul * disMul;
              return (
                <div key={key} style={styles.weightRow}>
                  <span style={styles.weightLabel}>{key}</span>
                  <span style={styles.mono}>{base}</span>
                  <span style={styles.mono}>{ageMul.toFixed(1)}</span>
                  <span style={styles.mono}>{arrMul.toFixed(1)}</span>
                  <span style={{ ...styles.mono, fontWeight: 600 }}>{final.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </DetailsSection>

        {/* 3. Template Scores */}
        <DetailsSection title={`Template Scores${activeMode ? ` (${activeMode})` : ''}`}>
          {(() => {
            const breakdown = activeModeResult?.scoreBreakdown ?? recommendation.debug?.scoreBreakdown;
            const topId = activeModeResult?.recommendedTemplates[0]?.templateId
              ?? recommendation.aggregate.recommendedTemplates[0]?.templateId;
            const showPref = activeModeResult != null;
            if (!breakdown) return null;
            return (
              <div style={styles.scoreGrid}>
                <div style={showPref ? styles.scoreHeader6 : styles.scoreHeader}>
                  <span>Template</span>
                  <span>Age</span>
                  <span>Goal</span>
                  <span>Log</span>
                  <span>Con</span>
                  {showPref && <span>Pref</span>}
                  <span>Total</span>
                </div>
                {TEMPLATES_V2.map((t) => {
                  const bd = breakdown[t.id];
                  if (!bd) return null;
                  const isTop = topId === t.id;
                  return (
                    <div
                      key={t.id}
                      style={{
                        ...(showPref ? styles.scoreRow6 : styles.scoreRow),
                        ...(isTop ? styles.topRow : {}),
                      }}
                    >
                      <span style={styles.scoreLabel} title={t.name}>{t.id}</span>
                      <span style={styles.mono}>{bd.ageFit.toFixed(2)}</span>
                      <span style={styles.mono}>{bd.goalFit.toFixed(2)}</span>
                      <span style={styles.mono}>{bd.logisticsFit.toFixed(2)}</span>
                      <span style={styles.mono}>{bd.constraintFit.toFixed(2)}</span>
                      {showPref && <span style={styles.mono}>{(bd as any).preferenceFit?.toFixed(2) ?? '—'}</span>}
                      <span style={{ ...styles.mono, fontWeight: 600 }}>{bd.total.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </DetailsSection>

        {/* 3b. Mode Weight Profile */}
        {activeMode && (
          <DetailsSection title="Mode Weight Profile">
            {(() => {
              const mw = MODE_WEIGHT_PROFILES[activeMode];
              return (
                <div style={styles.subTable}>
                  <Row label="ageFit" value={`${(mw.ageFit * 100).toFixed(0)}%`} />
                  <Row label="goalFit" value={`${(mw.goalFit * 100).toFixed(0)}%`} />
                  <Row label="logisticsFit" value={`${(mw.logisticsFit * 100).toFixed(0)}%`} />
                  <Row label="constraintFit" value={`${(mw.constraintFit * 100).toFixed(0)}%`} />
                  <Row label="preferenceFit" value={`${(mw.preferenceFit * 100).toFixed(0)}%`} />
                </div>
              );
            })()}
          </DetailsSection>
        )}

        {/* 4. Multi-Child Details */}
        {Object.keys(recommendation.perChild).length > 1 && (
          <DetailsSection title="Multi-Child Details">
            {Object.entries(recommendation.perChild).map(([childId, data]) => (
              <div key={childId} style={styles.childCard}>
                <div style={styles.childHeader}>
                  <span style={styles.mono}>{data.ageBand}</span>
                  <span style={styles.mono}>max {data.defaults.maxConsecutive} / away {data.defaults.maxAway}</span>
                </div>
                <div style={styles.childRanks}>
                  Rank: {data.templateRanks.slice(0, 3).join(' > ')}
                </div>
              </div>
            ))}
          </DetailsSection>
        )}

        {/* 5. Disruption Overlays */}
        {overlays.length > 0 && (
          <DetailsSection title="Disruption Overlays">
            {overlays.map((o) => (
              <div key={o.eventId} style={styles.overlayDebug}>
                <Row label="Event" value={o.eventType} />
                <Row label="Action" value={o.actionTaken} />
                <Row label="Locks" value={o.locks.length} />
                <Row label="Proposal?" value={o.requiresProposal} />
                {o.weightAdjustments.length > 0 && (
                  <div style={styles.subTable}>
                    {o.weightAdjustments.map((wa, i) => (
                      <div key={i} style={styles.subRow}>
                        <span style={styles.mono}>{wa.key} x{wa.multiplier.toFixed(2)}</span>
                        <span style={styles.dimText}>{wa.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
                {o.compensatoryDays.length > 0 && (
                  <div style={styles.dimText}>
                    Compensatory: {o.compensatoryDays.join(', ')}
                  </div>
                )}
              </div>
            ))}

            {solverPayload && (
              <div style={styles.subTable}>
                <div style={styles.subTableTitle}>Merged Solver Payload</div>
                <Row label="Total Locks" value={solverPayload.disruption_locks.length} />
                <Row label="Weight Adjustments" value={Object.keys(solverPayload.weight_adjustments).length} />
              </div>
            )}
          </DetailsSection>
        )}

        {/* 6. Presets */}
        {presets && (
          <DetailsSection title="Presets">
            <div style={styles.subTable}>
              <div style={styles.subTableTitle}>Template Ranking</div>
              <div style={styles.mono}>
                {presets.templateRanking.join(' > ')}
              </div>
            </div>
            {presets.suggestedPolicies.length > 0 && (
              <div style={styles.subTable}>
                <div style={styles.subTableTitle}>Suggested Policies</div>
                {presets.suggestedPolicies.map((p, i) => (
                  <div key={i} style={styles.subRow}>
                    <span style={styles.mono}>{p.eventType}: {p.actionType} ({p.strength})</span>
                    <span style={styles.dimText}>{p.reason}</span>
                  </div>
                ))}
              </div>
            )}
            <Row label="Prompt Lead Time" value={`${presets.promptLeadTimeHours}h`} />
            {presets.reasons.length > 0 && (
              <div style={styles.subTable}>
                <div style={styles.subTableTitle}>Reasons</div>
                {presets.reasons.map((r, i) => (
                  <div key={i} style={styles.dimText}>{r}</div>
                ))}
              </div>
            )}
          </DetailsSection>
        )}

        {/* 7. Precedence Hierarchy */}
        <DetailsSection title="Precedence Hierarchy">
          <ol style={styles.precedenceList}>
            {SOLVER_PRECEDENCE_HIERARCHY.map((tier) => (
              <li key={tier.tier} style={styles.precedenceItem}>
                <span style={styles.tierName}>{tier.name}</span>
                <span style={styles.dimText}>{tier.description}</span>
              </li>
            ))}
          </ol>
        </DetailsSection>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 280,
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8f9fa',
    fontWeight: 600,
    fontSize: 13,
  },
  content: {
    padding: 8,
  },
  placeholder: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center' as const,
    padding: 24,
  },
  details: {
    marginBottom: 8,
    borderRadius: 4,
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  summary: {
    padding: '6px 8px',
    backgroundColor: '#f3f4f6',
    fontWeight: 600,
    fontSize: 11,
    cursor: 'pointer',
    color: '#1a1a2e',
    userSelect: 'none',
  },
  detailsContent: {
    padding: 8,
    fontSize: 11,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  rowLabel: {
    color: '#6b7280',
    fontSize: 11,
  },
  rowValue: {
    fontWeight: 500,
    color: '#1a1a2e',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#1a1a2e',
  },
  subTable: {
    marginTop: 6,
    padding: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 3,
  },
  subTableTitle: {
    fontWeight: 600,
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  subRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    padding: '1px 0',
    fontSize: 10,
  },
  dimText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  weightGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  weightHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 40px 40px 40px 50px',
    gap: 4,
    fontWeight: 600,
    fontSize: 10,
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: 2,
  },
  weightRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 40px 40px 40px 50px',
    gap: 4,
    fontSize: 10,
    padding: '2px 0',
  },
  weightLabel: {
    fontSize: 10,
    color: '#1a1a2e',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  scoreGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  scoreHeader: {
    display: 'grid',
    gridTemplateColumns: '80px repeat(5, 1fr)',
    gap: 4,
    fontWeight: 600,
    fontSize: 10,
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: 2,
  },
  scoreRow: {
    display: 'grid',
    gridTemplateColumns: '80px repeat(5, 1fr)',
    gap: 4,
    fontSize: 10,
    padding: '2px 0',
  },
  scoreHeader6: {
    display: 'grid',
    gridTemplateColumns: '80px repeat(6, 1fr)',
    gap: 4,
    fontWeight: 600,
    fontSize: 10,
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: 2,
  },
  scoreRow6: {
    display: 'grid',
    gridTemplateColumns: '80px repeat(6, 1fr)',
    gap: 4,
    fontSize: 10,
    padding: '2px 0',
  },
  topRow: {
    backgroundColor: '#ede9fe',
    borderRadius: 2,
    padding: '2px 4px',
  },
  scoreLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#1a1a2e',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  childCard: {
    padding: 4,
    marginBottom: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 3,
  },
  childHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
  },
  childRanks: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  overlayDebug: {
    padding: 6,
    marginBottom: 6,
    backgroundColor: '#fefce8',
    borderRadius: 3,
    borderLeft: '2px solid #f59e0b',
  },
  precedenceList: {
    margin: 0,
    paddingLeft: 20,
  },
  precedenceItem: {
    fontSize: 10,
    lineHeight: '18px',
  },
  tierName: {
    fontWeight: 600,
    fontFamily: 'monospace',
    color: '#1a1a2e',
    marginRight: 4,
  },
};
