import { CSSProperties } from 'react';
import { OnboardingInput } from '../../hooks/useOnboardingInput';

interface Props {
  input: OnboardingInput | null;
  loading: boolean;
  error: string | null;
}

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDays(days: number[] | undefined): string {
  if (!days || days.length === 0) return 'None';
  return days.map((d) => DOW_NAMES[d] ?? `Day ${d}`).join(', ');
}

function formatAgeBands(bands: string[] | undefined): string {
  if (!bands || bands.length === 0) return 'N/A';
  const labels: Record<string, string> = {
    UNDER_2: 'Under 2',
    '2_TO_5': '2–5',
    '6_TO_9': '6–9',
    '10_TO_12': '10–12',
    '13_TO_17': '13–17',
    under_2: 'Under 2',
    under_5: 'Under 5',
    '5_to_12': '5–12',
    teen: '13–17',
  };
  return bands.map((b) => labels[b] ?? b).join(', ');
}

function formatWeekendPref(pref: string | undefined): string {
  if (!pref) return 'N/A';
  const labels: Record<string, string> = {
    EQUAL_SPLIT: 'Equal split',
    PREFER_PARENT_A: 'Prefer Parent A',
    PREFER_PARENT_B: 'Prefer Parent B',
    ALTERNATING: 'Alternating',
    equal: 'Equal split',
    prefer_a: 'Prefer Parent A',
    prefer_b: 'Prefer Parent B',
    alternating: 'Alternating',
  };
  return labels[pref] ?? pref;
}

export function OnboardingFactors({ input, loading, error }: Props) {
  if (loading) return <p style={styles.status}>Loading onboarding factors...</p>;
  if (error) return <p style={styles.error}>{error}</p>;
  if (!input) return null;

  const prefs = input.parent_a?.preferences;

  const rows: [string, string][] = [
    ['Children', String(input.number_of_children ?? 'N/A')],
    ['Age bands', formatAgeBands(input.children_age_bands)],
    ['School days', formatDays(input.school_schedule?.school_days)],
  ];

  if (input.daycare_schedule?.daycare_days) {
    rows.push(['Daycare days', formatDays(input.daycare_schedule.daycare_days)]);
  }

  rows.push(
    ['Exchange location', input.preferred_exchange_location ?? 'N/A'],
    ['Target split', prefs?.target_share_pct != null ? `${prefs.target_share_pct}%` : 'N/A'],
    ['Max consecutive away', prefs?.max_consecutive_nights_away != null ? String(prefs.max_consecutive_nights_away) : 'N/A'],
    ['Max handoffs/week', prefs?.max_handoffs_per_week != null ? String(prefs.max_handoffs_per_week) : 'N/A'],
    ['Weekend preference', formatWeekendPref(prefs?.weekend_preference)],
    ['Start date', input.shared?.start_date ?? 'N/A'],
    ['Horizon', input.shared?.horizon_days != null ? `${input.shared.horizon_days} days` : 'N/A'],
  );

  return (
    <div style={styles.container}>
      <div style={styles.title}>Onboarding Factors</div>
      {rows.map(([label, value]) => (
        <div key={label} style={styles.row}>
          <span style={styles.label}>{label}</span>
          <span style={styles.value}>{value}</span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    marginBottom: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 6,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
  },
  label: {
    fontSize: 11,
    color: '#6b7280',
  },
  value: {
    fontSize: 11,
    color: '#1a1a2e',
    fontWeight: 500,
    textAlign: 'right' as const,
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
