import {
  ExplanationQueryResult,
  ExplanationTargetType,
  IExplanationRecordRepository,
} from '../types';
import { ExplanationQueryError } from '../errors';
import { ExplanationBundleAssembler } from './ExplanationBundleAssembler';

export interface ExplanationQueryServiceDeps {
  recordRepository: IExplanationRecordRepository;
}

/**
 * Fetches persisted explanation records and assembles bundles deterministically.
 */
export class ExplanationQueryService {
  private readonly assembler = new ExplanationBundleAssembler();

  constructor(private readonly deps: ExplanationQueryServiceDeps) {}

  async getBundle(input: {
    targetType: ExplanationTargetType;
    targetId: string;
  }): Promise<ExplanationQueryResult> {
    const { targetType, targetId } = input;

    const records = await this.deps.recordRepository.findByTarget(targetType, targetId);

    if (records.length === 0) {
      throw new ExplanationQueryError(
        `No explanation records found for ${targetType}:${targetId}. ` +
        'Bundle cannot be assembled without persisted records or regeneration data.',
      );
    }

    const bundle = this.assembler.assemble({
      targetType,
      targetId,
      records,
      generatedAt: new Date().toISOString(),
    });

    return { bundle };
  }
}
