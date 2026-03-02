import { CSSProperties } from 'react';
import type {
  BaselineRecommendationOutputV2,
  TemplateScoreV2,
  DisruptionOverlayResult,
  FamilyContextDefaults,
} from '@adcp/shared';

interface Props {
  recommendation: BaselineRecommendationOutputV2 | null;
  context: FamilyContextDefaults | null;
  overlays: DisruptionOverlayResult[];
  /** When set, show this template instead of the top-ranked one */
  activeTemplate?: TemplateScoreV2 | null;
}

function confidenceColor(c: string): string {
  if (c === 'high') return '#16a34a';
  if (c === 'medium') return '#d97706';
  return '#ef4444';
}

export function ExplanationPanel({ recommendation, context, overlays, activeTemplate }: Props) {
  if (!recommendation) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>Explanation</div>
        <div style={styles.content}>
          <p style={styles.placeholder}>Waiting for computation...</p>
        </div>
      </div>
    );
  }

  const agg = recommendation.aggregate;
  const top: TemplateScoreV2 | undefined = activeTemplate ?? agg.recommendedTemplates[0];

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Explanation</div>
      <div style={styles.content}>
        {/* Rationale */}
        {agg.rationaleBullets.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Rationale</div>
            <ul style={styles.bulletList}>
              {agg.rationaleBullets.map((b, i) => (
                <li key={i} style={styles.bullet}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Top template */}
        {top && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Top Recommendation</div>
            <div style={styles.templateCard}>
              <div style={styles.templateName}>{top.name}</div>
              <div style={styles.templateMeta}>
                <span style={styles.templatePattern}>{top.patternSummary}</span>
                <span style={styles.scoreBadge}>Score: {top.score.toFixed(2)}</span>
                <span style={{ ...styles.confidenceBadge, color: confidenceColor(top.confidence) }}>
                  {top.confidence}
                </span>
              </div>
              {top.suggestedWhen.length > 0 && (
                <div style={styles.subSection}>
                  <div style={styles.subTitle}>When it works well:</div>
                  <ul style={styles.bulletList}>
                    {top.suggestedWhen.map((s, i) => (
                      <li key={i} style={styles.bullet}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {top.tradeoffs.length > 0 && (
                <div style={styles.subSection}>
                  <div style={styles.subTitle}>Tradeoffs:</div>
                  <ul style={styles.bulletList}>
                    {top.tradeoffs.map((t, i) => (
                      <li key={i} style={styles.bullet}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Multi-child explanation */}
        {context && Object.keys(recommendation.perChild).length > 1 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Multi-Child Analysis</div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Children:</span>
              <span style={styles.infoValue}>{Object.keys(recommendation.perChild).length}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Scoring Mode:</span>
              <span style={styles.infoValue}>{context.scoringMode}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Youngest Band:</span>
              <span style={styles.infoValue}>{context.youngestBand}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Aggregation:</span>
              <span style={styles.infoValue}>{agg.derivedFrom}</span>
            </div>
          </div>
        )}

        {/* Disruption overlay reasons */}
        {overlays.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Disruption Overlays</div>
            {overlays.map((o) => (
              <div key={o.eventId} style={styles.overlayCard}>
                <div style={styles.overlayType}>{o.eventType}</div>
                <div style={styles.overlayAction}>Action: {o.actionTaken}</div>
                {o.reasons.length > 0 && (
                  <ul style={styles.bulletList}>
                    {o.reasons.map((r, i) => (
                      <li key={i} style={styles.bullet}>{r}</li>
                    ))}
                  </ul>
                )}
                {o.locks.length > 0 && (
                  <div style={styles.overlayDetail}>
                    {o.locks.length} lock{o.locks.length !== 1 ? 's' : ''} applied
                  </div>
                )}
                {o.compensatoryDays.length > 0 && (
                  <div style={styles.overlayDetail}>
                    {o.compensatoryDays.length} compensatory day{o.compensatoryDays.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Disclaimers */}
        {recommendation.disclaimers.length > 0 && (
          <div style={styles.disclaimerBox}>
            {recommendation.disclaimers.map((d, i) => (
              <div key={i} style={styles.disclaimerText}>{d}</div>
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
    padding: 8,
  },
  placeholder: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center' as const,
    padding: 24,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 12,
    color: '#1a1a2e',
    marginBottom: 4,
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: 2,
  },
  bulletList: {
    margin: 0,
    paddingLeft: 16,
  },
  bullet: {
    fontSize: 11,
    color: '#1a1a2e',
    lineHeight: '18px',
  },
  templateCard: {
    padding: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  templateName: {
    fontWeight: 700,
    fontSize: 13,
    color: '#1a1a2e',
  },
  templateMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
  },
  templatePattern: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#6b7280',
  },
  scoreBadge: {
    fontWeight: 600,
    color: '#4A90D9',
  },
  confidenceBadge: {
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    fontSize: 10,
  },
  subSection: {
    marginTop: 4,
  },
  subTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: '#6b7280',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    padding: '2px 0',
  },
  infoLabel: {
    color: '#6b7280',
  },
  infoValue: {
    fontWeight: 500,
    color: '#1a1a2e',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  overlayCard: {
    padding: 6,
    marginBottom: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    borderLeft: '3px solid #f59e0b',
  },
  overlayType: {
    fontWeight: 600,
    fontSize: 11,
    color: '#92400e',
    fontFamily: 'monospace',
  },
  overlayAction: {
    fontSize: 10,
    color: '#6b7280',
  },
  overlayDetail: {
    fontSize: 10,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  disclaimerBox: {
    padding: 8,
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    marginTop: 8,
  },
  disclaimerText: {
    fontSize: 10,
    color: '#9ca3af',
    lineHeight: '16px',
  },
};
