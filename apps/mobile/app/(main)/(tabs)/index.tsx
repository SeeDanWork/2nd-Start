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
import { calendarApi } from '../../../src/api/client';

interface TonightData {
  date: string;
  parent: string | null;
  isTransition: boolean;
  nextTransitionDate: string | null;
}

export default function HomeScreen() {
  const { user, family } = useAuthStore();
  const router = useRouter();
  const [tonight, setTonight] = useState<TonightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTonight();
  }, [family]);

  const loadTonight = async () => {
    if (!family) {
      setLoading(false);
      return;
    }
    try {
      const today = new Date();
      const start = today.toISOString().split('T')[0];
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 14);
      const end = endDate.toISOString().split('T')[0];
      const { data } = await calendarApi.getCalendar(family.id, start, end);

      if (data.days.length > 0) {
        const todayDay = data.days[0];
        const nextTransition = data.days.find(
          (d: any) => d.date !== start && d.assignment?.isTransition,
        );
        setTonight({
          date: todayDay.date,
          parent: todayDay.assignment?.assignedTo || null,
          isTransition: todayDay.assignment?.isTransition || false,
          nextTransitionDate: nextTransition?.date || null,
        });
      }
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>
        Hi, {user?.displayName || 'there'}
      </Text>

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

      {family && !loading && tonight?.parent && (
        <View style={[styles.tonightCard, { borderLeftColor: parentColor(tonight.parent) }]}>
          <Text style={styles.tonightLabel}>TONIGHT</Text>
          <Text style={[styles.tonightParent, { color: parentColor(tonight.parent) }]}>
            {parentLabel(tonight.parent)}
          </Text>
          {tonight.isTransition && (
            <View style={styles.transitionBadge}>
              <Text style={styles.transitionText}>Handoff today</Text>
            </View>
          )}
          {tonight.nextTransitionDate && (
            <Text style={styles.nextTransition}>
              Next handoff: {tonight.nextTransitionDate}
            </Text>
          )}
        </View>
      )}

      {family && !loading && !tonight?.parent && (
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
});
