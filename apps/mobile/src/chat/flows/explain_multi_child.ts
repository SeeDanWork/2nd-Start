import type { ScenarioFlow } from '../types';

/**
 * Multi-Child Explanation Flow
 * Per-child bands → Aggregation mode → Most restrictive child
 */
export const EXPLAIN_MULTI_CHILD_FLOW: ScenarioFlow = {
  id: 'explain_multi_child',
  name: 'Multi-Child Scoring',
  description: 'Understand how the schedule accounts for multiple children of different ages',
  turns: [
    {
      message: "Here's how the schedule accounts for each of your children:",
      card: {
        type: 'multi_child_summary',
        data: { loading: true },
      },
      chips: [
        { label: 'Tell me more', value: 'details' },
        { label: 'Got it', value: 'done' },
      ],
      actionType: 'show_multi_child_overview',
    },
    {
      message: "The schedule is tuned based on your children's ages:\n\n" +
        "• **Hard limits** (max consecutive nights) come from your youngest child — the most restrictive rules apply\n" +
        "• **Stability** (minimizing transitions) is weighted by the most sensitive child\n" +
        "• **Fairness** is a weighted average — younger children count less to prioritize their stability\n" +
        "• All siblings always stay together — no split custody",
      chips: [
        { label: 'Makes sense', value: 'done' },
        { label: 'What if my kids were different ages?', value: 'hypothetical' },
      ],
      actionType: 'explain_aggregation',
      condition: (ctx) => ctx.wantsDetails === true,
    },
    {
      message: 'The schedule adapts as your children grow. When age bands change, the weights automatically adjust.',
      actionType: 'explain_complete',
    },
  ],
};
