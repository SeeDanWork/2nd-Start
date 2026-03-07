// ── Parent Persona Library ───────────────────────────────────
// Each persona represents behavior patterns, not demographics.
// Personas influence how the parent responds to proposals.

export interface PersonaBehavior {
  conflict_level: number;        // 1-5: how combative
  fairness_sensitivity: number;  // 1-5: how closely they track balance
  schedule_rigidity: number;     // 1-5: how much they resist changes
  logistics_tolerance: number;   // 1-5: how flexible on logistics
  response_speed: 'fast' | 'medium' | 'slow' | 'very_slow';
  gaming_probability: number;    // 0-1: chance of strategic behavior
  proposal_acceptance_bias: number; // 0-1: base acceptance rate
}

export interface ParentPersona {
  id: string;
  name: string;
  description: string;
  behavior: PersonaBehavior;
}

export const PARENT_PERSONAS: ParentPersona[] = [
  {
    id: 'cooperative_organizer',
    name: 'Cooperative Organizer',
    description: 'Prioritizes stability and cooperation. Accepts reasonable proposals quickly.',
    behavior: {
      conflict_level: 1,
      fairness_sensitivity: 3,
      schedule_rigidity: 4,
      logistics_tolerance: 4,
      response_speed: 'fast',
      gaming_probability: 0,
      proposal_acceptance_bias: 0.8,
    },
  },
  {
    id: 'fairness_scorekeeper',
    name: 'Fairness Scorekeeper',
    description: 'Tracks custody balance carefully and resists perceived imbalance.',
    behavior: {
      conflict_level: 3,
      fairness_sensitivity: 5,
      schedule_rigidity: 3,
      logistics_tolerance: 2,
      response_speed: 'medium',
      gaming_probability: 0.1,
      proposal_acceptance_bias: 0.5,
    },
  },
  {
    id: 'flexible_disorganized',
    name: 'Flexible but Disorganized',
    description: 'Accepts many changes but frequently introduces disruptions.',
    behavior: {
      conflict_level: 1,
      fairness_sensitivity: 2,
      schedule_rigidity: 1,
      logistics_tolerance: 5,
      response_speed: 'slow',
      gaming_probability: 0,
      proposal_acceptance_bias: 0.9,
    },
  },
  {
    id: 'strategic_gamer',
    name: 'Strategic Gamer',
    description: 'Attempts to gain extra time or advantage within system rules.',
    behavior: {
      conflict_level: 4,
      fairness_sensitivity: 3,
      schedule_rigidity: 3,
      logistics_tolerance: 2,
      response_speed: 'medium',
      gaming_probability: 0.7,
      proposal_acceptance_bias: 0.3,
    },
  },
  {
    id: 'avoidant_parent',
    name: 'Avoidant Parent',
    description: 'Responds slowly and often ignores requests.',
    behavior: {
      conflict_level: 2,
      fairness_sensitivity: 2,
      schedule_rigidity: 2,
      logistics_tolerance: 3,
      response_speed: 'very_slow',
      gaming_probability: 0,
      proposal_acceptance_bias: 0.4,
    },
  },
  {
    id: 'high_conflict_controller',
    name: 'High Conflict Controller',
    description: 'Rejects proposals frequently and challenges fairness decisions.',
    behavior: {
      conflict_level: 5,
      fairness_sensitivity: 4,
      schedule_rigidity: 5,
      logistics_tolerance: 1,
      response_speed: 'fast',
      gaming_probability: 0.4,
      proposal_acceptance_bias: 0.2,
    },
  },
];

// ── Family Structure Personas ────────────────────────────────

export interface FamilyStructure {
  id: string;
  name: string;
  description: string;
  children: Array<{ age: number; name: string }>;
  distanceMiles: number;
  baseTemplate: string;
  targetSplit: number;
}

export const FAMILY_STRUCTURES: FamilyStructure[] = [
  {
    id: 'simple_shared',
    name: 'Simple Shared Custody',
    description: 'One school-age child, moderate distance',
    children: [{ age: 7, name: 'Child 1' }],
    distanceMiles: 10,
    baseTemplate: '2-2-3',
    targetSplit: 50,
  },
  {
    id: 'toddler_family',
    name: 'Toddler Stability Sensitive',
    description: 'Young child requiring shorter stretches',
    children: [{ age: 2, name: 'Child 1' }],
    distanceMiles: 5,
    baseTemplate: '2-2-3',
    targetSplit: 50,
  },
  {
    id: 'school_family',
    name: 'Multi-Child School Schedule',
    description: 'Two school-age children, moderate distance',
    children: [{ age: 6, name: 'Child 1' }, { age: 10, name: 'Child 2' }],
    distanceMiles: 15,
    baseTemplate: '3-4-4-3',
    targetSplit: 50,
  },
  {
    id: 'teen_family',
    name: 'Teen Flexibility',
    description: 'Teenager who may have own preferences',
    children: [{ age: 15, name: 'Child 1' }],
    distanceMiles: 20,
    baseTemplate: 'alternating_weeks',
    targetSplit: 50,
  },
  {
    id: 'infant_split',
    name: 'Infant Primary Care',
    description: 'Infant requiring primary parent, limited overnights',
    children: [{ age: 0, name: 'Child 1' }],
    distanceMiles: 8,
    baseTemplate: '5-2',
    targetSplit: 70,
  },
  {
    id: 'blended_ages',
    name: 'Blended Ages',
    description: 'Three children spanning toddler to teen',
    children: [
      { age: 3, name: 'Child 1' },
      { age: 8, name: 'Child 2' },
      { age: 13, name: 'Child 3' },
    ],
    distanceMiles: 12,
    baseTemplate: '3-4-4-3',
    targetSplit: 50,
  },
];
