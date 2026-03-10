import { FairnessDeltaBatch } from '../types';
import { createHash } from 'crypto';

/**
 * Builds a deterministic idempotency key for a fairness delta batch.
 * Used to prevent duplicate event recording.
 *
 * Key is derived from: sourceType + sourceId + eventType + parentId + effectiveDate
 */
export function buildIdempotencyKey(
  batch: FairnessDeltaBatch,
  parentId: string,
): string {
  const parts = [
    batch.sourceType,
    batch.sourceId ?? '',
    batch.eventType,
    parentId,
    batch.effectiveDate,
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 64);
}
