import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/auth';
import { auditApi } from '../../src/api/client';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  schedule_generated: 'Schedule generated',
  schedule_activated: 'Schedule activated',
  request_created: 'Request created',
  proposal_generated: 'Proposals generated',
  proposal_accepted: 'Proposal accepted',
  proposal_declined: 'Proposal declined',
  proposal_expired: 'Proposal expired',
  constraint_added: 'Constraint added',
  constraint_removed: 'Constraint removed',
  consent_rule_changed: 'Auto-approve rule changed',
  emergency_activated: 'Emergency mode activated',
  emergency_returned: 'Emergency mode ended',
  share_link_created: 'Share link created',
  'request.created': 'Request created',
  'request.cancelled': 'Request cancelled',
  'proposals.generated': 'Proposals generated',
  'proposal.accepted': 'Proposal accepted',
  'proposal.declined': 'Proposal declined',
};

export default function AuditScreen() {
  const { family } = useAuthStore();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  const loadAudit = useCallback(async () => {
    if (!family) return;
    setLoading(true);
    try {
      const [auditRes, summaryRes] = await Promise.all([
        auditApi.getAuditLog(family.id, 100, 0),
        auditApi.getMonthlySummary(family.id, new Date().toISOString().slice(0, 7)),
      ]);
      setEntries(auditRes.data.entries || []);
      setSummary(summaryRes.data);
    } catch {
      // No data yet
    } finally {
      setLoading(false);
    }
  }, [family]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const renderEntry = ({ item }: { item: AuditEntry }) => (
    <View style={styles.entryRow}>
      <Text style={styles.entryAction}>
        {ACTION_LABELS[item.action] || item.action}
      </Text>
      <Text style={styles.entryMeta}>
        {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Activity Log</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Monthly Summary */}
      {summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>This Month</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.totalOvernights}</Text>
              <Text style={styles.summaryLabel}>Overnights</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.totalTransitions}</Text>
              <Text style={styles.summaryLabel}>Transitions</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.requestsMade}</Text>
              <Text style={styles.summaryLabel}>Requests</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.requestsAccepted}</Text>
              <Text style={styles.summaryLabel}>Accepted</Text>
            </View>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.parentA} style={{ marginTop: 40 }} />
      ) : entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No activity recorded yet.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEntry}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.surface,
  },
  backText: { fontSize: 16, color: colors.parentA },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    margin: 20,
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    margin: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  entryRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryAction: { fontSize: 14, fontWeight: '600', color: colors.text },
  entryMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
