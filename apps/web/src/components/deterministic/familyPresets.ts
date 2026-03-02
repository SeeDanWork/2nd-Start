// ─── Family Description Presets ──────────────────────────────────────
//
// 12 realistic family scenarios designed to test scoring variance across
// age bands, arrangements, goal combinations, distances, exchange
// preferences, constraints, and multi-child aggregation.

export interface FamilyPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  familyText: string;
}

export const FAMILY_PRESETS: FamilyPreset[] = [
  // ─── Infants & Toddlers ───────────────────────────────────────────

  {
    id: 'fp-newborn-shared',
    name: 'Newborn (6mo, shared, close)',
    category: 'Infants & Toddlers',
    description: 'Young infant in shared custody. Tests infant hard floor — should block 7on7off and 2week_blocks, favor short-cycle templates like 223_daytime.',
    familyText: `6 month old
shared arrangement
stability goals
daycare anchor
10 minutes apart
prefer anchor exchange`,
  },

  {
    id: 'fp-toddler-primary-far',
    name: 'Toddler (2yo, primary, far)',
    category: 'Infants & Toddlers',
    description: 'Toddler in primary custody, long commute. Tests young_child age band + primary arrangement + distance logistics penalty.',
    familyText: `child born 2024-03-15
primary arrangement
minimize separation
daycare anchor
45 minutes apart
in person exchange`,
  },

  // ─── School Age ───────────────────────────────────────────────────

  {
    id: 'fp-preschool-undecided',
    name: 'Preschooler (4yo, undecided)',
    category: 'School Age',
    description: 'Parents undecided on arrangement. Tests undecided weight multipliers (neutral) with young school-age child.',
    familyText: `child born 2022-01-20
undecided arrangement
stability and fairness goals
daycare anchor
20 minutes apart`,
  },

  {
    id: 'fp-school-equal-split',
    name: 'School-age (7yo, 50/50 fairness)',
    category: 'School Age',
    description: 'Cooperative parents wanting strict equal time. Tests fairness goal boosting, should favor 7on7off or alternating_weeks.',
    familyText: `child born 2019-06-10
shared arrangement
50/50 fairness goals
school anchor
15 minutes apart
prefer anchor exchange`,
  },

  {
    id: 'fp-preteen-long-distance',
    name: 'Preteen (11yo, far apart)',
    category: 'School Age',
    description: 'Older school-age child with long commute. Tests school-age band + high distance penalty on logistics scoring.',
    familyText: `child born 2015-09-01
shared arrangement
stability goals
school anchor
55 minutes apart
in person exchange`,
  },

  // ─── Teens ────────────────────────────────────────────────────────

  {
    id: 'fp-teen-minimal-handoffs',
    name: 'Teen (15yo, minimize separation)',
    category: 'Teens',
    description: 'Teenager who dislikes frequent transitions. Tests teen age band — should strongly prefer long-block templates (2week_blocks, 7on7off).',
    familyText: `child born 2011-04-22
shared arrangement
minimize separation
school anchor
35 minutes apart
in person exchange`,
  },

  // ─── Multi-Child ──────────────────────────────────────────────────

  {
    id: 'fp-siblings-same-band',
    name: 'Siblings (5 & 8, school-age pair)',
    category: 'Multi-Child',
    description: 'Two school-age kids, same age band. Tests multi-child scoring where youngest_child_rules applies consistently.',
    familyText: `kids ages 5 and 8
shared arrangement
stability and fairness goals
school anchor
20 minutes apart
prefer anchor exchange`,
  },

  {
    id: 'fp-infant-plus-school',
    name: 'Infant + school-age (1 & 9)',
    category: 'Multi-Child',
    description: 'Infant and school-age sibling — very different needs. Tests youngest_child_rules: infant floor should dominate, blocking long blocks.',
    familyText: `kids ages 1 and 9
shared arrangement
stability goals
school anchor
15 minutes apart
prefer anchor exchange`,
  },

  {
    id: 'fp-three-kids-all-bands',
    name: 'Three kids (3, 8, 15)',
    category: 'Multi-Child',
    description: 'Children spanning toddler, school-age, and teen bands. Tests weighted multi-child aggregation and hard constraint floors.',
    familyText: `kids ages 3, 8, and 15
shared arrangement
stability and fairness goals
school anchor
25 minutes apart`,
  },

  // ─── Constraints ──────────────────────────────────────────────────

  {
    id: 'fp-shift-work',
    name: 'Shift worker (6yo, no in-person)',
    category: 'Constraints',
    description: 'One parent does shift work, no in-person handoffs possible. Tests constraint scoring component and exchange preference penalty.',
    familyText: `child born 2020-05-10
shared arrangement
stability goals
school anchor
40 minutes apart
shift work
no in-person exchange`,
  },

  {
    id: 'fp-locked-nights-conflict',
    name: 'Locked nights conflict (8yo)',
    category: 'Constraints',
    description: 'Both parents lock one night each — potential conflict. Tests constraint handling and locked nights deduction in template scoring.',
    familyText: `child born 2018-08-30
shared arrangement
stability goals
school anchor
15 minutes apart
father 1 locked nights
mother 1 locked nights
prefer anchor exchange`,
  },

  {
    id: 'fp-very-close-cooperative',
    name: 'Very close (5yo, 5min, equal)',
    category: 'Constraints',
    description: 'Parents live 5 minutes apart — near-zero logistics cost. Tests that distance advantage boosts frequent-transition templates like 2-2-3.',
    familyText: `child born 2021-07-15
shared arrangement
equal fairness goals
school anchor
5 minutes apart
prefer anchor exchange`,
  },
];

export const FAMILY_PRESET_CATEGORIES = [...new Set(FAMILY_PRESETS.map((p) => p.category))];
