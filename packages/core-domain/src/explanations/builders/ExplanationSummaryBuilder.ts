import {
  ExplanationRecord,
  ExplanationSummary,
  ExplanationTargetType,
} from '../types';

/**
 * Classifies explanation records into primary/secondary/supporting
 * and produces a deterministically ordered summary.
 */
export class ExplanationSummaryBuilder {
  buildSummary(input: {
    targetType: ExplanationTargetType;
    targetId: string;
    records: ExplanationRecord[];
    generatedAt: string;
  }): ExplanationSummary {
    const { targetType, targetId, records, generatedAt } = input;

    // Deduplicate by recordId
    const seen = new Set<string>();
    const uniqueRecords: ExplanationRecord[] = [];
    for (const r of records) {
      if (!seen.has(r.recordId)) {
        seen.add(r.recordId);
        uniqueRecords.push(r);
      }
    }

    // Sort deterministically
    const sorted = [...uniqueRecords].sort(compareRecords);

    const primaryReasons = sorted.filter(r => r.importance === 'PRIMARY');
    const secondaryReasons = sorted.filter(r => r.importance === 'SECONDARY');
    const supportingReasons = sorted.filter(r => r.importance === 'SUPPORTING');

    return {
      targetType,
      targetId,
      primaryReasons,
      secondaryReasons,
      supportingReasons,
      generatedAt,
    };
  }
}

/**
 * Deterministic comparison: importance → date → childId → code → recordId
 */
function compareRecords(a: ExplanationRecord, b: ExplanationRecord): number {
  const importanceOrder: Record<string, number> = { PRIMARY: 0, SECONDARY: 1, SUPPORTING: 2 };
  const io = (importanceOrder[a.importance] ?? 9) - (importanceOrder[b.importance] ?? 9);
  if (io !== 0) return io;

  const d = (a.date ?? '').localeCompare(b.date ?? '');
  if (d !== 0) return d;

  const c = (a.childId ?? '').localeCompare(b.childId ?? '');
  if (c !== 0) return c;

  const co = a.code.localeCompare(b.code);
  if (co !== 0) return co;

  return a.recordId.localeCompare(b.recordId);
}
