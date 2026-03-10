import {
  ExplanationTargetType,
  NormalizedArtifact,
  SourceArtifactRef,
} from '../types';
import { ExplanationArtifactNormalizationError } from '../errors';

export interface RawArtifactInput {
  type: string;
  data: Record<string, unknown>;
  sourceType?: string;
  sourceId?: string;
  artifactId?: string;
}

/**
 * Normalizes raw artifacts from various subsystems into a shared
 * explanation-ready shape with source attribution.
 */
export class ArtifactNormalizer {
  normalizeArtifacts(input: {
    targetType: ExplanationTargetType;
    targetId: string;
    rawArtifacts: RawArtifactInput[];
  }): NormalizedArtifact[] {
    if (!input.targetType || !input.targetId) {
      throw new ExplanationArtifactNormalizationError(
        'targetType and targetId are required for normalization',
      );
    }

    const normalized: NormalizedArtifact[] = input.rawArtifacts.map((raw) => {
      const source: SourceArtifactRef = {
        sourceType: raw.sourceType ?? input.targetType,
        sourceId: raw.sourceId,
        artifactType: raw.type,
        artifactId: raw.artifactId,
      };

      return {
        type: raw.type,
        data: raw.data,
        source,
      };
    });

    // Deterministic ordering: by type, then sourceType, then sourceId, then artifactId
    normalized.sort((a, b) => {
      const t = a.type.localeCompare(b.type);
      if (t !== 0) return t;
      const st = (a.source.sourceType ?? '').localeCompare(b.source.sourceType ?? '');
      if (st !== 0) return st;
      const si = (a.source.sourceId ?? '').localeCompare(b.source.sourceId ?? '');
      if (si !== 0) return si;
      return (a.source.artifactId ?? '').localeCompare(b.source.artifactId ?? '');
    });

    return normalized;
  }
}
