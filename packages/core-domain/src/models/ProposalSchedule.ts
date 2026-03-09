import { SolverScoreBreakdown, FairnessProjection } from '../types';

export interface ProposalSchedule {
  id: string;
  proposalId: string;
  scoreBreakdown: SolverScoreBreakdown;
  fairnessProjection: FairnessProjection;
  stabilityDelta: number;
  createdAt: Date;
}

export function createProposalSchedule(
  id: string,
  proposalId: string,
  scoreBreakdown: SolverScoreBreakdown,
  fairnessProjection: FairnessProjection,
  stabilityDelta: number,
): ProposalSchedule {
  return {
    id,
    proposalId,
    scoreBreakdown,
    fairnessProjection,
    stabilityDelta,
    createdAt: new Date(),
  };
}
