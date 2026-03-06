/**
 * Format notification data into short SMS messages.
 */
export function formatNotificationSms(
  type: string,
  data: Record<string, unknown>,
): string {
  switch (type) {
    case 'handoff_reminder':
      return `Reminder: Handoff scheduled for ${data.time || 'today'}. Location: ${data.location || 'TBD'}`;

    case 'proposal_received':
      return `New proposal received for ${data.dates || 'upcoming dates'}. Reply to view details.`;

    case 'proposal_accepted':
      return `Your proposal for ${data.dates || 'the requested dates'} was accepted!`;

    case 'proposal_expired':
      return `Proposal for ${data.dates || 'the requested dates'} has expired.`;

    case 'emergency_activated':
      return `Emergency mode activated by ${data.parent || 'co-parent'}.`;

    case 'budget_low':
      return `Change budget is running low (${data.remaining || '?'} remaining this month).`;

    case 'fairness_drift':
      return 'Fairness alert: Schedule is drifting from target split.';

    default:
      return `${type}: ${data.summary || 'You have a new notification.'}`;
  }
}
