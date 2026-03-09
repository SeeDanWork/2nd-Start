// ── Monte Carlo Data Models ─────────────────────────────────
// Engineering and policy insights only — no behavioral predictions.

// ── 1. Solver Stability ──

export interface SolverRunMetrics {
  scenario_id: string;
  family_structure: string;
  constraint_set: string[];
  fairness_deviation: number;       // % off target split
  transition_count: number;         // weekly transitions
  schedule_change_magnitude: number; // days changed from baseline
  routine_stability_score: number;  // 0-1, higher = more stable
  compensation_balance: number;     // cumulative fairness debt in days
  solve_time_ms: number;
  feasible: boolean;
}

// ── 2. Edge Case / Constraint Conflicts ──

export interface ConstraintConflict {
  scenario_id: string;
  constraints_active: string[];
  event_sequence: string[];
  solver_failure_reason: string;
  minimal_relaxation_required: string[];
  severity: 'warning' | 'infeasible' | 'degraded';
}

// ── 3. Policy Gaps ──

export interface PolicyGap {
  event_sequence: string[];
  family_type: string;
  solver_response: 'handled' | 'fallback' | 'infeasible' | 'no_policy';
  manual_resolution: string;
  recommended_policy: string;
  occurrence_count: number;
}

// ── 4. Monte Carlo Summary ──

export interface MonteCarloSummary {
  simulation_id: string;
  runs: number;
  duration_ms: number;
  timestamp: string;

  // Fairness
  mean_fairness_drift: number;
  median_fairness_drift: number;
  p95_fairness_drift: number;
  max_fairness_drift: number;

  // Transitions
  mean_transitions: number;
  p95_transitions: number;
  max_transitions: number;

  // Stability
  mean_stability_score: number;
  schedule_change_frequency: number;

  // Failures
  conflict_rate: number;          // % of runs with constraint conflicts
  solver_infeasible_rate: number; // % of runs where solver couldn't find solution
  degraded_solution_rate: number; // % of runs where solver relaxed constraints

  // Patterns
  most_common_disruption_sequence: string[];
  most_frequent_policy_gap: string | null;
  top_failure_patterns: FailurePattern[];
  constraint_conflicts: ConstraintConflict[];
  policy_gaps: PolicyGap[];
}

// ── 5. Proposal Interaction (UX friction) ──

export interface ProposalInteraction {
  scenario_id: string;
  proposal_bundle_id: string;
  options_count: number;
  acceptance_rate: number;
  rejection_reason: string | null;
  resolution_steps: number;       // how many rounds to resolve
  comprehension_failure: boolean; // persona couldn't parse proposal
}

// ── 6. Failure Patterns ──

export interface FailurePattern {
  family_structure: string;
  constraints: string[];
  event_sequence: string[];
  solver_result: 'infeasible' | 'degraded' | 'timeout';
  recommended_constraint_relaxation: string[];
  occurrence_count: number;
  first_seen: string;
}

// ── 7. Regression Tests ──

export interface RegressionTest {
  test_id: string;
  name: string;
  family_setup: {
    structure: string;
    children: Array<{ age: number }>;
    distance_miles: number;
    template: string;
    target_split: number;
  };
  events: Array<{ type: string; day: number; duration?: number; parent?: string }>;
  constraints: string[];
  expected_solver_behavior: {
    feasible: boolean;
    max_fairness_drift: number;
    max_transitions: number;
    min_stability_score: number;
  };
  discovered_from: string; // simulation_id that found this case
  created_at: string;
}

// ── 8. Guardrail Calibration ──

export interface GuardrailCalibration {
  parameter: string;              // e.g. 'max_transitions_per_week'
  tested_values: number[];
  infeasible_rates: number[];     // % infeasible at each value
  stability_scores: number[];     // mean stability at each value
  recommended_value: number;
  recommended_range: [number, number];
}

// ── 9. Run Configuration ──

export interface MonteCarloConfig {
  runs: number;
  horizon_weeks: number;
  family_structures: string[];    // IDs to include, empty = all
  templates: string[];            // schedule templates, empty = all
  disruption_model: 'uniform' | 'realistic'; // uniform = equal prob, realistic = stress model
  constraints_to_test: string[];  // specific constraints to stress-test
  guardrail_sweep?: {
    parameter: string;
    values: number[];
  };
}

export const DEFAULT_MONTE_CARLO_CONFIG: MonteCarloConfig = {
  runs: 1000,
  horizon_weeks: 8,
  family_structures: [],
  templates: [],
  disruption_model: 'realistic',
  constraints_to_test: [],
};
