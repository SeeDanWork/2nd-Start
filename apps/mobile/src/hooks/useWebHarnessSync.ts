import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/auth';

/**
 * When running on web inside an iframe (i.e. inside the web harness),
 * posts state-change messages to the parent window so the harness can
 * refresh its panels (schedule list, calendar, decision report).
 *
 * No-ops silently on native or when not in an iframe.
 */
export function useWebHarnessSync() {
  const family = useAuthStore((s) => s.family);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (window.parent === window) return; // not in an iframe

    if (isAuthenticated && family) {
      window.parent.postMessage(
        {
          type: 'family_ready',
          payload: { familyId: family.id, familyName: family.name, userId: user?.id },
          source: 'adcp-mobile',
        },
        '*',
      );
    }
  }, [isAuthenticated, family, user]);

  // Listen for schedule-updated socket events and forward them
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (window.parent === window) return;

    // Forward any schedule_updated notifications the mobile app receives
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'schedule_updated' && event.data?.source === 'adcp-socket') {
        window.parent.postMessage(
          { type: 'schedule_updated', payload: event.data.payload, source: 'adcp-mobile' },
          '*',
        );
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
}
