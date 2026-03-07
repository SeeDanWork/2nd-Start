const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function connectPhone(phone: string): Promise<string> {
  const res = await fetch(`${API_BASE}/messaging/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json();
  return data.message;
}

export async function sendMessage(phone: string, body: string): Promise<string> {
  const res = await fetch(`${API_BASE}/messaging/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ From: phone, Body: body }),
  });
  const text = await res.text();
  // Parse TwiML response
  const match = text.match(/<Message>([\s\S]*?)<\/Message>/);
  return match ? match[1] : text;
}

export function getMediaUrl(filename: string): string {
  return `${API_BASE}/messaging/media/${filename}`;
}
