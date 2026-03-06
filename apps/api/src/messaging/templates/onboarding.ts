/**
 * Onboarding message templates.
 *
 * Most onboarding messages are generated inline by OnboardingFlowService
 * since they depend on dynamic context. These templates cover the
 * static/reusable messages.
 */

export function partnerInviteMessage(inviterName: string): string {
  return (
    `You've been invited to ADCP by ${inviterName}. ` +
    'Reply START to begin setting up your co-parenting schedule.'
  );
}

export function partnerNotRegisteredMessage(): string {
  return 'Reply START to begin setting up your account.';
}

export function partnerWelcomeMessage(): string {
  return (
    "Welcome! You've joined the family on ADCP.\n\n" +
    "Your co-parenting schedule is being set up. We'll notify you when it's ready.\n\n" +
    'Type HELP for available commands.'
  );
}
