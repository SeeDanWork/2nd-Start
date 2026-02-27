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
        params: { windows: '2,4,8,12' },
      })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.windows || [];
        setWindows(data);
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
