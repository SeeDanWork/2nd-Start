import { useState, useEffect } from 'react';
import { createAuthedClient } from '../api/client';
import { useHarnessStore } from '../stores/harness';

export interface LedgerWindow {
  windowWeeks: number;
  parentA: { overnights: number; pct: number };
  parentB: { overnights: number; pct: number };
  totalNights: number;
}

export function useLedgerData(familyId: string, token: string) {
  const [windows, setWindows] = useState<LedgerWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshCounter = useHarnessStore((s) => s.refreshCounter);

  useEffect(() => {
    if (!familyId || !token) return;

    const client = createAuthedClient(() => token);
    setLoading(true);

    client
      .get(`/families/${familyId}/ledger`, {
        params: { windows: 'TWO_WEEK,FOUR_WEEK,EIGHT_WEEK,TWELVE_WEEK' },
      })
      .then((res) => {
        const raw: any[] = Array.isArray(res.data) ? res.data : res.data?.windows || [];
        // Map LedgerSnapshot entity fields to our interface
        const windowWeeksMap: Record<string, number> = {
          TWO_WEEK: 2, FOUR_WEEK: 4, EIGHT_WEEK: 8, TWELVE_WEEK: 12,
        };
        const mapped: LedgerWindow[] = raw.map((snap: any) => {
          const total = (snap.parentAOvernights ?? 0) + (snap.parentBOvernights ?? 0);
          return {
            windowWeeks: windowWeeksMap[snap.windowType] ?? 0,
            parentA: {
              overnights: snap.parentAOvernights ?? 0,
              pct: total > 0 ? ((snap.parentAOvernights ?? 0) / total) * 100 : 50,
            },
            parentB: {
              overnights: snap.parentBOvernights ?? 0,
              pct: total > 0 ? ((snap.parentBOvernights ?? 0) / total) * 100 : 50,
            },
            totalNights: total,
          };
        });
        setWindows(mapped);
        setError(null);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load ledger');
        setWindows([]);
      })
      .finally(() => setLoading(false));
  }, [familyId, token, refreshCounter]);

  return { windows, loading, error };
}
