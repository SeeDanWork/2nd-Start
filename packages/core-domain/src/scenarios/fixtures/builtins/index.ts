import { ScenarioFixture } from '../../types';
import { fixture as baselineEvenSplit } from './baseline_even_split_single_child';
import { fixture as siblingCohesion } from './sibling_cohesion_two_children';
import { fixture as schoolClosureRepair } from './school_closure_overlay_repair';
import { fixture as weekendFairness } from './weekend_fairness_restitution';
import { fixture as calendarSchool } from './calendar_school_event_hard_constraint';
import { fixture as policyMinBlock } from './policy_min_block_length_enforced';
import { fixture as staleProposal } from './stale_proposal_rejected';

export const BUILTIN_FIXTURES: ScenarioFixture[] = [
  baselineEvenSplit,
  siblingCohesion,
  schoolClosureRepair,
  weekendFairness,
  calendarSchool,
  policyMinBlock,
  staleProposal,
];

export {
  baselineEvenSplit,
  siblingCohesion,
  schoolClosureRepair,
  weekendFairness,
  calendarSchool,
  policyMinBlock,
  staleProposal,
};
