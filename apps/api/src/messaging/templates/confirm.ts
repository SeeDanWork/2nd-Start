export function confirmMessage(intent: string, details: string): string {
  return `Understood: ${intent}\n${details}`;
}
