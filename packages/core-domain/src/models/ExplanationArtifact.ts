import { ScheduleId } from '../types';

export interface ExplanationArtifact {
  id: string;
  scheduleVersionId: ScheduleId;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
}

export function createExplanationArtifact(
  id: string,
  scheduleVersionId: ScheduleId,
  type: string,
  data: Record<string, unknown>,
): ExplanationArtifact {
  if (!type || type.trim().length === 0) {
    throw new Error('Explanation type must not be empty');
  }
  return {
    id,
    scheduleVersionId,
    type: type.trim(),
    data,
    createdAt: new Date(),
  };
}
