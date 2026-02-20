import { baseLayout } from './base-layout';

export interface BudgetLowData {
  remaining: number;
  total: number;
}

export function renderBudgetLow(data: BudgetLowData): { subject: string; html: string } {
  return {
    subject: 'Change budget running low',
    html: baseLayout('Budget Low', `
      <h2>Change budget running low</h2>
      <p>Your family's monthly change budget is running low.</p>
      <p><strong>${data.remaining}</strong> of <strong>${data.total}</strong> requests remaining this period.</p>
      <p>Budget resets at the start of the next period. Use remaining requests wisely.</p>
    `),
  };
}
