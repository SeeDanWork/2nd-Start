// Types
export {
  PolicyScope,
  PolicyScopeType,
  BasePolicyParameters,
  TypedPolicyRule,
  SiblingCohesionParameters,
  MinBlockLengthParameters,
  SchoolNightRoutineParameters,
  TravelDistanceLimitParameters,
  ExchangeLocationParameters,
  ActivityCommitmentParameters,
  PolicyEvaluationContext,
  PolicyViolation,
  PolicyPenalty,
  PolicyGuidance,
  PolicyImpactRecord,
  PolicyImpactType,
  PolicyEvaluationResult,
  PolicyRuleEvaluationOutput,
  PolicyRuleEvaluationInput,
  ScheduleSnapshotLike,
  SnapshotNight,
  SnapshotExchange,
} from './types';

// Registry
export { PolicyRegistry, PolicyRuleEvaluator, createDefaultRegistry } from './registry';

// Rules
export {
  SiblingCohesionRuleEvaluator,
  MinBlockLengthRuleEvaluator,
  SchoolNightRoutineRuleEvaluator,
  TravelDistanceLimitRuleEvaluator,
  ExchangeLocationRuleEvaluator,
  ActivityCommitmentRuleEvaluator,
} from './rules';

// Applicability
export { isPolicyApplicable, doesPolicyScopeMatchDate, doesPolicyScopeMatchChild } from './applicability';

// Evaluation engine
export { evaluatePolicies, adaptScheduleSnapshot, adaptProposalSnapshot } from './evaluation';
export type { RawScheduleData, RawProposalScheduleData } from './evaluation';

// Validation
export { validateRuleDefinition, validateRuleParameters } from './validation';

// Repository interface
export { IPolicyRuleRepository } from './repositories';

// Errors
export {
  UnsupportedPolicyRuleTypeError,
  InvalidPolicyParametersError,
  InvalidPolicyScopeError,
  PolicyEvaluationError,
  PolicyRegistryError,
} from './errors';

// Schema validators
export {
  validateSiblingCohesionParameters,
  validateMinBlockLengthParameters,
  validateSchoolNightRoutineParameters,
  validateTravelDistanceLimitParameters,
  validateExchangeLocationParameters,
  validateActivityCommitmentParameters,
  validateParametersForRuleType,
} from './types/schemas';
