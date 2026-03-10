import {
  ExplanationBundle,
  ExplanationRecord,
  ExplanationTargetType,
} from '../types';
import { ExplanationSummaryBuilder } from '../builders/ExplanationSummaryBuilder';

/**
 * Assembles an ExplanationBundle from persisted records.
 * Preserves deterministic ordering.
 */
export class ExplanationBundleAssembler {
  private readonly summaryBuilder = new ExplanationSummaryBuilder();

  assemble(input: {
    targetType: ExplanationTargetType;
    targetId: string;
    records: ExplanationRecord[];
    generatedAt: string;
  }): ExplanationBundle {
    const { targetType, targetId, records, generatedAt } = input;

    const changeExplanations = records.filter(r => r.category === 'CHANGE');
    const fairnessExplanations = records.filter(r => r.category === 'FAIRNESS');
    const policyExplanations = records.filter(r => r.category === 'POLICY');
    const calendarExplanations = records.filter(r => r.category === 'CALENDAR');
    const acceptanceExplanations = records.filter(r => r.category === 'ACCEPTANCE');

    const summary = this.summaryBuilder.buildSummary({
      targetType, targetId, records, generatedAt,
    });

    return {
      targetType,
      targetId,
      summary,
      changeExplanations,
      fairnessExplanations,
      policyExplanations,
      calendarExplanations,
      acceptanceExplanations,
      artifacts: [],
    };
  }
}
