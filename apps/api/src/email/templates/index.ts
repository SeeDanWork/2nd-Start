import { NotificationType } from '@adcp/shared';
import { renderMagicLink } from './magic-link';
import { renderFamilyInvite } from './family-invite';
import { renderProposalReceived } from './proposal-received';
import { renderProposalAccepted } from './proposal-accepted';
import { renderProposalExpiring } from './proposal-expiring';
import { renderProposalExpired } from './proposal-expired';
import { renderEmergencyActivated } from './emergency-activated';
import { renderEmergencyReturn } from './emergency-return';
import { renderHandoffReminder } from './handoff-reminder';
import { renderBudgetLow } from './budget-low';
import { renderFairnessDrift } from './fairness-drift';
import { renderObjectionReceived } from './objection-received';
import { renderPreConflictAlert } from './preconflict-alert';

export type EmailType = 'magic_link' | 'family_invite' | NotificationType;

type RenderFn = (data: any) => { subject: string; html: string };

export const templateRegistry: Record<EmailType, RenderFn> = {
  magic_link: renderMagicLink,
  family_invite: renderFamilyInvite,
  [NotificationType.PROPOSAL_RECEIVED]: renderProposalReceived,
  [NotificationType.PROPOSAL_ACCEPTED]: renderProposalAccepted,
  [NotificationType.PROPOSAL_EXPIRING]: renderProposalExpiring,
  [NotificationType.PROPOSAL_EXPIRED]: renderProposalExpired,
  [NotificationType.EMERGENCY_ACTIVATED]: renderEmergencyActivated,
  [NotificationType.EMERGENCY_RETURN]: renderEmergencyReturn,
  [NotificationType.HANDOFF_REMINDER]: renderHandoffReminder,
  [NotificationType.BUDGET_LOW]: renderBudgetLow,
  [NotificationType.FAIRNESS_DRIFT]: renderFairnessDrift,
  [NotificationType.OBJECTION_RECEIVED]: renderObjectionReceived,
  [NotificationType.PROPOSALS_REGENERATED]: renderObjectionReceived,
  [NotificationType.PRECONFLICT_ALERT]: renderPreConflictAlert,
};
