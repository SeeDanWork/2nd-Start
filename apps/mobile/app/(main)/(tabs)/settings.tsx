import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { useAuthStore } from '../../../src/stores/auth';
import { useParentLabel, useParentNames } from '../../../src/hooks/useParentName';
import { constraintsApi, calendarApi, guardrailsApi, sharingApi, familiesApi, apiClient } from '../../../src/api/client';
import * as SecureStore from '../../../src/utils/storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ConstraintData {
  id: string;
  type: string;
  hardness: string;
  weight: number;
  owner: string;
  parameters: Record<string, any>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { family, logout, user, setFamily } = useAuthStore();
  const parentLabel = useParentLabel();
  const parentNames = useParentNames();
  const [constraints, setConstraints] = useState<ConstraintData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Locked night editor state
  const [showLockEditor, setShowLockEditor] = useState(false);
  const [lockParent, setLockParent] = useState<'parent_a' | 'parent_b'>('parent_a');
  const [lockDays, setLockDays] = useState<number[]>([]);

  // Family members state
  const [members, setMembers] = useState<any[]>([]);
  const [showInviteEditor, setShowInviteEditor] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('parent_b');
  const [inviteLabel, setInviteLabel] = useState('Parent B');
  const [inviting, setInviting] = useState(false);

  // Pending invites for this user
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);

  // Guardrails state
  const [consentRules, setConsentRules] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [emergency, setEmergency] = useState<any>(null);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [ruleType, setRuleType] = useState('fairness_band');
  const [ruleThreshold, setRuleThreshold] = useState('2');

  // Schedule explanation state
  const [familyContext, setFamilyContext] = useState<any>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const fetchConstraints = useCallback(async () => {
    if (!family) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await constraintsApi.getConstraints(family.id);
      setConstraints(data.constraints || []);
    } catch {
      // No constraint set yet
    } finally {
      setLoading(false);
    }
  }, [family]);

  const fetchMembers = useCallback(async () => {
    if (!family) return;
    try {
      const { data } = await familiesApi.getMembers(family.id);
      setMembers(Array.isArray(data) ? data : data.members || []);
    } catch {
      // Members not available
    }
  }, [family]);

  const fetchPendingInvites = useCallback(async () => {
    try {
      const { data } = await familiesApi.getMyInvites();
      setPendingInvites(Array.isArray(data) ? data : []);
    } catch {
      // Not available
    }
  }, []);

  const fetchFamilyContext = useCallback(async () => {
    if (!family) return;
    try {
      const { data } = await apiClient.get(`/families/${family.id}/today`);
      setFamilyContext(data);
    } catch {
      // Context not available
    }
  }, [family]);

  const fetchGuardrails = useCallback(async () => {
    if (!family) return;
    try {
      const [rulesRes, budgetRes, emergRes] = await Promise.all([
        guardrailsApi.getConsentRules(family.id),
        guardrailsApi.getBudgets(family.id),
        guardrailsApi.getEmergency(family.id),
      ]);
      setConsentRules(rulesRes.data || []);
      setBudgets(budgetRes.data || []);
      setEmergency(emergRes.data || null);
    } catch {
      // Guardrails not configured yet
    }
  }, [family]);

  useEffect(() => {
    fetchConstraints();
    fetchGuardrails();
    fetchMembers();
    fetchPendingInvites();
    fetchFamilyContext();
  }, [fetchConstraints, fetchGuardrails, fetchMembers, fetchPendingInvites, fetchFamilyContext]);

  const addLockedNight = async () => {
    if (!family || lockDays.length === 0) return;
    try {
      await constraintsApi.addConstraint(family.id, {
        type: 'locked_night',
        hardness: 'hard',
        weight: 100,
        owner: lockParent,
        parameters: {
          parent: lockParent,
          daysOfWeek: lockDays,
        },
      });
      setShowLockEditor(false);
      setLockDays([]);
      fetchConstraints();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add constraint.');
    }
  };

  const addMaxConsecutive = async (parent: string, maxNights: number) => {
    if (!family) return;
    try {
      await constraintsApi.addConstraint(family.id, {
        type: 'max_consecutive',
        hardness: 'hard',
        weight: 100,
        owner: parent,
        parameters: { parent, maxNights },
      });
      fetchConstraints();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add constraint.');
    }
  };

  const removeConstraint = async (constraintId: string) => {
    if (!family) return;
    Alert.alert('Remove Constraint', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await constraintsApi.removeConstraint(family.id, constraintId);
            fetchConstraints();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to remove.');
          }
        },
      },
    ]);
  };

  const generateSchedule = async () => {
    if (!family) return;
    setGenerating(true);
    try {
      // Validate first
      const { data: validation } = await constraintsApi.validate(family.id);
      if (!validation.valid) {
        const msgs = validation.conflicts.map((c: any) => c.description).join('\n');
        Alert.alert('Constraint Conflicts', msgs);
        setGenerating(false);
        return;
      }

      await calendarApi.generateSchedule(family.id);
      Alert.alert('Schedule Generated', 'Your new schedule has been created. Check the calendar.');
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.conflicts) {
        const suggestions = errData.conflicts.map((c: any) => c.description || c.suggestion).join('\n');
        Alert.alert(
          'Infeasible Schedule',
          `${errData.message || 'Cannot create schedule'}\n\n${suggestions}`,
        );
      } else {
        Alert.alert('Generation Failed', errData?.message || err.message || 'Try relaxing constraints.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const toggleLockDay = (day: number) => {
    setLockDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const describeConstraint = (c: ConstraintData): string => {
    switch (c.type) {
      case 'locked_night': {
        const days = (c.parameters.daysOfWeek as number[])
          .map((d) => DAY_LABELS[d])
          .join(', ');
        return `${parentLabel(c.parameters.parent)} locked on ${days}`;
      }
      case 'max_consecutive':
        return `${parentLabel(c.parameters.parent)} max ${c.parameters.maxNights} consecutive nights`;
      case 'weekend_split':
        return `Weekend split: ${c.parameters.targetPctParentA}% ${parentNames.parent_a}`;
      case 'max_transitions_per_week':
        return `Max ${c.parameters.maxTransitions} transitions/week`;
      default:
        return c.type;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Schedule Rules</Text>

      {/* Current constraints */}
      {loading ? (
        <ActivityIndicator color={colors.parentA} style={{ marginVertical: 20 }} />
      ) : constraints.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No constraints set. Add rules below to generate a fair schedule.
          </Text>
        </View>
      ) : (
        constraints.map((c) => (
          <View key={c.id} style={styles.constraintRow}>
            <View style={styles.constraintInfo}>
              <Text style={styles.constraintText}>{describeConstraint(c)}</Text>
              <Text style={styles.constraintMeta}>
                {c.hardness} | weight: {c.weight}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeConstraint(c.id)}
            >
              <Text style={styles.removeButtonText}>X</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Add locked night */}
      <Text style={styles.sectionTitle}>Add Constraints</Text>

      {!showLockEditor ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowLockEditor(true)}
        >
          <Text style={styles.addButtonText}>+ Locked Nights</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.editorCard}>
          <Text style={styles.editorLabel}>Parent</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                lockParent === 'parent_a' && styles.toggleActive,
              ]}
              onPress={() => setLockParent('parent_a')}
            >
              <Text style={[
                styles.toggleText,
                lockParent === 'parent_a' && styles.toggleTextActive,
              ]}>{parentNames.parent_a}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                lockParent === 'parent_b' && styles.toggleActiveB,
              ]}
              onPress={() => setLockParent('parent_b')}
            >
              <Text style={[
                styles.toggleText,
                lockParent === 'parent_b' && styles.toggleTextActive,
              ]}>{parentNames.parent_b}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.editorLabel}>Days of week</Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dayChip,
                  lockDays.includes(idx) && styles.dayChipActive,
                ]}
                onPress={() => toggleLockDay(idx)}
              >
                <Text style={[
                  styles.dayChipText,
                  lockDays.includes(idx) && styles.dayChipTextActive,
                ]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.editorActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setShowLockEditor(false); setLockDays([]); }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, lockDays.length === 0 && styles.buttonDisabled]}
              onPress={addLockedNight}
              disabled={lockDays.length === 0}
            >
              <Text style={styles.saveButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick add: max consecutive */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          Alert.alert('Max Consecutive Nights', 'Set for which parent?', [
            {
              text: `${parentNames.parent_a} (5 nights)`,
              onPress: () => addMaxConsecutive('parent_a', 5),
            },
            {
              text: `${parentNames.parent_b} (5 nights)`,
              onPress: () => addMaxConsecutive('parent_b', 5),
            },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
      >
        <Text style={styles.addButtonText}>+ Max Consecutive</Text>
      </TouchableOpacity>

      {/* Generate schedule */}
      <Text style={styles.sectionTitle}>Generate Schedule</Text>
      <TouchableOpacity
        style={[styles.generateButton, generating && styles.buttonDisabled]}
        onPress={generateSchedule}
        disabled={generating}
      >
        {generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateButtonText}>Generate Schedule</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.generateHint}>
        Uses your constraints to compute an optimal, fair schedule for the next 12 weeks.
      </Text>

      {/* Schedule Explanation section */}
      <Text style={styles.sectionTitle}>Schedule Explanation</Text>
      <View style={styles.explanationCard}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>Evidence Best</Text>
        </View>

        {familyContext ? (
          <>
            {familyContext.ageBand && (
              <View style={styles.explainRow}>
                <Text style={styles.explainLabel}>Age Band</Text>
                <Text style={styles.explainValue}>{familyContext.ageBand}</Text>
              </View>
            )}
            {familyContext.templateName && (
              <View style={styles.explainRow}>
                <Text style={styles.explainLabel}>Recommended Template</Text>
                <Text style={styles.explainValue}>{familyContext.templateName}</Text>
              </View>
            )}
            {familyContext.score != null && (
              <View style={styles.explainRow}>
                <Text style={styles.explainLabel}>Score</Text>
                <Text style={styles.explainValue}>
                  {typeof familyContext.score === 'number' ? familyContext.score.toFixed(1) : familyContext.score}
                  {familyContext.confidence ? ` (${familyContext.confidence})` : ''}
                </Text>
              </View>
            )}
            {familyContext.rationale && Array.isArray(familyContext.rationale) && (
              <View style={styles.explainSection}>
                <Text style={styles.explainSectionTitle}>Why this schedule</Text>
                {familyContext.rationale.map((r: string, i: number) => (
                  <Text key={i} style={styles.bulletText}>• {r}</Text>
                ))}
              </View>
            )}
            {familyContext.suggestedWhen && Array.isArray(familyContext.suggestedWhen) && (
              <View style={styles.explainSection}>
                <Text style={styles.explainSectionTitle}>Works well when</Text>
                {familyContext.suggestedWhen.map((s: string, i: number) => (
                  <Text key={i} style={styles.bulletText}>• {s}</Text>
                ))}
              </View>
            )}
            {familyContext.tradeoffs && Array.isArray(familyContext.tradeoffs) && (
              <View style={styles.explainSection}>
                <Text style={styles.explainSectionTitle}>Tradeoffs</Text>
                {familyContext.tradeoffs.map((t: string, i: number) => (
                  <Text key={i} style={styles.bulletText}>• {t}</Text>
                ))}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.emptyText}>
            Generate a schedule to see explanation details.
          </Text>
        )}
      </View>

      {/* Technical Details (collapsed by default) */}
      <TouchableOpacity
        style={styles.techHeader}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setShowTechDetails(!showTechDetails);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.techHeaderText}>Technical Details</Text>
        <Text style={styles.chevron}>{showTechDetails ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {showTechDetails && (
        <View style={styles.techCard}>
          {familyContext ? (
            <>
              {/* Family context */}
              <Text style={styles.techSectionTitle}>Family Context</Text>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Youngest Age Band</Text>
                <Text style={styles.techValue}>{familyContext.ageBand || 'N/A'}</Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Weight Profile</Text>
                <Text style={styles.techValue}>{familyContext.weightProfile || familyContext.solverProfile || 'N/A'}</Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Scoring Mode</Text>
                <Text style={styles.techValue}>{familyContext.scoringMode || 'evidence'}</Text>
              </View>

              {/* Hard constraint floors */}
              <Text style={styles.techSectionTitle}>Hard Constraint Floors</Text>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Max Consecutive</Text>
                <Text style={styles.techValue}>{familyContext.maxConsecutive ?? 'N/A'}</Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Max Away</Text>
                <Text style={styles.techValue}>{familyContext.maxAway ?? 'N/A'}</Text>
              </View>

              {/* Solver weights */}
              {familyContext.weights && typeof familyContext.weights === 'object' && (
                <>
                  <Text style={styles.techSectionTitle}>Solver Weights</Text>
                  {Object.entries(familyContext.weights).map(([key, val]: [string, any]) => (
                    <View key={key} style={styles.techRow}>
                      <Text style={styles.techLabel}>{key}</Text>
                      <Text style={styles.techValue}>
                        {typeof val === 'number' ? val.toFixed(2) : String(val)}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {/* Active constraints */}
              {constraints.length > 0 && (
                <>
                  <Text style={styles.techSectionTitle}>Active Constraints ({constraints.length})</Text>
                  {constraints.map((c) => (
                    <View key={c.id} style={styles.techRow}>
                      <Text style={styles.techLabel}>{c.type}</Text>
                      <Text style={styles.techValue}>{c.hardness} w:{c.weight}</Text>
                    </View>
                  ))}
                </>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>
              No family context data available.
            </Text>
          )}
        </View>
      )}

      {/* Guardrails section */}
      <Text style={styles.sectionTitle}>Guardrails</Text>

      {/* Auto-approve rules */}
      <Text style={styles.editorLabel}>Auto-Approve Rules</Text>
      {consentRules.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No auto-approve rules. Add rules to auto-approve low-impact proposals.
          </Text>
        </View>
      ) : (
        consentRules.map((rule: any) => (
          <View key={rule.id} style={styles.constraintRow}>
            <View style={styles.constraintInfo}>
              <Text style={styles.constraintText}>
                {rule.ruleType === 'fairness_band'
                  ? `Fairness delta ≤ ${rule.threshold?.maxDelta ?? '?'}`
                  : rule.ruleType === 'max_transitions'
                  ? `Max ${rule.threshold?.maxAdditional ?? '?'} extra transitions`
                  : rule.ruleType === 'max_streak'
                  ? `Max streak ≤ ${rule.threshold?.maxStreak ?? '?'}`
                  : rule.ruleType}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={async () => {
                if (!family || !user) return;
                try {
                  await guardrailsApi.removeConsentRule(family.id, rule.id, user.id);
                  fetchGuardrails();
                } catch (err: any) {
                  Alert.alert('Error', err.response?.data?.message || 'Failed to remove rule.');
                }
              }}
            >
              <Text style={styles.removeButtonText}>X</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {!showRuleEditor ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowRuleEditor(true)}
        >
          <Text style={styles.addButtonText}>+ Auto-Approve Rule</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.editorCard}>
          <Text style={styles.editorLabel}>Rule Type</Text>
          <View style={styles.toggleRow}>
            {(['fairness_band', 'max_transitions'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.toggleButton, ruleType === t && styles.toggleActive]}
                onPress={() => setRuleType(t)}
              >
                <Text style={[styles.toggleText, ruleType === t && styles.toggleTextActive]}>
                  {t === 'fairness_band' ? 'Fairness' : 'Transitions'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.editorLabel}>
            {ruleType === 'fairness_band' ? 'Max overnight delta' : 'Max additional transitions'}
          </Text>
          <View style={styles.toggleRow}>
            {['1', '2', '3'].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.dayChip, ruleThreshold === v && styles.dayChipActive]}
                onPress={() => setRuleThreshold(v)}
              >
                <Text style={[styles.dayChipText, ruleThreshold === v && styles.dayChipTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.editorActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowRuleEditor(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={async () => {
                if (!family || !user) return;
                try {
                  const threshold = ruleType === 'fairness_band'
                    ? { maxDelta: parseInt(ruleThreshold, 10) }
                    : { maxAdditional: parseInt(ruleThreshold, 10) };
                  await guardrailsApi.addConsentRule(family.id, {
                    userId: user.id,
                    ruleType,
                    threshold,
                  });
                  setShowRuleEditor(false);
                  fetchGuardrails();
                } catch (err: any) {
                  Alert.alert('Error', err.response?.data?.message || 'Failed to add rule.');
                }
              }}
            >
              <Text style={styles.saveButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Budget display */}
      <Text style={styles.editorLabel}>Change Budget (This Month)</Text>
      {budgets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No budget data yet.</Text>
        </View>
      ) : (
        budgets.map((b: any, i: number) => (
          <View key={i} style={styles.constraintRow}>
            <Text style={styles.constraintText}>
              {b.userId?.slice(0, 8)}: {b.used}/{b.budgetLimit} used ({b.remaining} remaining)
            </Text>
          </View>
        ))
      )}

      {/* Emergency mode */}
      <Text style={styles.editorLabel}>Emergency Mode</Text>
      {emergency ? (
        <View style={[styles.editorCard, { borderLeftWidth: 4, borderLeftColor: colors.error }]}>
          <Text style={[styles.constraintText, { color: colors.error }]}>Emergency Active</Text>
          <Text style={styles.constraintMeta}>
            Returns to baseline: {emergency.returnToBaselineAt}
          </Text>
          <TouchableOpacity
            style={[styles.cancelButton, { marginTop: 12, borderColor: colors.error }]}
            onPress={async () => {
              if (!family || !user) return;
              Alert.alert('Cancel Emergency', 'Restore normal constraints immediately?', [
                { text: 'No', style: 'cancel' },
                {
                  text: 'Yes, Cancel',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await guardrailsApi.cancelEmergency(family.id, user.id);
                      fetchGuardrails();
                    } catch (err: any) {
                      Alert.alert('Error', err.response?.data?.message || 'Failed to cancel.');
                    }
                  },
                },
              ]);
            }}
          >
            <Text style={[styles.cancelButtonText, { color: colors.error }]}>Cancel Emergency</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addButton, { borderColor: colors.error }]}
          onPress={() => {
            if (!family || !user) return;
            const returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + 7);
            Alert.alert(
              'Activate Emergency Mode',
              'This will relax constraints for 7 days. Are you sure?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Activate',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await guardrailsApi.activateEmergency(family.id, {
                        userId: user.id,
                        returnToBaselineAt: returnDate.toISOString().split('T')[0],
                      });
                      fetchGuardrails();
                    } catch (err: any) {
                      Alert.alert('Error', err.response?.data?.message || 'Failed to activate.');
                    }
                  },
                },
              ],
            );
          }}
        >
          <Text style={[styles.addButtonText, { color: colors.error }]}>Activate Emergency Mode</Text>
        </TouchableOpacity>
      )}

      {/* Sharing & Audit section */}
      <Text style={styles.sectionTitle}>Sharing & Activity</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          if (!family || !user) return;
          Alert.alert('Create Share Link', 'Share a read-only calendar link?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create',
              onPress: async () => {
                try {
                  const { data: link } = await sharingApi.createShareLink(family.id, {
                    userId: user.id,
                    scope: 'calendar_readonly',
                    label: 'Shared calendar',
                  });
                  Alert.alert('Link Created', `Token: ${link.token?.slice(0, 12)}...`);
                } catch (err: any) {
                  Alert.alert('Error', err.response?.data?.message || 'Failed to create link.');
                }
              },
            },
          ]);
        }}
      >
        <Text style={styles.addButtonText}>+ Share Calendar Link</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.addButton, { borderColor: colors.parentA }]}
        onPress={() => router.push('/(main)/audit')}
      >
        <Text style={styles.addButtonText}>View Activity Log</Text>
      </TouchableOpacity>

      {/* Family Members section */}
      <Text style={styles.sectionTitle}>Family Members</Text>

      {members.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No members found.</Text>
        </View>
      ) : (
        members.map((m: any, i: number) => (
          <View key={m.id || i} style={styles.constraintRow}>
            <View style={styles.constraintInfo}>
              <Text style={styles.constraintText}>
                {m.user?.displayName || m.email || 'Unknown'}
              </Text>
              <Text style={styles.constraintMeta}>
                {m.label || m.role}
              </Text>
            </View>
            {m.inviteStatus === 'pending' && (
              <TouchableOpacity
                style={styles.resendButton}
                onPress={async () => {
                  if (!family) return;
                  try {
                    await familiesApi.resendInvite(family.id, m.id);
                    Alert.alert('Invite Re-sent', `Invitation re-sent to ${m.inviteEmail || m.email}.`);
                  } catch (err: any) {
                    Alert.alert('Error', err.response?.data?.message || 'Failed to resend invite.');
                  }
                }}
              >
                <Text style={styles.resendButtonText}>Resend</Text>
              </TouchableOpacity>
            )}
            <View style={[
              styles.memberStatus,
              m.inviteStatus === 'pending' && styles.memberStatusPending,
            ]}>
              <Text style={[styles.statusText, m.inviteStatus === 'pending' && { color: '#F59E0B' }]}>
                {m.inviteStatus === 'pending' ? 'Pending' : 'Joined'}
              </Text>
            </View>
          </View>
        ))
      )}

      {!showInviteEditor ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowInviteEditor(true)}
        >
          <Text style={styles.addButtonText}>+ Invite Member</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.editorCard}>
          <Text style={styles.editorLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor={colors.textSecondary}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.editorLabel}>Role</Text>
          <View style={styles.toggleRow}>
            {([
              { key: 'parent_b', display: 'Parent B' },
              { key: 'caregiver', display: 'Caregiver' },
              { key: 'viewer', display: 'Viewer' },
            ] as const).map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.toggleButton, inviteRole === r.key && styles.toggleActive]}
                onPress={() => { setInviteRole(r.key); setInviteLabel(r.display); }}
              >
                <Text style={[styles.toggleText, inviteRole === r.key && styles.toggleTextActive]}>
                  {r.display}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.editorLabel}>Label</Text>
          <TextInput
            style={styles.input}
            value={inviteLabel}
            onChangeText={setInviteLabel}
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.editorActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowInviteEditor(false);
                setInviteEmail('');
                setInviteRole('parent_b');
                setInviteLabel('Parent B');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, (!inviteEmail || inviting) && styles.buttonDisabled]}
              disabled={!inviteEmail || inviting}
              onPress={async () => {
                if (!family) return;
                setInviting(true);
                try {
                  await familiesApi.invite(family.id, {
                    email: inviteEmail,
                    role: inviteRole,
                    label: inviteLabel,
                  });
                  Alert.alert('Invite Sent', `Invitation sent to ${inviteEmail}.`);
                  setShowInviteEditor(false);
                  setInviteEmail('');
                  setInviteRole('parent_b');
                  setInviteLabel('Parent B');
                  fetchMembers();
                } catch (err: any) {
                  Alert.alert('Error', err.response?.data?.message || 'Failed to send invite.');
                } finally {
                  setInviting(false);
                }
              }}
            >
              {inviting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Send Invite</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Pending Invites section */}
      {pendingInvites.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pending Invites</Text>
          {pendingInvites.map((inv: any) => (
            <View key={inv.membershipId} style={styles.inviteCard}>
              <Text style={styles.inviteFamily}>
                {inv.familyName || 'A family'}
              </Text>
              <Text style={styles.inviteFrom}>
                Invited by {inv.inviterName || 'Unknown'}{inv.inviterEmail ? ` (${inv.inviterEmail})` : ''}
              </Text>
              <Text style={styles.constraintMeta}>
                Role: {inv.label || inv.role}
              </Text>
              <TouchableOpacity
                style={[styles.acceptButton, accepting === inv.membershipId && styles.buttonDisabled]}
                disabled={accepting === inv.membershipId}
                onPress={async () => {
                  setAccepting(inv.membershipId);
                  try {
                    const { data } = await familiesApi.acceptInviteById(inv.membershipId);
                    const accepted = data.family || data;
                    await SecureStore.setItemAsync('familyId', accepted.id);
                    setFamily({ id: accepted.id, name: accepted.name, status: accepted.status });
                    Alert.alert('Invite Accepted', `You have joined ${inv.familyName || 'the family'}!`);
                    fetchPendingInvites();
                    // Fetch members for the NEW family (closure has stale familyId)
                    const { data: newMembers } = await familiesApi.getMembers(accepted.id);
                    setMembers(Array.isArray(newMembers) ? newMembers : newMembers.members || []);
                  } catch (err: any) {
                    Alert.alert('Error', err.response?.data?.message || 'Failed to accept invite.');
                  } finally {
                    setAccepting(null);
                  }
                }}
              >
                {accepting === inv.membershipId ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Account section */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.accountCard}>
        <Text style={styles.accountEmail}>{user?.email}</Text>
        <Text style={styles.accountName}>{user?.displayName}</Text>
        {family && (
          <Text style={styles.accountFamily}>
            Family: {family.name || family.id.slice(0, 8)}
          </Text>
        )}
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  constraintRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  constraintInfo: { flex: 1 },
  constraintText: { fontSize: 14, fontWeight: '600', color: colors.text },
  constraintMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: { fontSize: 12, fontWeight: '700', color: colors.error },
  addButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  addButtonText: { fontSize: 14, fontWeight: '600', color: colors.parentA },
  editorCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  editorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: colors.parentA,
    borderColor: colors.parentA,
  },
  toggleActiveB: {
    backgroundColor: colors.parentB,
    borderColor: colors.parentB,
  },
  toggleText: { fontSize: 14, color: colors.text },
  toggleTextActive: { color: '#FFFFFF', fontWeight: '600' },
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: colors.parentA,
    borderColor: colors.parentA,
  },
  dayChipText: { fontSize: 13, color: colors.text },
  dayChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: { fontSize: 14, color: colors.textSecondary },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.parentA,
  },
  saveButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  buttonDisabled: { opacity: 0.5 },
  generateButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  generateHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  accountEmail: { fontSize: 14, fontWeight: '600', color: colors.text },
  accountName: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  accountFamily: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: colors.error },
  resendButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.parentA,
    marginRight: 8,
  },
  resendButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.parentA,
  },
  memberStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.success + '20',
  },
  memberStatusPending: {
    backgroundColor: '#F59E0B20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.parentA,
  },
  inviteFamily: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  inviteFrom: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
  acceptButton: {
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },

  // Schedule Explanation
  explanationCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  modeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.modeEvidence + '15',
    borderWidth: 1,
    borderColor: colors.modeEvidence,
    marginBottom: 12,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.modeEvidence,
  },
  explainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  explainLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  explainValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  explainSection: {
    marginTop: 10,
  },
  explainSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  bulletText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingLeft: 4,
  },

  // Technical Details
  techHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  techHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  techCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  techSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  techLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  techValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
