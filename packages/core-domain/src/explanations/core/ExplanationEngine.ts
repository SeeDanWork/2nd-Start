import { ArtifactNormalizer } from './ArtifactNormalizer';
import { SourceArtifactRegistry } from './SourceArtifactRegistry';
import { ChangeExplanationBuilder } from '../builders/ChangeExplanationBuilder';
import { FairnessExplanationBuilder } from '../builders/FairnessExplanationBuilder';
import { PolicyExplanationBuilder } from '../builders/PolicyExplanationBuilder';
import { CalendarExplanationBuilder } from '../builders/CalendarExplanationBuilder';
import { AcceptanceExplanationBuilder } from '../builders/AcceptanceExplanationBuilder';
import { ExplanationSummaryBuilder } from '../builders/ExplanationSummaryBuilder';
import {
  ExplanationBundle,
  ExplanationBuildInput,
  ExplanationArtifact,
  IExplanationRecordRepository,
  IExplanationSourceArtifactRepository,
} from '../types';
import { ExplanationBuildError } from '../errors';

export interface ExplanationEngineDeps {
  recordRepository?: IExplanationRecordRepository;
  sourceArtifactRepository?: IExplanationSourceArtifactRepository;
}

/**
 * Main orchestrator: collects authoritative inputs, normalizes artifacts,
 * delegates to builders, assembles a deterministic explanation bundle.
 */
export class ExplanationEngine {
  private readonly normalizer = new ArtifactNormalizer();
  private readonly registry = new SourceArtifactRegistry();
  private readonly changeBuilder = new ChangeExplanationBuilder();
  private readonly fairnessBuilder = new FairnessExplanationBuilder();
  private readonly policyBuilder = new PolicyExplanationBuilder();
  private readonly calendarBuilder = new CalendarExplanationBuilder();
  private readonly acceptanceBuilder = new AcceptanceExplanationBuilder();
  private readonly summaryBuilder = new ExplanationSummaryBuilder();

  constructor(private readonly deps: ExplanationEngineDeps = {}) {}

  async buildBundle(input: ExplanationBuildInput): Promise<ExplanationBundle> {
    const {
      targetType, targetId, baseSchedule, candidateSchedule,
      diff, policyEvaluation, scoreBreakdown, fairnessProjection,
      rawArtifacts, createdAt, persist,
    } = input;

    // 1. Normalize artifacts
    const normalized = rawArtifacts
      ? this.normalizer.normalizeArtifacts({ targetType, targetId, rawArtifacts })
      : [];

    // Partition normalized artifacts by category
    const fairnessArtifacts = normalized.filter(a =>
      this.registry.getCategoryForArtifact(a.type) === 'FAIRNESS',
    );
    const policyArtifacts = normalized.filter(a =>
      this.registry.getCategoryForArtifact(a.type) === 'POLICY',
    );
    const calendarArtifacts = normalized.filter(a =>
      this.registry.getCategoryForArtifact(a.type) === 'CALENDAR',
    );
    const acceptanceArtifacts = normalized.filter(a =>
      this.registry.getCategoryForArtifact(a.type) === 'ACCEPTANCE',
    );
    const solverArtifacts = normalized.filter(a =>
      this.registry.getCategoryForArtifact(a.type) === 'CHANGE',
    );

    // 2. Build explanations per category
    const changeExplanations = this.changeBuilder.buildChangeExplanations({
      targetType, targetId, baseSchedule, candidateSchedule,
      diff, scoreBreakdown, policyEvaluation,
      solverArtifacts: solverArtifacts.length > 0 ? solverArtifacts : undefined,
      createdAt,
    });

    const fairnessExplanations = this.fairnessBuilder.buildFairnessExplanations({
      targetType, targetId, fairnessProjection,
      fairnessArtifacts: fairnessArtifacts.length > 0 ? fairnessArtifacts : undefined,
      createdAt,
    });

    const policyExplanations = this.policyBuilder.buildPolicyExplanations({
      targetType, targetId, policyEvaluation,
      policyArtifacts: policyArtifacts.length > 0 ? policyArtifacts : undefined,
      createdAt,
    });

    const calendarExplanations = this.calendarBuilder.buildCalendarExplanations({
      targetType, targetId,
      calendarArtifacts: calendarArtifacts.length > 0 ? calendarArtifacts : undefined,
      createdAt,
    });

    const acceptanceExplanations = this.acceptanceBuilder.buildAcceptanceExplanations({
      targetType, targetId,
      acceptanceArtifacts: acceptanceArtifacts.length > 0 ? acceptanceArtifacts : undefined,
      createdAt,
    });

    // 3. Assemble all records
    const allRecords = [
      ...changeExplanations,
      ...fairnessExplanations,
      ...policyExplanations,
      ...calendarExplanations,
      ...acceptanceExplanations,
    ];

    // 4. Build summary
    const summary = this.summaryBuilder.buildSummary({
      targetType, targetId, records: allRecords, generatedAt: createdAt,
    });

    // 5. Build explanation artifacts
    const artifacts: ExplanationArtifact[] = normalized.map(n => ({
      type: n.type,
      data: n.data,
    }));

    const bundle: ExplanationBundle = {
      targetType,
      targetId,
      summary,
      changeExplanations,
      fairnessExplanations,
      policyExplanations,
      calendarExplanations,
      acceptanceExplanations,
      artifacts,
    };

    // 6. Persist if requested
    if (persist && this.deps.recordRepository) {
      try {
        await this.deps.recordRepository.insert(allRecords);

        if (this.deps.sourceArtifactRepository) {
          for (const record of allRecords) {
            if (record.sourceArtifacts.length > 0) {
              await this.deps.sourceArtifactRepository.insertSourceRefs(
                record.recordId,
                record.sourceArtifacts,
              );
            }
          }
        }
      } catch (err) {
        throw new ExplanationBuildError(
          `Failed to persist explanation records: ${(err as Error).message}`,
        );
      }
    }

    return bundle;
  }
}
