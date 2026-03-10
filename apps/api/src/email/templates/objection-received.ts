import { baseLayout } from './base-layout';

export interface ObjectionReceivedData {
  requestId: string;
  round: number;
}

export function renderObjectionReceived(data: ObjectionReceivedData): { subject: string; html: string } {
  return {
    subject: 'New proposals being generated',
    html: baseLayout('Objection Received', `
      <h2>New proposals are on the way</h2>
      <p>Your co-parent provided feedback on the current proposals. New options are being generated that take this feedback into account.</p>
      <p>This is round <strong>${data.round}</strong> of the mediation process.</p>
      <p>Open the app to review the updated proposals when they're ready.</p>
    `),
  };
}
