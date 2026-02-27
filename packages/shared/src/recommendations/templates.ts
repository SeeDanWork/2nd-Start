// ─── V2 Template Catalog ──────────────────────────────────────────
//
// 8 schedule templates, each with a concrete 14-element pattern array
// and static metadata for scoring and explanation.

// ─── Types ────────────────────────────────────────────────────────

export type TemplateId =
  | '223'
  | '223_daytime'
  | '3443'
  | '2255'
  | '7on7off'
  | 'primary_plus_midweek'
  | '2week_blocks'
  | 'primary_weekends';

export interface TemplateDefV2 {
  id: TemplateId;
  name: string;
  /** 14-element array: 0 = parentA, 1 = parentB */
  pattern14: (0 | 1)[];
  handoffsPer2Weeks: number;
  maxBlockA: number;
  maxBlockB: number;
  /** Max of maxBlockA and maxBlockB */
  maxBlock: number;
  nightsA: number;
  nightsB: number;
  schoolAligned: boolean;
  suggestedWhenBase: string[];
  tradeoffsBase: string[];
}

// ─── Template Definitions ─────────────────────────────────────────

// Pattern helper: A=0, B=1
const A = 0 as const;
const B = 1 as const;

export const TEMPLATES_V2: TemplateDefV2[] = [
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
    suggestedWhenBase: [
      'Often works well for young children who benefit from frequent contact with both parents',
      'A common starting point when parents live close together',
    ],
    tradeoffsBase: [
      'Frequent transitions can be tiring for school-age children',
      'Requires good co-parent coordination due to many exchanges',
    ],
  },
  {
    id: '223_daytime',
    name: '2-2-3 Daytime Only',
    pattern14: [A, A, B, B, A, A, A, B, B, A, A, B, B, B],
    handoffsPer2Weeks: 6,
    maxBlockA: 3,
    maxBlockB: 3,
    maxBlock: 3,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    suggestedWhenBase: [
      'Designed for infants (0-6 months) where overnights may not yet be appropriate',
      'Daytime-only contact with non-primary parent, building toward overnights',
    ],
    tradeoffsBase: [
      'Not a true overnight split — one parent handles all nights initially',
      'Transitions to overnights will require a schedule change later',
    ],
  },
  {
    id: '3443',
    name: '3-4-4-3 Rotation',
    pattern14: [A, A, A, B, B, B, B, A, A, A, A, B, B, B],
    handoffsPer2Weeks: 4,
    maxBlockA: 4,
    maxBlockB: 4,
    maxBlock: 4,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: true,
    suggestedWhenBase: [
      'A common schedule that provides balanced time with moderate transitions',
      'Mid-week exchanges often align with school or daycare handoffs',
    ],
    tradeoffsBase: [
      '4-day blocks may feel long for very young children',
      'Mid-week transitions can be logistically challenging without school/daycare',
    ],
  },
  {
    id: '2255',
    name: '2-2-5-5 Split',
    pattern14: [A, A, B, B, A, A, A, A, A, B, B, B, B, B],
    handoffsPer2Weeks: 4,
    maxBlockA: 5,
    maxBlockB: 5,
    maxBlock: 5,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    suggestedWhenBase: [
      'Mix of short and longer blocks for gradual adjustment',
      'A common approach for families wanting equal time with moderate transitions',
    ],
    tradeoffsBase: [
      '5-day blocks may feel long for toddlers',
      'Uneven block lengths within a cycle can feel inconsistent to children',
    ],
  },
  {
    id: '7on7off',
    name: 'Alternating Weeks',
    pattern14: [A, A, A, A, A, A, A, B, B, B, B, B, B, B],
    handoffsPer2Weeks: 2,
    maxBlockA: 7,
    maxBlockB: 7,
    maxBlock: 7,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    suggestedWhenBase: [
      'Often works for older children and teenagers who can handle longer stretches',
      'A common choice when parents live far apart and fewer handoffs help',
    ],
    tradeoffsBase: [
      '7-day separation is generally too long for young children',
      'Can feel like a long time without seeing the other parent',
    ],
  },
  {
    id: 'primary_plus_midweek',
    name: 'Primary + Midweek Visit',
    //        Mon Tue Wed Thu Fri Sat Sun  Mon Tue Wed Thu Fri Sat Sun
    pattern14: [A, A, B, A, A, A, B, A, A, B, A, A, A, B],
    handoffsPer2Weeks: 8,
    maxBlockA: 4,
    maxBlockB: 2,
    maxBlock: 4,
    nightsA: 10,
    nightsB: 4,
    schoolAligned: true,
    suggestedWhenBase: [
      'When one parent is the primary caregiver but both want regular contact',
      'Midweek visits keep non-primary parent involved in school-week routines',
    ],
    tradeoffsBase: [
      'Not a 50/50 split — one parent has significantly more time',
      'Many transitions can be tiring if homes are far apart',
    ],
  },
  {
    id: '2week_blocks',
    name: '2-Week Blocks',
    pattern14: [A, A, A, A, A, A, A, A, A, A, A, A, A, A],
    handoffsPer2Weeks: 1,
    maxBlockA: 14,
    maxBlockB: 14,
    maxBlock: 14,
    nightsA: 14,
    nightsB: 0,
    schoolAligned: false,
    suggestedWhenBase: [
      'Sometimes used for teenagers with busy activity schedules',
      'Can work when parents live very far apart (e.g., different cities)',
    ],
    tradeoffsBase: [
      '14-day separation is too long for most children under 14',
      'Non-custodial parent misses extended stretches of daily life',
      'Generally only appropriate for older teenagers who can maintain both relationships',
    ],
  },
  {
    id: 'primary_weekends',
    name: 'Primary + Weekends',
    pattern14: [A, A, A, A, A, B, B, A, A, A, A, A, B, B],
    handoffsPer2Weeks: 4,
    maxBlockA: 5,
    maxBlockB: 2,
    maxBlock: 5,
    nightsA: 10,
    nightsB: 4,
    schoolAligned: true,
    suggestedWhenBase: [
      'When one parent is the primary caregiver during the week',
      'A common arrangement when work schedules or distance make equal split impractical',
    ],
    tradeoffsBase: [
      'Not a 50/50 split — one parent gets significantly more time',
      'Weekend parent may miss weekday routines and school involvement',
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
