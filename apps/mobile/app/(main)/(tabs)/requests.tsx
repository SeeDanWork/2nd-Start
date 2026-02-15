import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { colors } from '../../../src/theme/colors';
import { useAuthStore } from '../../../src/stores/auth';
import { requestsApi, proposalsApi } from '../../../src/api/client';

const REQUEST_TYPES = [
  { value: 'need_coverage', label: 'Need Coverage', desc: 'I need someone to cover my nights' },
  { value: 'want_time', label: 'Want Extra Time', desc: 'I want the kids on specific dates' },
  { value: 'swap_date', label: 'Swap Dates', desc: 'Trade specific dates with co-parent' },
];

const REASON_TAGS = [
  { value: 'work_travel', label: 'Work/Travel' },
  { value: 'medical', label: 'Medical' },
  { value: 'family_event', label: 'Family Event' },
  { value: 'other', label: 'Other' },
];

interface RequestItem {
  id: string;
  type: string;
  status: string;
  dates: string[];
  reasonTag: string | null;
  reasonNote: string | null;
  urgency: string;
  createdAt: string;
}

interface ProposalOption {
  id: string;
  rank: number;
  label: string;
  calendarDiff: Array<{ date: string; old_parent: string; new_parent: string }>;
  fairnessImpact: { overnight_delta: number; weekend_delta: number };
  stabilityImpact: { transitions_delta: number; school_night_changes: number };
  handoffImpact: { new_handoffs: number; removed_handoffs: number };
  penaltyScore: number;
  isAutoApprovable: boolean;
}

export default function RequestsScreen() {
  const { user, family } = useAuthStore();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [proposals, setProposals] = useState<ProposalOption[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  // Create form state
  const [newType, setNewType] = useState('need_coverage');
  const [newDates, setNewDates] = useState('');
  const [newReason, setNewReason] = useState('other');
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!family) return;
    try {
      const { data } = await requestsApi.list(family.id);
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [family]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleCreate = async () => {
    if (!family || !user) return;
    const dates = newDates.split(',').map((d) => d.trim()).filter(Boolean);
    if (dates.length === 0) {
      Alert.alert('Error', 'Enter at least one date (YYYY-MM-DD format, comma-separated)');
      return;
    }
    setCreating(true);
    try {
      await requestsApi.create(family.id, {
        userId: user.id,
        type: newType,
        dates,
        reasonTag: newReason,
        reasonNote: newNote || undefined,
      });
      setShowCreate(false);
      setNewDates('');
      setNewNote('');
      loadRequests();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create request');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!family || !user) return;
    Alert.alert('Cancel Request', 'Are you sure?', [
      { text: 'No' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await requestsApi.cancel(family.id, requestId, user.id);
            loadRequests();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to cancel');
          }
        },
      },
    ]);
  };

  const handleViewProposals = async (request: RequestItem) => {
    if (!family) return;
    setSelectedRequest(request);
    setLoadingProposals(true);
    try {
      const { data } = await proposalsApi.get(family.id, request.id);
      setProposals(data?.options || []);
    } catch {
      setProposals([]);
    } finally {
      setLoadingProposals(false);
    }
  };

  const handleGenerateProposals = async (requestId: string) => {
    if (!family) return;
    setLoadingProposals(true);
    try {
      const { data } = await proposalsApi.generate(family.id, requestId);
      setProposals(data?.options || []);
      loadRequests();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to generate proposals');
    } finally {
      setLoadingProposals(false);
    }
  };

  const handleAccept = async (optionId: string) => {
    if (!family || !user) return;
    try {
      await proposalsApi.accept(family.id, optionId, user.id);
      Alert.alert('Accepted', 'The schedule has been updated.');
      setSelectedRequest(null);
      loadRequests();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to accept');
    }
  };

  const handleDecline = async () => {
    if (!family || !user || !selectedRequest) return;
    try {
      await proposalsApi.decline(family.id, selectedRequest.id, user.id);
      setSelectedRequest(null);
      loadRequests();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to decline');
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'proposals_generated': return colors.parentA;
      case 'accepted': return colors.success;
      case 'declined': case 'cancelled': return colors.neutral;
      default: return colors.textSecondary;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'proposals_generated': return 'Proposals Ready';
      case 'accepted': return 'Accepted';
      case 'declined': return 'Declined';
      case 'cancelled': return 'Cancelled';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  if (!family) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.title}>Schedule Requests</Text>
          <Text style={styles.subtitle}>Set up your family first to use schedule requests.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Requests</Text>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => setShowCreate(true)}
          >
            <Text style={styles.newButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color={colors.parentA} style={{ marginTop: 20 }} />}

        {!loading && requests.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.subtitle}>No requests yet. Tap "+ New" to create one.</Text>
          </View>
        )}

        {requests.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={styles.requestCard}
            onPress={() => {
              if (r.status === 'proposals_generated') handleViewProposals(r);
              else if (r.status === 'pending') handleViewProposals(r);
            }}
          >
            <View style={styles.requestHeader}>
              <Text style={styles.requestType}>
                {REQUEST_TYPES.find((t) => t.value === r.type)?.label || r.type}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(r.status) + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor(r.status) }]}>
                  {statusLabel(r.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.requestDates}>
              {r.dates.join(', ')}
            </Text>
            {r.reasonTag && (
              <Text style={styles.requestReason}>
                {REASON_TAGS.find((t) => t.value === r.reasonTag)?.label || r.reasonTag}
                {r.reasonNote ? ` - ${r.reasonNote}` : ''}
              </Text>
            )}
            <View style={styles.requestActions}>
              {(r.status === 'pending' || r.status === 'proposals_generated') && (
                <TouchableOpacity onPress={() => handleCancel(r.id)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              {r.status === 'pending' && (
                <TouchableOpacity onPress={() => handleGenerateProposals(r.id)}>
                  <Text style={styles.generateText}>Generate Proposals</Text>
                </TouchableOpacity>
              )}
              {r.status === 'proposals_generated' && (
                <TouchableOpacity onPress={() => handleViewProposals(r)}>
                  <Text style={styles.generateText}>View Proposals</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Create Request Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Request</Text>

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {REQUEST_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, newType === t.value && styles.typeChipActive]}
                  onPress={() => setNewType(t.value)}
                >
                  <Text style={[styles.typeChipText, newType === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Dates (YYYY-MM-DD, comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={newDates}
              onChangeText={setNewDates}
              placeholder="2026-03-01, 2026-03-02"
              placeholderTextColor={colors.neutral}
            />

            <Text style={styles.label}>Reason</Text>
            <View style={styles.typeRow}>
              {REASON_TAGS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, newReason === t.value && styles.typeChipActive]}
                  onPress={() => setNewReason(t.value)}
                >
                  <Text style={[styles.typeChipText, newReason === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              value={newNote}
              onChangeText={setNewNote}
              placeholder="Brief explanation..."
              placeholderTextColor={colors.neutral}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreate(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Proposals Modal */}
      <Modal visible={!!selectedRequest} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Proposals</Text>
            {selectedRequest && (
              <Text style={styles.proposalSubtitle}>
                {REQUEST_TYPES.find((t) => t.value === selectedRequest.type)?.label} - {selectedRequest.dates.join(', ')}
              </Text>
            )}

            {loadingProposals && <ActivityIndicator color={colors.parentA} style={{ marginVertical: 20 }} />}

            {!loadingProposals && proposals.length === 0 && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={styles.subtitle}>No proposals generated yet.</Text>
                {selectedRequest?.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={() => handleGenerateProposals(selectedRequest.id)}
                  >
                    <Text style={styles.submitButtonText}>Generate Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView style={{ maxHeight: 400 }}>
              {proposals.map((opt) => (
                <View key={opt.id} style={styles.proposalCard}>
                  <View style={styles.proposalHeader}>
                    <Text style={styles.proposalLabel}>{opt.label}</Text>
                    {opt.isAutoApprovable && (
                      <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                        <Text style={[styles.statusText, { color: colors.success }]}>Auto-OK</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.impactRow}>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactValue}>{opt.calendarDiff.length}</Text>
                      <Text style={styles.impactLabel}>Days changed</Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactValue}>
                        {opt.fairnessImpact.overnight_delta > 0 ? '+' : ''}
                        {opt.fairnessImpact.overnight_delta}
                      </Text>
                      <Text style={styles.impactLabel}>Fairness</Text>
                    </View>
                    <View style={styles.impactItem}>
                      <Text style={styles.impactValue}>
                        {opt.stabilityImpact.transitions_delta > 0 ? '+' : ''}
                        {opt.stabilityImpact.transitions_delta}
                      </Text>
                      <Text style={styles.impactLabel}>Transitions</Text>
                    </View>
                  </View>

                  {opt.calendarDiff.length > 0 && (
                    <View style={styles.diffList}>
                      {opt.calendarDiff.slice(0, 3).map((d, i) => (
                        <Text key={i} style={styles.diffItem}>
                          {d.date}: {d.old_parent === 'parent_a' ? 'A' : 'B'} → {d.new_parent === 'parent_a' ? 'A' : 'B'}
                        </Text>
                      ))}
                      {opt.calendarDiff.length > 3 && (
                        <Text style={styles.diffItem}>+{opt.calendarDiff.length - 3} more...</Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(opt.id)}
                  >
                    <Text style={styles.acceptButtonText}>Accept This Option</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleDecline}
              >
                <Text style={styles.cancelButtonText}>Decline All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSelectedRequest(null)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  newButton: {
    backgroundColor: colors.parentA,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  newButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestType: { fontSize: 16, fontWeight: '600', color: colors.text },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  requestDates: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  requestReason: { fontSize: 12, color: colors.neutral, marginBottom: 8 },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 4,
  },
  cancelText: { fontSize: 13, color: colors.error, fontWeight: '500' },
  generateText: { fontSize: 13, color: colors.parentA, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  proposalSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 12 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.parentA, borderColor: colors.parentA },
  typeChipText: { fontSize: 13, color: colors.text },
  typeChipTextActive: { color: '#FFF', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  submitButton: {
    flex: 1,
    backgroundColor: colors.parentA,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  // Proposals
  proposalCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  proposalLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  impactItem: { alignItems: 'center' },
  impactValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  impactLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  diffList: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  diffItem: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  acceptButton: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
