// ─── Curated Scenario Presets ─────────────────────────────────────────
//
// Pre-filled family descriptions and disruption scenarios for the
// deterministic model tester. Inspired by simulator scenarios #5, #6,
// #21, #23, #28, #30 plus additional coverage of the V2 pipeline.

export interface Preset {
  id: string;
  name: string;
  category: string;
  description: string;
  familyText: string;
  disruptionText: string;
}

export const PRESETS: Preset[] = [
  // ─── From Simulator #21: Child Illness Same-Day ──────────────────
  {
    id: 'sim-21-child-illness',
    name: '#21 Child Illness (same-day)',
    category: 'Emergencies',
    description: 'School-age child falls sick. Tests CHILD_SICK overlay → DELAY_EXCHANGE action.',
    familyText: `child born 2018-06-15
shared arrangement
stability goals
school anchor
15 minutes apart
prefer anchor exchange`,
    disruptionText: `child sick 2026-03-10`,
  },

  // ─── From Simulator #23: Parent Emergency ────────────────────────
  {
    id: 'sim-23-parent-emergency',
    name: '#23 Parent Emergency (7-day)',
    category: 'Emergencies',
    description: 'Parent medical emergency, 7-day disruption. Tests CAREGIVER_SICK → GENERATE_PROPOSALS (>72h) + fairness weight adjustments.',
    familyText: `child born 2018-06-15
shared arrangement
stability and fairness goals
school anchor
20 minutes apart`,
    disruptionText: `caregiver sick 2026-03-01 7 days`,
  },

  // ─── From Simulator #28: Holiday Rule Selection ──────────────────
  {
    id: 'sim-28-holiday',
    name: '#28 Holiday (Thanksgiving)',
    category: 'Holidays',
    description: 'Public holiday overlay. Tests Rule C school-night sensitivity + LOGISTICS_FALLBACK action.',
    familyText: `child born 2019-03-20
shared arrangement
fairness goals
school anchor
25 minutes apart
prefer anchor exchange`,
    disruptionText: `holiday 2026-11-26`,
  },

  // ─── From Simulator #30: Vacation Block ──────────────────────────
  {
    id: 'sim-30-vacation',
    name: '#30 Vacation Block (7-day)',
    category: 'Holidays',
    description: 'Week-long vacation/break. Tests BREAK overlay with long-disruption fairness path.',
    familyText: `child born 2017-09-01
shared arrangement
fairness and stability goals
school anchor
20 minutes apart`,
    disruptionText: `break 2026-06-15 7 days`,
  },

  // ─── From Simulator #5: Conflicting Constraints ──────────────────
  {
    id: 'sim-5-conflict',
    name: '#5 Conflicting Constraints',
    category: 'Onboarding',
    description: 'Both parents lock the same night. Tests constraint handling in template scoring.',
    familyText: `child born 2018-04-10
shared arrangement
stability goals
school anchor
15 minutes apart
father 1 locked nights
mother 1 locked nights`,
    disruptionText: '',
  },

  // ─── Infant Shared Custody ──────────────────────────────────────
  {
    id: 'infant-shared',
    name: 'Infant (shared, close)',
    category: 'Age Bands',
    description: 'Young infant in shared custody. Tests infant weight profile, high transition penalty, 223_daytime template preference.',
    familyText: `8 month old
shared arrangement
stability goals
daycare anchor
10 minutes apart
prefer anchor exchange`,
    disruptionText: '',
  },

  // ─── Teen Long Distance ─────────────────────────────────────────
  {
    id: 'teen-long-distance',
    name: 'Teen (primary, far apart)',
    category: 'Age Bands',
    description: 'Teenager in primary custody, long commute. Tests teen weight profile, 7on7off / 2week_blocks preference.',
    familyText: `child born 2010-02-14
primary arrangement
minimize separation
50 minutes apart
in person exchange`,
    disruptionText: '',
  },

  // ─── Multi-Child Mixed Ages ─────────────────────────────────────
  {
    id: 'multi-child-mixed',
    name: 'Multi-Child (infant + school-age)',
    category: 'Multi-Child',
    description: 'Two children with very different age bands. Tests multi-child scoring, youngest_child_rules aggregation, fairness capping.',
    familyText: `kids ages 1 and 8
shared arrangement
stability and fairness goals
school anchor
20 minutes apart
prefer anchor exchange`,
    disruptionText: '',
  },

  // ─── Multi-Child Three Kids ─────────────────────────────────────
  {
    id: 'multi-child-three',
    name: 'Multi-Child (3 kids: toddler, school, teen)',
    category: 'Multi-Child',
    description: 'Three children spanning all age groups. Tests weighted aggregation, meta-groups, hard constraint floors.',
    familyText: `kids ages 2, 7, and 14
shared arrangement
stability and fairness goals
school anchor
25 minutes apart`,
    disruptionText: '',
  },

  // ─── Multi-Disruption Stack ─────────────────────────────────────
  {
    id: 'multi-disruption',
    name: 'Multi-Disruption Stack',
    category: 'Disruptions',
    description: 'Multiple overlapping disruptions. Tests overlay merging, multiplicative weight adjustments, lock conflicts.',
    familyText: `kids ages 5 and 9
shared arrangement
stability goals
school anchor
15 minutes apart`,
    disruptionText: `child sick 2026-03-10 3 days
school closed 2026-03-11
father travel 2026-03-14 5 days`,
  },

  // ─── Summer + Camp ──────────────────────────────────────────────
  {
    id: 'summer-camp',
    name: 'Summer Period + Camp Week',
    category: 'Disruptions',
    description: 'Long summer period with embedded camp week. Tests SUMMER_PERIOD and CAMP_WEEK overlays.',
    familyText: `child born 2016-08-20
shared arrangement
fairness goals
school anchor
30 minutes apart`,
    disruptionText: `summer 2026-06-15 60 days
camp 2026-07-06 7 days`,
  },

  // ─── Shift Work Parent ──────────────────────────────────────────
  {
    id: 'shift-work',
    name: 'Shift Work Parent',
    category: 'Constraints',
    description: 'One parent does shift work with no in-person exchange. Tests constraint scoring component.',
    familyText: `child born 2020-11-05
shared arrangement
stability goals
daycare anchor
35 minutes apart
shift work
no in-person exchange`,
    disruptionText: '',
  },

  // ─── Undecided Arrangement ──────────────────────────────────────
  {
    id: 'undecided',
    name: 'Undecided Arrangement',
    category: 'Onboarding',
    description: 'Parents undecided on arrangement. Tests undecided weight multipliers (neutral).',
    familyText: `child born 2019-07-22
undecided arrangement
minimize separation
20 minutes apart`,
    disruptionText: '',
  },

  // ─── Transport Failure ──────────────────────────────────────────
  {
    id: 'transport-failure',
    name: 'Transport Failure',
    category: 'Disruptions',
    description: 'Car breakdown on exchange day. Tests TRANSPORT_FAILURE overlay → logistics fallback.',
    familyText: `child born 2017-03-15
shared arrangement
stability goals
school anchor
40 minutes apart
in person exchange`,
    disruptionText: `transport failure 2026-03-15`,
  },

  // ─── Emergency Closure + Holiday Combo ──────────────────────────
  {
    id: 'emergency-holiday',
    name: 'Emergency Closure + Holiday',
    category: 'Disruptions',
    description: 'School emergency closure day before a public holiday. Tests Rule C sensitivity stacking.',
    familyText: `kids ages 6 and 10
shared arrangement
stability and fairness goals
school anchor
15 minutes apart`,
    disruptionText: `emergency closure 2026-11-25
holiday 2026-11-26`,
  },

  // ─── Three-Mode Testing ──────────────────────────────────────────

  {
    id: 'three-mode-equal',
    name: 'Three-Mode: Equal Split Family',
    category: 'Three-Mode',
    description: 'Cooperative parents wanting 50/50 split. Apply preferences with default sliders to compare evidence vs parent vision vs balanced modes.',
    familyText: `child born 2019-05-15
shared arrangement
stability and fairness goals
school anchor
15 minutes apart
prefer anchor exchange`,
    disruptionText: '',
  },
  {
    id: 'three-mode-primary-preference',
    name: 'Three-Mode: Primary with Weekend Pref',
    category: 'Three-Mode',
    description: 'Parent A wants 70% time, few handoffs, alternating weekends. Shows divergence between evidence (age-driven) and parent vision (preference-driven) modes.',
    familyText: `child born 2020-08-10
shared arrangement
stability goals
daycare anchor
25 minutes apart`,
    disruptionText: '',
  },
  {
    id: 'three-mode-teen-blocks',
    name: 'Three-Mode: Teen Prefers Long Blocks',
    category: 'Three-Mode',
    description: 'Teen where parent picks 2-week blocks. Evidence may prefer alternating weeks, parent vision should push 2-week blocks high.',
    familyText: `child born 2011-03-01
shared arrangement
fairness goals
school anchor
45 minutes apart`,
    disruptionText: '',
  },
];

export const PRESET_CATEGORIES = [...new Set(PRESETS.map((p) => p.category))];
