import { useEffect } from 'react';
import { useHarnessStore } from '../stores/harness';

/**
 * Listens for postMessage events from the Expo Web iframes.
 * Updates the harness store (familyId, refresh triggers) in response.
 */
export function useIframeMessages() {
  const setFamilyId = useHarnessStore((s) => s.setFamilyId);
  const refresh = useHarnessStore((s) => s.refresh);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'adcp-mobile') return;

      switch (data.type) {
        case 'family_ready':
          if (data.payload?.familyId) {
            setFamilyId(data.payload.familyId);
            refresh();
          }
          break;
        case 'schedule_updated':
          refresh();
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setFamilyId, refresh]);
}
