import { baseLayout } from './base-layout';

export interface FamilyInviteData {
  familyName: string;
  inviterName: string;
  role: string;
  token: string;
}

export function renderFamilyInvite(data: FamilyInviteData): { subject: string; html: string } {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/invite/accept?token=${data.token}`;

  return {
    subject: `You've been invited to co-parent on ADCP`,
    html: baseLayout('Family Invitation', `
      <h2>You're invited!</h2>
      <p><strong>${data.inviterName}</strong> has invited you to join
         <strong>${data.familyName || 'their family'}</strong> as <strong>${data.role}</strong>.</p>
      <p>Accept the invitation to start coordinating your co-parenting schedule.</p>
      <p style="text-align:center;margin:24px 0;">
        <a class="btn" href="${link}">Accept Invitation</a>
      </p>
      <p class="muted">This invitation expires in 7 days.</p>
      <p class="muted">Or copy this link: ${link}</p>
    `),
  };
}
