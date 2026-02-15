import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { useAuthStore } from '../../../src/stores/auth';
import { metricsApi, guardrailsApi } from '../../../src/api/client';

interface TodayData {
  tonight: { date: string; parent: string | null; isTransition: boolean };
  nextHandoff: { date: string; type: string; fromParent: string; toParent: string } | null;
  fairness: {
    parentAOvernights: number;
    parentBOvernights: number;
    delta: number;
    withinBand: boolean;
    windowWeeks: number;
  } | null;
  stability: {
    transitionsThisWeek: number;
    maxConsecutiveA: number;
    maxConsecutiveB: number;
  } | null;
  pendingRequests: number;
}

export default function HomeScreen() {
  const { user, family } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emergency, setEmergency] = useState<any>(null);

  useEffect(() => {
    loadToday();
  }, [family]);

  const loadToday = async () => {
    if (!family) {
      setLoading(false);
      return;
    }
    try {
      const [todayRes, emergRes] = await Promise.all([
        metricsApi.getToday(family.id),
        guardrailsApi.getEmergency(family.id),
      ]);
      setData(todayRes.data);
      setEmergency(emergRes.data || null);
    } catch {
      // No schedule yet
    } finally {
      setLoading(false);
    }
  };

  const parentLabel = (p: string) =>
    p === 'parent_a' ? 'Parent A' : 'Parent B';
  const parentColor = (p: string) =>
    p === 'parent_a' ? colors.parentA : colors.parentB;

  const fairnessBarWidth = (a: number, b: number) => {
    const total = a + b;
    if (total === 0) return 50;
    return Math.round((a / total) * 100);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>
        Hi, {user?.displayName || 'there'}
      </Text>

      {/* Emergency banner */}
      {emergency && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>
            Emergency mode active — constraints relaxed until {emergency.returnToBaselineAt}
          </Text>
        </View>
      )}

      {!family && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No Family Yet</Text>
          <Text style={styles.cardText}>
            Complete onboarding to set up your co-parenting family.
          </Text>
        </View>
      )}

      {family && loading && (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.parentA} />
        </View>
      )}

      {/* Tonight Card */}
      {data?.tonight?.parent && (
        <View style={[styles.tonightCard, { borderLeftColor: parentColor(data.tonight.parent) }]}>
          <Text style={styles.tonightLabel}>TONIGHT</Text>
          <Text style={[styles.tonightParent, { color: parentColor(data.tonight.parent) }]}>
            {parentLabel(data.tonight.parent)}
          </Text>
          {data.tonight.isTransition && (
            <View style={styles.transitionBadge}>
              <Text style={styles.transitionText}>Handoff today</Text>
            </View>
          )}
          {data.nextHandoff && (
            <Text style={styles.nextTransition}>
              Next handoff: {data.nextHandoff.date}
            </Text>
          )}
        </View>
      )}

      {family && !loading && !data?.tonight?.parent && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No Schedule Yet</Text>
          <Text style={styles.cardText}>
            Go to Settings to configure your constraints and generate a schedule.
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(main)/(tabs)/settings')}
          >
            <Text style={styles.actionButtonText}>Set Up Schedule</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fairness Card */}
      {data?.fairness && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>FAIRNESS ({data.fairness.windowWeeks}-WEEK)</Text>
          <View style={styles.fairnessBar}>
            <View
              style={[
                styles.fairnessSegmentA,
                { width: `${fairnessBarWidth(data.fairness.parentAOvernights, data.fairness.parentBOvernights)}%` },
              ]}
            />
            <View style={styles.fairnessSegmentB} />
          </View>
          <View style={styles.fairnessLabels}>
            <Text style={[styles.fairnessCount, { color: colors.parentA }]}>
              A: {data.fairness.parentAOvernights}
            </Text>
            <Text style={[styles.fairnessCount, { color: colors.parentB }]}>
              B: {data.fairness.parentBOvernights}
            </Text>
          </View>
          <View style={[
            styles.fairnessBadge,
            { backgroundColor: data.fairness.withinBand ? colors.success + '20' : colors.warning + '20' },
          ]}>
            <Text style={[
              styles.fairnessBadgeText,
              { color: data.fairness.withinBand ? colors.success : colors.warning },
            ]}>
              {data.fairness.withinBand ? 'Within fairness band' : `Delta: ${data.fairness.delta} nights`}
            </Text>
          </View>
        </View>
      )}

      {/* Stability Card */}
      {data?.stability && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>STABILITY (THIS WEEK)</Text>
          <View style={styles.stabilityRow}>
            <View style={styles.stabilityItem}>
              <Text style={styles.stabilityValue}>{data.stability.transitionsThisWeek}</Text>
              <Text style={styles.stabilityLabel}>Transitions</Text>
            </View>
            <View style={styles.stabilityItem}>
              <Text style={styles.stabilityValue}>{data.stability.maxConsecutiveA}</Text>
              <Text style={styles.stabilityLabel}>Max A streak</Text>
            </View>
            <View style={styles.stabilityItem}>
              <Text style={styles.stabilityValue}>{data.stability.maxConsecutiveB}</Text>
              <Text style={styles.stabilityLabel}>Max B streak</Text>
            </View>
          </View>
        </View>
      )}

      {/* Pending Requests */}
      {data && data.pendingRequests > 0 && (
        <TouchableOpacity
          style={[styles.card, styles.requestsCard]}
          onPress={() => router.push('/(main)/(tabs)/requests')}
        >
          <Text style={styles.cardTitle}>{data.pendingRequests} Pending Request{data.pendingRequests > 1 ? 's' : ''}</Text>
          <Text style={styles.cardText}>Tap to review</Text>
        </TouchableOpacity>
      )}

      {/* Quick actions */}
      {family && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(main)/(tabs)/calendar')}
          >
            <Text style={styles.quickActionText}>View Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(main)/(tabs)/requests')}
          >
            <Text style={styles.quickActionText}>New Request</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginBottom: 16,
  },
  tonightCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  tonightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  tonightParent: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  transitionBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  transitionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  nextTransition: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  fairnessBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fairnessSegmentA: {
    backgroundColor: colors.parentA,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  fairnessSegmentB: {
    flex: 1,
    backgroundColor: colors.parentB,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  fairnessLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fairnessCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  fairnessBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  fairnessBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stabilityItem: {
    alignItems: 'center',
  },
  stabilityValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  stabilityLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  requestsCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  actionButton: {
    backgroundColor: colors.parentA,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.parentA,
  },
  emergencyBanner: {
    backgroundColor: colors.error + '15',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  emergencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
});
