// ── Monte Carlo Simulation Runner ───────────────────────────
// Runs N simulations with randomized families, events, and constraints.
// Produces engineering metrics — solver stability, edge cases, policy gaps.
// No behavioral predictions.

import { FAMILY_STRUCTURES } from '../personas';
import { TEMPLATE_OPTIONS } from '../types';
import { generateEvents, GeneratedEvent } from './stress-model';
import {
  MonteCarloConfig,
  MonteCarloSummary,
  SolverRunMetrics,
  ConstraintConflict,
  PolicyGap,
  FailurePattern,
  ProposalInteraction,
  GuardrailCalibration,
  DEFAULT_MONTE_CARLO_CONFIG,
} from './types';

// ── Simulated Solver ──
// In production, this would call the real OR-Tools solver.
// Here we simulate solver behavior based on constraint analysis.

interface SolverInput {
  family_structure: string;
  children_ages: number[];
  template: string;
  target_split: number;
  distance_miles: number;
  locked_nights: Array<{ parent: string; days: number[] }>;
  events: GeneratedEvent[];
  horizon_weeks: number;
  constraints: string[];
}

interface SolverOutput {
  feasible: boolean;
  fairness_deviation: number;
  transition_count: number;
  schedule_changes: number;
  stability_score: number;
  compensation_balance: number;
  solve_time_ms: number;
  relaxations_needed: string[];
  unhandled_events: GeneratedEvent[];
}

function simulateSolver(input: SolverInput): SolverOutput {
  const start = performance.now();

  // Base difficulty from constraints
  let difficulty = 0;
  const relaxations: string[] = [];
  const unhandled: GeneratedEvent[] = [];

  // Distance increases difficulty
  if (input.distance_miles > 30) difficulty += 0.15;
  if (input.distance_miles > 50) difficulty += 0.2;

  // Locked nights reduce flexibility
  const totalLocked = input.locked_nights.reduce((s, ln) => s + ln.days.length, 0);
  difficulty += totalLocked * 0.04;

  // Strict split increases difficulty
  if (input.target_split !== 50) {
    difficulty += Math.abs(input.target_split - 50) * 0.003;
  }

  // Multiple children increase complexity
  if (input.children_ages.length > 1) difficulty += 0.05;
  if (input.children_ages.length > 2) difficulty += 0.1;

  // Young children are more constrained
  if (input.children_ages.some(a => a < 3)) difficulty += 0.1;

  // Process events
  let fairnessDrift = 0;
  let transitionIncrease = 0;
  let scheduleChanges = 0;

  for (const event of input.events) {
    switch (event.category) {
      case 'health':
        if (event.duration >= 3) {
          fairnessDrift += 1.5 + Math.random() * 2;
          scheduleChanges += event.duration;
        } else {
          fairnessDrift += 0.5 + Math.random();
          scheduleChanges += 1;
        }
        break;

      case 'school':
        if (event.type === 'camp_week') {
          scheduleChanges += 5;
          fairnessDrift += 2 + Math.random() * 3;
          transitionIncrease += 2;
        } else {
          scheduleChanges += 1;
          fairnessDrift += 0.5;
        }
        break;

      case 'work':
        fairnessDrift += 1 + Math.random() * 2;
        scheduleChanges += event.duration || 1;
        transitionIncrease += 1;
        break;

      case 'logistics':
        // Logistics events don't change schedule, but stress the system
        if (event.type === 'transport_failure') {
          scheduleChanges += 1;
          fairnessDrift += 0.5;
        }
        break;

      case 'travel':
        fairnessDrift += 2 + Math.random() * 4;
        scheduleChanges += event.duration || 3;
        transitionIncrease += 2;
        if (event.duration >= 5) difficulty += 0.15;
        break;

      case 'holiday':
        fairnessDrift += 1 + Math.random() * 2;
        scheduleChanges += 1;
        if (event.type === 'holiday_extension_request') {
          difficulty += 0.1;
          fairnessDrift += 2;
        }
        break;

      case 'conflict':
        difficulty += 0.05;
        if (event.type === 'extra_time_request') fairnessDrift += 1;
        break;
    }

    // Check for compound events (same week)
    const sameWeekEvents = input.events.filter(
      e => Math.floor(e.day / 7) === Math.floor(event.day / 7) && e !== event
    );
    if (sameWeekEvents.length >= 2) {
      difficulty += 0.15;
    }

    // Check for policy coverage
    const coveredTypes = new Set([
      'child_sick', 'school_closed', 'work_emergency', 'late_pickup',
      'parent_travel', 'holiday', 'schedule_swap_request',
    ]);
    if (!coveredTypes.has(event.type)) {
      unhandled.push(event);
    }
  }

  // Constraint checking
  for (const constraint of input.constraints) {
    if (constraint === 'max_transitions_2' && transitionIncrease > 2) {
      difficulty += 0.2;
      relaxations.push('max_transitions');
    }
    if (constraint === 'strict_fairness' && fairnessDrift > 5) {
      difficulty += 0.15;
      relaxations.push('fairness_tolerance');
    }
    if (constraint === 'no_split_weekends' && scheduleChanges > 3) {
      difficulty += 0.1;
      relaxations.push('weekend_integrity');
    }
    if (constraint === 'sibling_cohesion' && input.children_ages.length > 1) {
      difficulty += 0.08;
    }
  }

  // Determine feasibility
  const feasible = difficulty < 0.7 || (difficulty < 0.9 && Math.random() > 0.5);
  const degraded = !feasible && difficulty < 1.0;

  if (!feasible && !degraded) {
    relaxations.push('schedule_relaxation');
  }

  // Calculate final metrics
  const baseTransitions = input.template === 'alternating_weeks' ? 1 :
    input.template === '2-2-3' ? 3 :
    input.template === '3-4-4-3' ? 2 :
    input.template === '5-2' ? 2 : 2;

  const weeklyTransitions = baseTransitions + (transitionIncrease / input.horizon_weeks);
  const stabilityScore = Math.max(0, Math.min(1,
    1 - (scheduleChanges / (input.horizon_weeks * 7)) - difficulty * 0.3
  ));

  const solveTime = performance.now() - start;

  return {
    feasible: feasible || degraded,
    fairness_deviation: Math.round(fairnessDrift * 10) / 10,
    transition_count: Math.round(weeklyTransitions * 10) / 10,
    schedule_changes: scheduleChanges,
    stability_score: Math.round(stabilityScore * 1000) / 1000,
    compensation_balance: Math.round(fairnessDrift * 0.7 * 10) / 10,
    solve_time_ms: Math.round(solveTime * 100) / 100,
    relaxations_needed: relaxations,
    unhandled_events: unhandled,
  };
}

// ── Monte Carlo Runner ──

export interface MonteCarloProgress {
  completed: number;
  total: number;
  currentFamily: string;
}

export function runMonteCarlo(
  config: MonteCarloConfig = DEFAULT_MONTE_CARLO_CONFIG,
  onProgress?: (p: MonteCarloProgress) => void,
): MonteCarloSummary {
  const startTime = performance.now();
  const simId = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Resolve families to test
  const families = config.family_structures.length > 0
    ? FAMILY_STRUCTURES.filter(f => config.family_structures.includes(f.id))
    : FAMILY_STRUCTURES;

  // Resolve templates
  const templates = config.templates.length > 0
    ? config.templates
    : TEMPLATE_OPTIONS.filter(t => t.value !== 'custom').map(t => t.value);

  // Default constraints
  const constraints = config.constraints_to_test.length > 0
    ? config.constraints_to_test
    : ['max_transitions_2', 'strict_fairness', 'no_split_weekends', 'sibling_cohesion'];

  // Collect all run metrics
  const allMetrics: SolverRunMetrics[] = [];
  const allConflicts: ConstraintConflict[] = [];
  const policyGapMap = new Map<string, PolicyGap>();
  const failureMap = new Map<string, FailurePattern>();
  const disruptionSequences: string[][] = [];

  for (let run = 0; run < config.runs; run++) {
    // Random family
    const family = families[Math.floor(Math.random() * families.length)];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const targetSplit = family.targetSplit;
    const distance = family.distanceMiles + Math.floor(Math.random() * 20) - 10;

    // Random start week for seasonal variation
    const startWeek = Math.floor(Math.random() * 52) + 1;

    // Generate events using stress model
    const events = config.disruption_model === 'realistic'
      ? generateEvents({
          horizon_weeks: config.horizon_weeks,
          children_ages: family.children.map(c => c.age),
          start_week_of_year: startWeek,
          distance_miles: Math.max(1, distance),
        })
      : generateUniformEvents(config.horizon_weeks);

    // Random subset of constraints
    const activeConstraints = constraints.filter(() => Math.random() > 0.3);

    // Run solver
    const result = simulateSolver({
      family_structure: family.id,
      children_ages: family.children.map(c => c.age),
      template,
      target_split: targetSplit,
      distance_miles: Math.max(1, distance),
      locked_nights: [],
      events,
      horizon_weeks: config.horizon_weeks,
      constraints: activeConstraints,
    });

    // Record metrics
    const metrics: SolverRunMetrics = {
      scenario_id: `${simId}_run_${run}`,
      family_structure: family.id,
      constraint_set: activeConstraints,
      fairness_deviation: result.fairness_deviation,
      transition_count: result.transition_count,
      schedule_change_magnitude: result.schedule_changes,
      routine_stability_score: result.stability_score,
      compensation_balance: result.compensation_balance,
      solve_time_ms: result.solve_time_ms,
      feasible: result.feasible,
    };
    allMetrics.push(metrics);

    // Record constraint conflicts
    if (result.relaxations_needed.length > 0) {
      allConflicts.push({
        scenario_id: metrics.scenario_id,
        constraints_active: activeConstraints,
        event_sequence: events.map(e => e.type),
        solver_failure_reason: result.relaxations_needed.join(', '),
        minimal_relaxation_required: result.relaxations_needed,
        severity: result.feasible ? 'degraded' : 'infeasible',
      });
    }

    // Record policy gaps
    for (const unhandled of result.unhandled_events) {
      const key = `${unhandled.type}_${family.id}`;
      const existing = policyGapMap.get(key);
      if (existing) {
        existing.occurrence_count++;
      } else {
        policyGapMap.set(key, {
          event_sequence: [unhandled.type],
          family_type: family.id,
          solver_response: 'no_policy',
          manual_resolution: 'Requires manual intervention',
          recommended_policy: `Add default handling for ${unhandled.type}`,
          occurrence_count: 1,
        });
      }
    }

    // Record failure patterns
    if (!result.feasible || result.relaxations_needed.length > 0) {
      const eventSeq = events.map(e => e.type).sort().join(',');
      const key = `${family.id}_${eventSeq}`;
      const existing = failureMap.get(key);
      if (existing) {
        existing.occurrence_count++;
      } else {
        failureMap.set(key, {
          family_structure: family.id,
          constraints: activeConstraints,
          event_sequence: events.map(e => e.type),
          solver_result: result.feasible ? 'degraded' : 'infeasible',
          recommended_constraint_relaxation: result.relaxations_needed,
          occurrence_count: 1,
          first_seen: new Date().toISOString(),
        });
      }
    }

    // Track disruption sequences
    if (events.length > 0) {
      disruptionSequences.push(events.map(e => e.type));
    }

    // Progress callback
    if (onProgress && run % 100 === 0) {
      onProgress({ completed: run, total: config.runs, currentFamily: family.id });
    }
  }

  // ── Aggregate Results ──

  const fairnessValues = allMetrics.map(m => m.fairness_deviation).sort((a, b) => a - b);
  const transitionValues = allMetrics.map(m => m.transition_count).sort((a, b) => a - b);
  const stabilityValues = allMetrics.map(m => m.routine_stability_score);

  const percentile = (sorted: number[], p: number) =>
    sorted[Math.floor(sorted.length * p / 100)] || 0;

  const mean = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

  const infeasibleCount = allMetrics.filter(m => !m.feasible).length;
  const degradedCount = allConflicts.filter(c => c.severity === 'degraded').length;

  // Most common disruption sequence
  const seqCounts = new Map<string, number>();
  for (const seq of disruptionSequences) {
    const key = seq.join(' → ');
    seqCounts.set(key, (seqCounts.get(key) || 0) + 1);
  }
  const topSeq = [...seqCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Most frequent policy gap
  const topGap = [...policyGapMap.values()].sort((a, b) => b.occurrence_count - a.occurrence_count)[0];

  // Top failure patterns (top 10)
  const topFailures = [...failureMap.values()]
    .sort((a, b) => b.occurrence_count - a.occurrence_count)
    .slice(0, 10);

  const summary: MonteCarloSummary = {
    simulation_id: simId,
    runs: config.runs,
    duration_ms: Math.round(performance.now() - startTime),
    timestamp: new Date().toISOString(),

    mean_fairness_drift: Math.round(mean(fairnessValues) * 100) / 100,
    median_fairness_drift: Math.round(percentile(fairnessValues, 50) * 100) / 100,
    p95_fairness_drift: Math.round(percentile(fairnessValues, 95) * 100) / 100,
    max_fairness_drift: Math.round(Math.max(...fairnessValues) * 100) / 100,

    mean_transitions: Math.round(mean(transitionValues) * 100) / 100,
    p95_transitions: Math.round(percentile(transitionValues, 95) * 100) / 100,
    max_transitions: Math.round(Math.max(...transitionValues) * 100) / 100,

    mean_stability_score: Math.round(mean(stabilityValues) * 1000) / 1000,
    schedule_change_frequency: Math.round(mean(allMetrics.map(m => m.schedule_change_magnitude)) * 100) / 100,

    conflict_rate: Math.round((allConflicts.length / config.runs) * 10000) / 100,
    solver_infeasible_rate: Math.round((infeasibleCount / config.runs) * 10000) / 100,
    degraded_solution_rate: Math.round((degradedCount / config.runs) * 10000) / 100,

    most_common_disruption_sequence: topSeq ? topSeq[0].split(' → ') : [],
    most_frequent_policy_gap: topGap?.recommended_policy || null,
    top_failure_patterns: topFailures,
    constraint_conflicts: allConflicts.slice(0, 50), // cap for storage
    policy_gaps: [...policyGapMap.values()].sort((a, b) => b.occurrence_count - a.occurrence_count),
  };

  return summary;
}

// ── Guardrail Sweep ──

export function sweepGuardrail(
  parameter: string,
  values: number[],
  baseConfig: MonteCarloConfig,
): GuardrailCalibration {
  const infeasibleRates: number[] = [];
  const stabilityScores: number[] = [];

  for (const value of values) {
    const config = {
      ...baseConfig,
      runs: Math.min(baseConfig.runs, 500), // fewer runs per value
      constraints_to_test: [`${parameter}_${value}`],
    };
    const summary = runMonteCarlo(config);
    infeasibleRates.push(summary.solver_infeasible_rate);
    stabilityScores.push(summary.mean_stability_score);
  }

  // Find the sweet spot: highest stability with < 5% infeasible
  let bestIdx = 0;
  for (let i = 0; i < values.length; i++) {
    if (infeasibleRates[i] < 5 && stabilityScores[i] > stabilityScores[bestIdx]) {
      bestIdx = i;
    }
  }

  // Recommended range: all values with < 10% infeasible
  const viableIdxs = values.map((_, i) => i).filter(i => infeasibleRates[i] < 10);
  const rangeMin = viableIdxs.length > 0 ? values[viableIdxs[0]] : values[0];
  const rangeMax = viableIdxs.length > 0 ? values[viableIdxs[viableIdxs.length - 1]] : values[values.length - 1];

  return {
    parameter,
    tested_values: values,
    infeasible_rates: infeasibleRates,
    stability_scores: stabilityScores,
    recommended_value: values[bestIdx],
    recommended_range: [rangeMin, rangeMax],
  };
}

// ── Uniform Random Events (baseline comparison) ──

function generateUniformEvents(horizonWeeks: number): GeneratedEvent[] {
  const events: GeneratedEvent[] = [];
  const types = ['child_sick', 'school_closed', 'work_emergency', 'late_pickup',
    'parent_travel', 'vacation_request', 'holiday', 'transport_failure'];
  const totalDays = horizonWeeks * 7;

  // ~2 events per week on average
  const eventCount = Math.floor(horizonWeeks * 2 * (0.5 + Math.random()));
  for (let i = 0; i < eventCount; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    events.push({
      type,
      category: 'mixed',
      day: Math.floor(Math.random() * totalDays),
      duration: Math.floor(Math.random() * 3),
      parent: Math.random() < 0.5 ? 'parent_a' : 'parent_b',
      description: `Uniform random: ${type}`,
    });
  }

  return events.sort((a, b) => a.day - b.day);
}

// ── Regression Test Generator ──

export function generateRegressionTests(summary: MonteCarloSummary): Array<{
  test_id: string;
  name: string;
  family_structure: string;
  event_sequence: string[];
  constraints: string[];
  expected_feasible: boolean;
  expected_max_fairness: number;
}> {
  return summary.top_failure_patterns.map((fp, i) => ({
    test_id: `reg_${summary.simulation_id}_${i}`,
    name: `${fp.family_structure}: ${fp.event_sequence.slice(0, 3).join(' + ')}`,
    family_structure: fp.family_structure,
    event_sequence: fp.event_sequence,
    constraints: fp.constraints,
    expected_feasible: fp.solver_result !== 'infeasible',
    expected_max_fairness: 10, // threshold to verify
  }));
}
