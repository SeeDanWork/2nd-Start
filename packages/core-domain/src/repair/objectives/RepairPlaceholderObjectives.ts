import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { NormalizedRepairInput } from '../types';

/**
 * Parent preference objective for repair (placeholder).
 * Returns neutral score (1.0) until preference data is modeled.
 */
export function computeRepairParentPreferenceScore(
  _repairedSchedule: ScheduleSnapshot,
  _input: NormalizedRepairInput,
): number {
  return 1.0;
}

/**
 * Child preference objective for repair (placeholder).
 * Returns neutral score (1.0) until preference data is modeled.
 */
export function computeRepairChildPreferenceScore(
  _repairedSchedule: ScheduleSnapshot,
  _input: NormalizedRepairInput,
): number {
  return 1.0;
}

/**
 * Logistics objective for repair (placeholder).
 * Returns neutral score (1.0) until logistics data is modeled.
 */
export function computeRepairLogisticsScore(
  _repairedSchedule: ScheduleSnapshot,
  _input: NormalizedRepairInput,
): number {
  return 1.0;
}

/**
 * Convenience objective for repair (placeholder).
 * Returns neutral score (1.0) until convenience signals are modeled.
 */
export function computeRepairConvenienceScore(
  _repairedSchedule: ScheduleSnapshot,
  _input: NormalizedRepairInput,
): number {
  return 1.0;
}
