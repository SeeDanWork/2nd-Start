import { PolicyRuleType } from '../../../enums/PolicyRuleType';
import {
  SiblingCohesionParameters,
  MinBlockLengthParameters,
  SchoolNightRoutineParameters,
  TravelDistanceLimitParameters,
  ExchangeLocationParameters,
  ActivityCommitmentParameters,
} from '../parameters';
import { BasePolicyParameters } from '../BasePolicyParameters';
import { InvalidPolicyParametersError } from '../../errors';

function assertObject(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidPolicyParametersError('Parameters must be a non-null object');
  }
  return input as Record<string, unknown>;
}

function assertBoolean(obj: Record<string, unknown>, key: string): boolean {
  if (typeof obj[key] !== 'boolean') {
    throw new InvalidPolicyParametersError(`'${key}' must be a boolean`);
  }
  return obj[key] as boolean;
}

function assertPositiveInt(obj: Record<string, unknown>, key: string): number {
  const val = obj[key];
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 1) {
    throw new InvalidPolicyParametersError(`'${key}' must be a positive integer`);
  }
  return val;
}

function assertNonNegativeInt(obj: Record<string, unknown>, key: string): number {
  const val = obj[key];
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
    throw new InvalidPolicyParametersError(`'${key}' must be a non-negative integer`);
  }
  return val;
}

function assertString(obj: Record<string, unknown>, key: string): string {
  if (typeof obj[key] !== 'string' || (obj[key] as string).trim().length === 0) {
    throw new InvalidPolicyParametersError(`'${key}' must be a non-empty string`);
  }
  return obj[key] as string;
}

function optionalPositiveInt(obj: Record<string, unknown>, key: string): number | undefined {
  if (obj[key] === undefined || obj[key] === null) return undefined;
  return assertPositiveInt(obj, key);
}

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  if (obj[key] === undefined || obj[key] === null) return undefined;
  return assertString(obj, key);
}

function optionalStringArray(obj: Record<string, unknown>, key: string): string[] | undefined {
  if (obj[key] === undefined || obj[key] === null) return undefined;
  if (!Array.isArray(obj[key])) {
    throw new InvalidPolicyParametersError(`'${key}' must be an array of strings`);
  }
  const arr = obj[key] as unknown[];
  if (!arr.every(v => typeof v === 'string')) {
    throw new InvalidPolicyParametersError(`'${key}' must contain only strings`);
  }
  return arr as string[];
}

function optionalNumberArray(obj: Record<string, unknown>, key: string): number[] | undefined {
  if (obj[key] === undefined || obj[key] === null) return undefined;
  if (!Array.isArray(obj[key])) {
    throw new InvalidPolicyParametersError(`'${key}' must be an array of numbers`);
  }
  const arr = obj[key] as unknown[];
  if (!arr.every(v => typeof v === 'number')) {
    throw new InvalidPolicyParametersError(`'${key}' must contain only numbers`);
  }
  return arr as number[];
}

export function validateSiblingCohesionParameters(input: unknown): SiblingCohesionParameters {
  const obj = assertObject(input);
  return {
    allowDivergence: assertBoolean(obj, 'allowDivergence'),
    maxSplitNights: optionalPositiveInt(obj, 'maxSplitNights'),
    minAgeGapForDivergence: optionalPositiveInt(obj, 'minAgeGapForDivergence'),
  };
}

export function validateMinBlockLengthParameters(input: unknown): MinBlockLengthParameters {
  const obj = assertObject(input);
  return {
    nights: assertPositiveInt(obj, 'nights'),
  };
}

export function validateSchoolNightRoutineParameters(input: unknown): SchoolNightRoutineParameters {
  const obj = assertObject(input);
  return {
    maxWeekdayTransitions: assertNonNegativeInt(obj, 'maxWeekdayTransitions'),
    protectedWeekdays: optionalNumberArray(obj, 'protectedWeekdays'),
  };
}

export function validateTravelDistanceLimitParameters(input: unknown): TravelDistanceLimitParameters {
  const obj = assertObject(input);
  return {
    maxMinutes: assertPositiveInt(obj, 'maxMinutes'),
  };
}

export function validateExchangeLocationParameters(input: unknown): ExchangeLocationParameters {
  const obj = assertObject(input);
  return {
    preferredLocation: assertString(obj, 'preferredLocation'),
    allowedLocations: optionalStringArray(obj, 'allowedLocations'),
  };
}

export function validateActivityCommitmentParameters(input: unknown): ActivityCommitmentParameters {
  const obj = assertObject(input);
  return {
    activityLabel: assertString(obj, 'activityLabel'),
    preferredResponsibleParentId: optionalString(obj, 'preferredResponsibleParentId'),
    fixedDates: optionalStringArray(obj, 'fixedDates'),
  };
}

export function validateParametersForRuleType(ruleType: PolicyRuleType, input: unknown): BasePolicyParameters {
  switch (ruleType) {
    case PolicyRuleType.SIBLING_COHESION:
      return validateSiblingCohesionParameters(input);
    case PolicyRuleType.MIN_BLOCK_LENGTH:
      return validateMinBlockLengthParameters(input);
    case PolicyRuleType.SCHOOL_NIGHT_ROUTINE:
      return validateSchoolNightRoutineParameters(input);
    case PolicyRuleType.TRAVEL_DISTANCE_LIMIT:
      return validateTravelDistanceLimitParameters(input);
    case PolicyRuleType.EXCHANGE_LOCATION:
      return validateExchangeLocationParameters(input);
    case PolicyRuleType.ACTIVITY_COMMITMENT:
      return validateActivityCommitmentParameters(input);
    default:
      throw new InvalidPolicyParametersError(`Unsupported rule type: ${ruleType}`);
  }
}
