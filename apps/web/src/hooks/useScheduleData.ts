import { useState, useEffect } from 'react';
import { createAuthedClient } from '../api/client';
import { useHarnessStore } from '../stores/harness';

export interface ScheduleDay {
  date: string;
  assignedTo: string; // 'parent_a' | 'parent_b'
  source?: string;    // 'base' | 'proposal' | 'manual'
}

export function useScheduleData(familyId: string, token: string) {
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshCounter = useHarnessStore((s) => s.refreshCounter);

  useEffect(() => {
    if (!familyId || !token) return;

    const client = createAuthedClient(() => token);
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const end = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);

    setLoading(true);
    client
      .get(`/families/${familyId}/calendar`, { params: { start, end } })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.assignments || [];
        setDays(data);
        setError(null);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load schedule');
        setDays([]);
      })
      .finally(() => setLoading(false));
  }, [familyId, token, refreshCounter]);

  return { days, loading, error };
}
