import { useState, useEffect } from 'react';
import { createAuthedClient } from '../api/client';
import { useHarnessStore } from '../stores/harness';

export interface OnboardingInput {
  number_of_children?: number;
  children_age_bands?: string[];
  school_schedule?: { school_days?: number[] };
  daycare_schedule?: { daycare_days?: number[] };
  preferred_exchange_location?: string;
  parent_a?: {
    parent_id?: string;
    availability?: { locked_nights?: number[] };
    preferences?: {
      target_share_pct?: number;
      max_handoffs_per_week?: number;
      max_consecutive_nights_away?: number;
      weekend_preference?: string;
    };
  };
  shared?: {
    start_date?: string;
    horizon_days?: number;
  };
}

export function useOnboardingInput(familyId: string, token: string) {
  const [input, setInput] = useState<OnboardingInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshCounter = useHarnessStore((s) => s.refreshCounter);

  useEffect(() => {
    if (!familyId || !token) return;

    const client = createAuthedClient(() => token);
    setLoading(true);

    client
      .get(`/onboarding/saved-input/${familyId}`)
      .then((res) => {
        setInput(res.data?.input ?? null);
        setError(null);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load onboarding input');
        setInput(null);
      })
      .finally(() => setLoading(false));
  }, [familyId, token, refreshCounter]);

  return { input, loading, error };
}
