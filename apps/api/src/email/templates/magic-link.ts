import { baseLayout } from './base-layout';

export interface MagicLinkData {
  token: string;
}

export function renderMagicLink(data: MagicLinkData): { subject: string; html: string } {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/auth/verify?token=${data.token}`;

  return {
    subject: 'Your sign-in link',
    html: baseLayout('Sign In', `
      <h2>Sign in to your account</h2>
      <p>Click the button below to sign in. This link expires in 15 minutes.</p>
      <p style="text-align:center;margin:24px 0;">
        <a class="btn" href="${link}">Sign In</a>
      </p>
      <p class="muted">If you didn't request this, you can safely ignore this email.</p>
      <p class="muted">Or copy this link: ${link}</p>
    `),
  };
}
