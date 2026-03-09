/**
 * Swap flow message templates.
 */

export function swapConfirmPrompt(
  dateStr: string,
  currentParentName: string,
): string {
  return (
    `You want to swap ${dateStr}. Currently ${currentParentName} has the kids.\n` +
    `Reply YES to confirm or NO to cancel.`
  );
}

export function swapRequestSent(otherParentName: string): string {
  return `Request sent to ${otherParentName}. Waiting for their response.`;
}

export function swapCancelled(): string {
  return 'Swap request cancelled.';
}

export function swapReviewPrompt(
  requestingParentName: string,
  dateStr: string,
): string {
  return `${requestingParentName} requests to swap ${dateStr}. Reply APPROVE or DECLINE.`;
}

export function swapApproved(): string {
  return 'Swap approved. Calendar will be updated.';
}

export function swapDeclined(): string {
  return 'Swap declined. The schedule remains unchanged.';
}

export function swapApprovedNotification(dateStr: string): string {
  return `Your swap for ${dateStr} was approved!`;
}

export function swapDeclinedNotification(dateStr: string): string {
  return `Your swap request for ${dateStr} was declined.`;
}

export function swapNoSchedule(): string {
  return 'No active schedule found for your family.';
}

export function swapNoAssignment(dateStr: string): string {
  return `No assignment found for ${dateStr} in the current schedule.`;
}

export function swapNoDateFound(): string {
  return 'I could not find a date in your message. Try: "Can we swap Friday?" or "Swap March 15"';
}
