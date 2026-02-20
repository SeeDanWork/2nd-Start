import { baseLayout } from './base-layout';

export interface HandoffReminderData {
  date: string;
  time: string;
  childName: string;
  location: string;
}

export function renderHandoffReminder(data: HandoffReminderData): { subject: string; html: string } {
  return {
    subject: 'Upcoming handoff reminder',
    html: baseLayout('Handoff Reminder', `
      <h2>Handoff reminder</h2>
      <p>You have an upcoming handoff:</p>
      <ul>
        <li><strong>Date:</strong> ${data.date}</li>
        ${data.time ? `<li><strong>Time:</strong> ${data.time}</li>` : ''}
        ${data.childName ? `<li><strong>Child:</strong> ${data.childName}</li>` : ''}
        ${data.location ? `<li><strong>Location:</strong> ${data.location}</li>` : ''}
      </ul>
      <p>Open the app for full schedule details.</p>
    `),
  };
}
