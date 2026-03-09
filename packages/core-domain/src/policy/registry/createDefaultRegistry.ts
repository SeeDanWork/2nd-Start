import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyRegistry } from './PolicyRegistry';
import { SiblingCohesionRuleEvaluator } from '../rules/SiblingCohesionRuleEvaluator';
import { MinBlockLengthRuleEvaluator } from '../rules/MinBlockLengthRuleEvaluator';
import { SchoolNightRoutineRuleEvaluator } from '../rules/SchoolNightRoutineRuleEvaluator';
import { TravelDistanceLimitRuleEvaluator } from '../rules/TravelDistanceLimitRuleEvaluator';
import { ExchangeLocationRuleEvaluator } from '../rules/ExchangeLocationRuleEvaluator';
import { ActivityCommitmentRuleEvaluator } from '../rules/ActivityCommitmentRuleEvaluator';

export function createDefaultRegistry(): PolicyRegistry {
  const registry = new PolicyRegistry();
  registry.register(PolicyRuleType.SIBLING_COHESION, new SiblingCohesionRuleEvaluator());
  registry.register(PolicyRuleType.MIN_BLOCK_LENGTH, new MinBlockLengthRuleEvaluator());
  registry.register(PolicyRuleType.SCHOOL_NIGHT_ROUTINE, new SchoolNightRoutineRuleEvaluator());
  registry.register(PolicyRuleType.TRAVEL_DISTANCE_LIMIT, new TravelDistanceLimitRuleEvaluator());
  registry.register(PolicyRuleType.EXCHANGE_LOCATION, new ExchangeLocationRuleEvaluator());
  registry.register(PolicyRuleType.ACTIVITY_COMMITMENT, new ActivityCommitmentRuleEvaluator());
  return registry;
}
