import { useState, useEffect, CSSProperties } from 'react';
import { createAuthedClient } from '../../api/client';
import { useHarnessStore } from '../../stores/harness';
import { useLedgerData } from '../../hooks/useLedgerData';
import { useStabilityData } from '../../hooks/useStabilityData';
import { useOnboardingInput } from '../../hooks/useOnboardingInput';
import { OnboardingFactors } from './OnboardingFactors';
import { WeightProfile } from './WeightProfile';
import { FairnessGauge } from './FairnessGauge';
import { StabilityMetrics } from './StabilityMetrics';

interface Props {
  familyId: string;
  token: string;
}

interface ScheduleMeta {
  profile: string | null;
  weights: Record<string, number> | null;
  horizonStart: string | null;
  horizonEnd: string | null;
}

export function DecisionReport({ familyId, token }: Props) {
  const refreshCounter = useHarnessStore((s) => s.refreshCounter);
  const { windows, loading: ledgerLoading, error: ledgerError } = useLedgerData(familyId, token);
  const {
    metrics: stability,
    loading: stabilityLoading,
    error: stabilityError,
  } = useStabilityData(familyId, token);
  const {
    input: onboardingInput,
    loading: onboardingLoading,
    error: onboardingError,
  } = useOnboardingInput(familyId, token);

  const [meta, setMeta] = useState<ScheduleMeta>({
    profile: null,
    weights: null,
    horizonStart: null,
    horizonEnd: null,
  });

  useEffect(() => {
    if (!familyId || !token) return;

    const client = createAuthedClient(() => token);
    client
      .get(`/families/${familyId}/schedules/active`)
      .then((res) => {
        const data = res.data;
        setMeta({
          profile: data?.solverMetadata?.profile || data?.metadata?.profile || null,
          weights: data?.solverMetadata?.weights || data?.metadata?.weights || null,
          horizonStart: data?.horizonStart || null,
          horizonEnd: data?.horizonEnd || null,
        });
      })
      .catch(() => {
        // No active schedule yet
      });
  }, [familyId, token, refreshCounter]);

  return (
    <div style={styles.container}>
      {/* Onboarding factors that drove the schedule */}
      <OnboardingFactors input={onboardingInput} loading={onboardingLoading} error={onboardingError} />

      {/* Solver profile & weight bars */}
      <WeightProfile profile={meta.profile} weights={meta.weights} />

      {/* Horizon info */}
      {meta.horizonStart && (
        <div style={styles.horizonBadge}>
          Horizon: {meta.horizonStart} → {meta.horizonEnd}
        </div>
      )}

      {/* Fairness gauge */}
      <FairnessGauge windows={windows} />
      {ledgerLoading && <p style={styles.status}>Loading ledger...</p>}
      {ledgerError && <p style={styles.error}>{ledgerError}</p>}

      {/* Stability metrics */}
      <StabilityMetrics
        metrics={stability}
        loading={stabilityLoading}
        error={stabilityError}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    padding: 4,
  },
  horizonBadge: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 12,
    padding: '3px 8px',
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    display: 'inline-block',
    fontFamily: 'monospace',
  },
  status: {
    color: '#9ca3af',
    fontSize: 12,
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
  },
};
