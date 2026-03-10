import { ExplanationCategory } from '../types';

interface ArtifactTypeMapping {
  category: ExplanationCategory;
  importance: 'PRIMARY' | 'SECONDARY' | 'SUPPORTING';
}

const ARTIFACT_TYPE_MAP: Record<string, ArtifactTypeMapping> = {
  // Solver artifacts
  SCORE_BREAKDOWN: { category: 'CHANGE', importance: 'PRIMARY' },
  STABILITY_ANALYSIS: { category: 'CHANGE', importance: 'SECONDARY' },
  CANDIDATE_COMPARISON: { category: 'CHANGE', importance: 'SECONDARY' },

  // Repair artifacts
  REPAIR_SCORE: { category: 'CHANGE', importance: 'PRIMARY' },
  OVERLAY_IMPACT: { category: 'CHANGE', importance: 'PRIMARY' },
  RESTITUTION_TARGET: { category: 'FAIRNESS', importance: 'PRIMARY' },

  // Fairness artifacts
  FAIRNESS_PROJECTION: { category: 'FAIRNESS', importance: 'PRIMARY' },
  FAIRNESS_DRIFT: { category: 'FAIRNESS', importance: 'PRIMARY' },
  FAIRNESS_LEDGER_UPDATE: { category: 'FAIRNESS', importance: 'SECONDARY' },

  // Policy artifacts
  POLICY_VIOLATION: { category: 'POLICY', importance: 'PRIMARY' },
  POLICY_PENALTY: { category: 'POLICY', importance: 'SECONDARY' },
  POLICY_GUIDANCE: { category: 'POLICY', importance: 'SUPPORTING' },
  POLICY_IMPACT: { category: 'POLICY', importance: 'SECONDARY' },

  // Calendar artifacts
  CALENDAR_CLASSIFICATION: { category: 'CALENDAR', importance: 'PRIMARY' },
  CALENDAR_CONSTRAINT_SUMMARY: { category: 'CALENDAR', importance: 'SECONDARY' },
  CHILD_COMMITMENT_SIGNALS: { category: 'CALENDAR', importance: 'SUPPORTING' },
  CALENDAR_INGESTION: { category: 'CALENDAR', importance: 'SUPPORTING' },

  // Acceptance artifacts
  ACCEPTANCE_RESULT: { category: 'ACCEPTANCE', importance: 'PRIMARY' },
  INVALIDATED_PROPOSALS: { category: 'ACCEPTANCE', importance: 'SECONDARY' },
  OVERLAY_RESOLUTION: { category: 'ACCEPTANCE', importance: 'SECONDARY' },

  // Proposal artifacts
  PROPOSAL_DIFF: { category: 'CHANGE', importance: 'PRIMARY' },
  PROPOSAL_SCORE: { category: 'CHANGE', importance: 'SECONDARY' },
  PROPOSAL_FAIRNESS: { category: 'FAIRNESS', importance: 'SECONDARY' },
};

/**
 * Maps known artifact types to explanation categories and importance levels.
 * Unknown types are treated as SUPPORTING in the closest matching category.
 */
export class SourceArtifactRegistry {
  getMapping(artifactType: string): ArtifactTypeMapping | undefined {
    return ARTIFACT_TYPE_MAP[artifactType];
  }

  getCategoryForArtifact(artifactType: string): ExplanationCategory {
    return ARTIFACT_TYPE_MAP[artifactType]?.category ?? 'CHANGE';
  }

  getImportanceForArtifact(artifactType: string): 'PRIMARY' | 'SECONDARY' | 'SUPPORTING' {
    return ARTIFACT_TYPE_MAP[artifactType]?.importance ?? 'SUPPORTING';
  }

  isKnownType(artifactType: string): boolean {
    return artifactType in ARTIFACT_TYPE_MAP;
  }
}
