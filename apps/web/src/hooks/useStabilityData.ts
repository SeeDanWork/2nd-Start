import { useState, useEffect } from 'react';
import { createAuthedClient } from '../api/client';
import { useHarnessStore } from '../stores/harness';

export interface StabilityMetrics {
  transitions: number;
  avgConsecutiveNights: number;
  maxConsecutiveNights: number;
  schoolNightConsistency: number; // 0-1
}

export function useStabilityData(familyId: string, token: string) {
  const [metrics, setMetrics] = useState<StabilityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshCounter = useHarnessStore((s) => s.refreshCounter);

  useEffect(() => {
    if (!familyId || !token) return;

    const client = createAuthedClient(() => token);
    const now = new Date();
    const start = new Date(now.getTime() - 56 * 86400000).toISOString().slice(0, 10); // 8 weeks back
    const end = now.toISOString().slice(0, 10);

    setLoading(true);

    client
      .get(`/families/${familyId}/stability`, { params: { start, end } })
      .then((res) => {
        const d = res.data;
        if (!d) {
          setMetrics(null);
        } else {
          // Map StabilitySnapshot entity fields to our interface
          const maxA = d.maxConsecutiveA ?? 0;
          const maxB = d.maxConsecutiveB ?? 0;
          setMetrics({
            transitions: d.transitionsPerWeek ?? 0,
            avgConsecutiveNights: (maxA + maxB) / 2,
            maxConsecutiveNights: Math.max(maxA, maxB),
            schoolNightConsistency: (d.schoolNightConsistencyPct ?? 0) / 100,
          });
        }
        setError(null);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load stability');
        setMetrics(null);
      })
      .finally(() => setLoading(false));
  }, [familyId, token, refreshCounter]);

  return { metrics, loading, error };
}
