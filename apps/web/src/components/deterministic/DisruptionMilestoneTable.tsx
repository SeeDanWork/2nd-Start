import { CSSProperties } from 'react';
import type { MilestoneSnapshot } from './milestones';

interface Props {
  milestones: MilestoneSnapshot[];
}

export function DisruptionMilestoneTable({ milestones }: Props) {
  // Only render when there are disruption overlays in at least one milestone
  const hasOverlays = milestones.some((m) => m.overlays.length > 0);
  if (!hasOverlays || milestones.length === 0) return null;

  // Collect unique event types across all milestones
  const eventTypes = new Set<string>();
  for (const m of milestones) {
    for (const o of m.overlays) {
      eventTypes.add(o.eventType);
    }
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Disruption Overlays Across Milestones</div>
      <div style={styles.content}>
        {[...eventTypes].map((eventType) => (
          <div key={eventType} style={styles.eventBlock}>
            <div style={styles.eventTitle}>{eventType}</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Milestone</th>
                  <th style={styles.th}>Action</th>
                  <th style={styles.thNum}>Locks</th>
                  <th style={styles.thNum}>Comp</th>
                  <th style={styles.thNum}>WtAdj</th>
                  <th style={styles.th}>Proposal</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => {
                  const overlay = m.overlays.find((o) => o.eventType === eventType);
                  if (!overlay) {
                    return (
                      <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                        <td style={styles.td}>{m.label}</td>
                        <td style={styles.td} colSpan={5}>-</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                      <td style={styles.td}>{m.label}</td>
                      <td style={styles.tdMono}>{overlay.actionTaken}</td>
                      <td style={styles.tdNum}>{overlay.locks.length}</td>
                      <td style={styles.tdNum}>{overlay.compensatoryDays.length}</td>
                      <td style={styles.tdNum}>{overlay.weightAdjustments.length}</td>
                      <td style={styles.td}>{overlay.requiresProposal ? 'Yes' : 'No'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    borderBottom: '1px solid #e5e7eb',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#fef3c7',
    fontWeight: 600,
    fontSize: 13,
    color: '#92400e',
  },
  content: {
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxHeight: 300,
    overflow: 'auto',
  },
  eventBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  eventTitle: {
    fontWeight: 600,
    fontSize: 11,
    color: '#92400e',
    fontFamily: 'monospace',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 11,
  },
  th: {
    textAlign: 'left',
    padding: '4px 8px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8f9fa',
    fontWeight: 600,
    fontSize: 10,
    color: '#6b7280',
  },
  thNum: {
    textAlign: 'right',
    padding: '4px 8px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8f9fa',
    fontWeight: 600,
    fontSize: 10,
    color: '#6b7280',
  },
  td: {
    padding: '4px 8px',
    fontSize: 11,
    color: '#1a1a2e',
  },
  tdMono: {
    padding: '4px 8px',
    fontSize: 10,
    color: '#1a1a2e',
    fontFamily: 'monospace',
  },
  tdNum: {
    padding: '4px 8px',
    fontSize: 11,
    color: '#1a1a2e',
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  rowEven: {
    backgroundColor: '#fff',
  },
  rowOdd: {
    backgroundColor: '#f9fafb',
  },
};
