import { ProposalArtifact, ProposalCandidateInput } from '../types';

/**
 * Collects and normalizes artifacts from solver candidates into proposal artifacts.
 */
export function collectCandidateArtifacts(
  candidate: ProposalCandidateInput,
): ProposalArtifact[] {
  if (!candidate.artifacts || candidate.artifacts.length === 0) return [];

  return candidate.artifacts.map(a => ({
    type: a.type,
    data: a.data,
  }));
}
