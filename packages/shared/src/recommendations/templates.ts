// ─── V2 Template Catalog ──────────────────────────────────────────
//
// Evidence-based schedule templates derived from:
// - AFCC (Association of Family and Conciliation Courts) guidelines
// - Arizona, Indiana, and Washington state model parenting plans
// - Kelly & Lamb (2000) child development research
// - Warshak (2014) 110-expert consensus report
// - Emery's age×divorce-style framework
//
// Each template has a concrete repeating pattern array (variable length)
// and static metadata for scoring and explanation.

// ─── Types ────────────────────────────────────────────────────────

export type TemplateId =
  | '223'
  | '223_daytime'
  | '3443'
  | '43'
  | '2255'
  | '7on7off'
  | '7on7off_midweek'
  | '52_weekday_weekend'
  | 'alt_weekends_midweek'
  | 'primary_plus_midweek'
  | '2week_blocks'
  | 'primary_weekends'
  | 'every_other_weekend';

export interface TemplateDefV2 {
  id: TemplateId;
  name: string;
  /** Repeating pattern array: 0 = parentA, 1 = parentB. Length varies by cycle. */
  pattern14: (0 | 1)[];
  handoffsPer2Weeks: number;
  maxBlockA: number;
  maxBlockB: number;
  /** Max of maxBlockA and maxBlockB */
  maxBlock: number;
  nightsA: number;
  nightsB: number;
  schoolAligned: boolean;
  /** Minimum recommended age in months (from developmental research) */
  minAgeMonths: number;
  /** Split ratio description (e.g., "50/50", "70/30") */
  splitRatio: string;
  /** Evidence source for this pattern */
  evidenceBasis: string;
  suggestedWhenBase: string[];
  tradeoffsBase: string[];
}

// ─── Template Definitions ─────────────────────────────────────────

// Pattern helper: A=0, B=1
const A = 0 as const;
const B = 1 as const;

export const TEMPLATES_V2: TemplateDefV2[] = [
  // ── 50/50 Equal-Time Templates ─────────────────────────────────

  {
    id: '223',
    name: '2-2-3 Rotation',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, B, B, A, A, A, B, B, A, A, B, B, B],
    handoffsPer2Weeks: 6,
    maxBlockA: 3,
    maxBlockB: 3,
    maxBlock: 3,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    minAgeMonths: 18,
    splitRatio: '50/50',
    evidenceBasis: 'Kelly & Lamb (2000): frequent contact with both parents benefits toddlers. Emery recommends for cooperative divorces with children 18mo+. Arizona Plan 10.',
    suggestedWhenBase: [
      'Recommended for toddlers and preschoolers who benefit from frequent contact with both parents (Kelly & Lamb 2000)',
      'Works well when parents live close and cooperate on transitions',
      'Maximum 3-night separation keeps young children connected to both homes',
    ],
    tradeoffsBase: [
      'Frequent transitions (6 per 2 weeks) require high cooperation',
      'Can be tiring for school-age children who prefer routine stability',
      'Each parent\'s days shift week to week — no fixed "my day"',
    ],
  },
  {
    id: '223_daytime',
    name: 'Daytime Contact Only',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, B, B, A, A, A, B, B, A, A, B, B, B],
    handoffsPer2Weeks: 6,
    maxBlockA: 3,
    maxBlockB: 3,
    maxBlock: 3,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    minAgeMonths: 0,
    splitRatio: 'daytime',
    evidenceBasis: 'Indiana Guidelines (0-4mo): 3 non-consecutive 2-hour visits/week. Conservative position per Kelly: no overnights under 12mo unless shared overnight care since birth.',
    suggestedWhenBase: [
      'For infants 0-12 months following conservative attachment guidelines (Indiana Guidelines)',
      'Daytime-only contact with non-primary parent, building toward overnights',
      'Recommended when overnight care has not been shared from birth',
    ],
    tradeoffsBase: [
      'Not a true overnight split — one parent handles all nights',
      'Progressive research (Warshak 110-expert consensus) suggests overnights are safe even for infants',
      'Will require transition to overnight schedule as child develops',
    ],
  },
  {
    id: '3443',
    name: '3-4-4-3 Rotation',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, A, B, B, B, B, A, A, A, A, B, B, B],
    handoffsPer2Weeks: 4,
    maxBlockA: 4,
    maxBlockB: 4,
    maxBlock: 4,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: true,
    minAgeMonths: 36,
    splitRatio: '50/50',
    evidenceBasis: 'Indiana Guidelines (age 3+): common equal-time pattern. Arizona Plan 12. Emery recommends for cooperative/distant divorces with preschoolers.',
    suggestedWhenBase: [
      'Balanced time with moderate transitions — recommended for preschool and school-age (Emery)',
      'Mid-week exchanges align naturally with school/daycare handoffs',
      'Each parent gets both weekday and weekend time within each cycle',
    ],
    tradeoffsBase: [
      '4-day blocks may feel long for children under 3 (Kelly & Lamb)',
      'Mid-week transitions require coordination if no school/daycare anchor',
      'Rotating schedule means days shift — no fixed weekly pattern',
    ],
  },
  {
    id: '43',
    name: '4-3 Rotation',
    //        Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, A, A, B, B, B],
    handoffsPer2Weeks: 2,
    maxBlockA: 4,
    maxBlockB: 3,
    maxBlock: 4,
    nightsA: 4,
    nightsB: 3,
    schoolAligned: true,
    minAgeMonths: 36,
    splitRatio: '57/43',
    evidenceBasis: 'Commonly recommended in state guidelines for ages 3+. Arizona Plans. Fixed weekly pattern provides routine predictability valued in developmental research.',
    suggestedWhenBase: [
      'Fixed weekly pattern — same days every week, highly predictable for children',
      'One parent has Mon-Thu (school week), the other Fri-Sun (weekends)',
      'Good for preschool+ when one parent has more weekday availability',
    ],
    tradeoffsBase: [
      'Not a 50/50 split (57/43) — one parent consistently gets more nights',
      'Weekend parent may miss weekday school involvement',
      'Less flexibility than rotating schedules',
    ],
  },
  {
    id: '2255',
    name: '2-2-5-5 Split',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, B, B, A, A, A, A, A, B, B, B, B, B],
    handoffsPer2Weeks: 4,
    maxBlockA: 5,
    maxBlockB: 5,
    maxBlock: 5,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    minAgeMonths: 60,
    splitRatio: '50/50',
    evidenceBasis: 'Common 50/50 pattern in state guidelines for school-age children. Arizona, Washington. Fixed weekday assignment (Mon/Tue always A, Wed/Thu always B) with alternating weekends.',
    suggestedWhenBase: [
      'Fixed weekday assignment with alternating weekends — partially predictable',
      'Each parent always has the same 2 weekdays, providing routine (school-age+)',
      'Equal time split with moderate block lengths',
    ],
    tradeoffsBase: [
      '5-day blocks can feel long for children under 5 (developmental guidelines)',
      'Uneven block lengths (2 then 5) within a cycle can feel inconsistent',
      'Alternating weekends mean no fixed "weekend parent"',
    ],
  },
  {
    id: '7on7off',
    name: 'Alternating Weeks',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, A, A, A, A, A, B, B, B, B, B, B, B],
    handoffsPer2Weeks: 2,
    maxBlockA: 7,
    maxBlockB: 7,
    maxBlock: 7,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    minAgeMonths: 72,
    splitRatio: '50/50',
    evidenceBasis: 'Most common equal-time schedule. Viable from age 5-6 per state guidelines, better at 8+ per developmental consensus. Emery recommends for cooperative divorces age 6+.',
    suggestedWhenBase: [
      'Simple, predictable pattern — easiest for children and parents to understand',
      'Fewest transitions (2 per 2 weeks) maximizes stability within each home',
      'Recommended for school-age children 8+ who can handle 7-day separations',
    ],
    tradeoffsBase: [
      '7-day separation is too long for most children under 6 (Kelly & Lamb)',
      'Child may miss the other parent significantly mid-week',
      'Consider adding midweek contact for children under 10 (see Alternating Weeks + Midweek)',
    ],
  },
  {
    id: '7on7off_midweek',
    name: 'Alternating Weeks + Midweek',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    // A's week with Wed overnight at B; B's week with Wed overnight at A
    pattern14: [A, A, B, A, A, A, A, B, B, A, B, B, B, B],
    handoffsPer2Weeks: 6,
    maxBlockA: 4,
    maxBlockB: 4,
    maxBlock: 4,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: true,
    minAgeMonths: 60,
    splitRatio: '50/50',
    evidenceBasis: 'Expert recommendation to reduce separation anxiety for younger school-age. Minnesota Child-Focused Guide. Emery recommends midweek contact when using week-on/week-off for ages 6-9.',
    suggestedWhenBase: [
      'Alternating weeks with a midweek overnight — reduces max separation to 4 days',
      'Recommended modification of week-on/week-off for children 5-9 (Emery, Minnesota Guide)',
      'Child sees each parent at least every 4 days, reducing separation anxiety',
    ],
    tradeoffsBase: [
      'More transitions than pure alternating weeks (6 vs 2 per 2 weeks)',
      'Midweek transition requires school-night logistics coordination',
      'May be unnecessarily complex for older children (10+) who handle 7-day blocks',
    ],
  },

  // ── Primary Custody Templates ──────────────────────────────────

  {
    id: '52_weekday_weekend',
    name: '5-2 Weekday/Weekend',
    //        Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, A, A, A, B, B],
    handoffsPer2Weeks: 2,
    maxBlockA: 5,
    maxBlockB: 2,
    maxBlock: 5,
    nightsA: 5,
    nightsB: 2,
    schoolAligned: true,
    minAgeMonths: 60,
    splitRatio: '71/29',
    evidenceBasis: 'Common primary custody arrangement in state guidelines. One parent handles school week, other has every weekend. Indiana, Arizona, Washington guidelines.',
    suggestedWhenBase: [
      'Fixed weekly routine — one parent always has school week, other always has weekends',
      'Works when one parent is primary caregiver during school/work days',
      'Simple and highly predictable for children',
    ],
    tradeoffsBase: [
      'Not equal time (71/29 split)',
      'Weekend parent misses all school-week involvement',
      'Weekday parent handles all homework, school routines, weekday activities',
    ],
  },
  {
    id: 'alt_weekends_midweek',
    name: 'Every Other Weekend + Midweek',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    // Week 1: all A except Wed overnight at B
    // Week 2: Wed overnight at B + Fri-Sat weekend at B
    pattern14: [A, A, B, A, A, A, A, A, A, B, A, B, B, A],
    handoffsPer2Weeks: 6,
    maxBlockA: 4,
    maxBlockB: 2,
    maxBlock: 4,
    nightsA: 10,
    nightsB: 4,
    schoolAligned: true,
    minAgeMonths: 36,
    splitRatio: '71/29',
    evidenceBasis: 'Most commonly court-ordered schedule pattern. Every other weekend + weekday overnight. Indiana Guidelines (age 3+). Emery recommends for distant/angry divorce styles.',
    suggestedWhenBase: [
      'The most commonly court-ordered schedule for primary custody (Indiana, Arizona)',
      'Non-residential parent stays involved via midweek overnight + alternate weekends',
      'Recommended by Emery for distant or high-conflict co-parenting relationships',
    ],
    tradeoffsBase: [
      'Not equal time (71/29 split)',
      'Non-residential parent may feel disconnected during off-weeks',
      'Multiple transitions per 2-week cycle despite unequal time',
    ],
  },
  {
    id: 'primary_plus_midweek',
    name: 'Primary + Midweek Dinner',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, B, A, A, A, B, A, A, B, A, A, A, B],
    handoffsPer2Weeks: 8,
    maxBlockA: 4,
    maxBlockB: 2,
    maxBlock: 4,
    nightsA: 10,
    nightsB: 4,
    schoolAligned: true,
    minAgeMonths: 36,
    splitRatio: '71/29',
    evidenceBasis: 'Common primary arrangement with frequent non-residential contact. Keeps non-primary parent involved in weekly routine. Emery framework for cooperative divorces.',
    suggestedWhenBase: [
      'Maximizes non-residential parent contact within a primary custody arrangement',
      'Twice-weekly contact prevents the child from going more than 2 days without each parent',
      'Works for cooperative co-parents who want primary structure with frequent contact',
    ],
    tradeoffsBase: [
      'Not equal time (71/29 split)',
      'High transition count (8 per 2 weeks) — requires close proximity',
      'Complex schedule may be hard for young children to track',
    ],
  },
  {
    id: 'every_other_weekend',
    name: 'Every Other Weekend',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    // Week 1: all A
    // Week 2: A weekdays, B weekend
    pattern14: [A, A, A, A, A, A, A, A, A, A, A, B, B, A],
    handoffsPer2Weeks: 2,
    maxBlockA: 11,
    maxBlockB: 2,
    maxBlock: 11,
    nightsA: 12,
    nightsB: 2,
    schoolAligned: false,
    minAgeMonths: 36,
    splitRatio: '86/14',
    evidenceBasis: 'Traditional minimum visitation schedule. Common court default. Research (Warshak, Emery) suggests this provides insufficient contact for maintaining strong relationships with both parents.',
    suggestedWhenBase: [
      'Court-standard minimum contact schedule',
      'When distance, work schedules, or safety concerns limit contact time',
      'Baseline that courts often order, with option to increase over time',
    ],
    tradeoffsBase: [
      'Research shows this may be insufficient for maintaining strong parent-child bonds (Warshak)',
      'Non-residential parent only sees child 4 days per month',
      '11-day separation between visits is too long for most children under 10',
      'Consider adding midweek contact to reduce separation gaps',
    ],
  },
  {
    id: 'primary_weekends',
    name: 'Primary + Every Weekend',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, A, A, A, B, B, A, A, A, A, A, B, B],
    handoffsPer2Weeks: 4,
    maxBlockA: 5,
    maxBlockB: 2,
    maxBlock: 5,
    nightsA: 10,
    nightsB: 4,
    schoolAligned: true,
    minAgeMonths: 60,
    splitRatio: '71/29',
    evidenceBasis: 'Common primary arrangement. Similar to 5-2 but with every weekend consistently with non-residential parent. State guidelines.',
    suggestedWhenBase: [
      'Consistent every-weekend contact with non-residential parent',
      'Primary parent handles all school-week routines',
      'Predictable — same pattern every week',
    ],
    tradeoffsBase: [
      'Not equal time (71/29 split)',
      'Weekend parent misses all weekday routines and school involvement',
      'Primary parent never gets a weekend — can lead to caregiver fatigue',
    ],
  },

  // ── Extended Block Templates ───────────────────────────────────

  {
    id: '2week_blocks',
    name: '2-Week Blocks',
    //        Week 1 (A)                          Week 2 (A)                          Week 3 (B)                          Week 4 (B)
    pattern14: [A, A, A, A, A, A, A, A, A, A, A, A, A, A, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
    handoffsPer2Weeks: 1,
    maxBlockA: 14,
    maxBlockB: 14,
    maxBlock: 14,
    nightsA: 14,
    nightsB: 14,
    schoolAligned: false,
    minAgeMonths: 156,
    splitRatio: '50/50',
    evidenceBasis: 'For teenagers 13+ only. State guidelines permit 14-day blocks at this age. Indiana allows non-consecutive weeks for ages 4.5+, but consecutive 2-week blocks only for teens.',
    suggestedWhenBase: [
      'For teenagers 13+ with busy activity schedules who prefer fewer transitions',
      'When parents live far apart and minimizing exchanges is important',
      'Requires a mature child who can maintain relationships across 14-day gaps',
    ],
    tradeoffsBase: [
      '14-day separation is too long for most children under 13 (developmental consensus)',
      'Non-custodial parent misses extended stretches of daily life',
      'Consider midweek phone/video contact to maintain connection',
    ],
  },
];

// ─── Lookup Helpers ───────────────────────────────────────────────

const TEMPLATE_MAP = new Map<TemplateId, TemplateDefV2>(
  TEMPLATES_V2.map((t) => [t.id, t]),
);

export function getTemplateById(id: TemplateId): TemplateDefV2 | undefined {
  return TEMPLATE_MAP.get(id);
}

export const ALL_TEMPLATE_IDS: TemplateId[] = TEMPLATES_V2.map((t) => t.id);
