// ─── PDF Export Trigger ──────────────────────────────────────────
//
// Dynamic import of @react-pdf/renderer to avoid bundle cost.
// Renders the MilestoneReport to a blob and triggers download.

import type { BaselineRecommendationInputV2 } from '@adcp/shared';
import type { MilestoneSnapshot } from '../milestones';

export async function exportMilestoneReport(
  familyInput: BaselineRecommendationInputV2,
  arrangement: string,
  snapshots: MilestoneSnapshot[],
): Promise<void> {
  // Dynamic import to keep @react-pdf/renderer out of the main bundle
  const [{ pdf }, { MilestoneReport }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./MilestoneReport'),
  ]);

  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const doc = MilestoneReport({ familyInput, arrangement, snapshots, generatedAt });
  const blob = await pdf(doc).toBlob();

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `adcp-model-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
