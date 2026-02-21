import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/auth';
import { useChatStore } from '../../src/stores/chat';
import { familiesApi } from '../../src/api/client';
import * as SecureStore from '../../src/utils/storage';

interface Invite {
  membershipId: string;
  familyId: string;
  familyName: string | null;
  role: string;
  label: string;
  invitedAt: string;
  inviterName: string | null;
  inviterEmail: string | null;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 60_000;

export default function PendingInvitesScreen() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const { setFamily } = useAuthStore();
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const loadInvites = useCallback(async (opts?: { showSpinner?: boolean }) => {
    if (opts?.showSpinner) setChecking(true);
    try {
      const { data } = await familiesApi.getMyInvites();
      const list = Array.isArray(data) ? data : [];
      setInvites(list);
      setError(false);
      // Stop polling once invites are found
      if (list.length > 0) stopPolling();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    startTimeRef.current = Date.now();
    loadInvites();

    pollRef.current = setInterval(() => {
      // Stop after max duration
      if (Date.now() - startTimeRef.current > MAX_POLL_DURATION_MS) {
        stopPolling();
        return;
      }
      loadInvites();
    }, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [loadInvites, stopPolling]);

  const handleCheckAgain = () => {
    // Reset polling timer and manually check
    startTimeRef.current = Date.now();
    stopPolling();
    loadInvites({ showSpinner: true });
    pollRef.current = setInterval(() => {
      if (Date.now() - startTimeRef.current > MAX_POLL_DURATION_MS) {
        stopPolling();
        return;
      }
      loadInvites();
    }, POLL_INTERVAL_MS);
  };

  const handleAccept = async (invite: Invite) => {
    setAccepting(invite.membershipId);
    try {
      const { data } = await familiesApi.acceptInviteById(invite.membershipId);
      const family = {
        id: data.family.id,
        name: data.family.name,
        status: data.family.status,
      };
      await SecureStore.setItemAsync('familyId', family.id);

      // Start joiner onboarding BEFORE setting family (sets isOnboarding=true
      // so AuthGate doesn't redirect away)
      await useChatStore.getState().startJoinerOnboarding(
        family.id,
        family.name || 'Your Family',
      );
      setFamily(family);
      router.replace('/(auth)/onboarding');
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.response?.data?.message || 'Failed to accept invite. Try again.',
      );
    } finally {
      setAccepting(null);
    }
  };

  const handleLogout = async () => {
    const { logout } = useAuthStore.getState();
    await logout();
    router.replace('/(auth)/welcome');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.parentA} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {invites.length > 0 ? 'Pending Invitations' : 'No Pending Invites'}
      </Text>

      {invites.length > 0 ? (
        <>
          <Text style={styles.subtitle}>
            You've been invited to join a co-parenting family.
          </Text>
          {invites.map((invite) => (
            <View key={invite.membershipId} style={styles.card}>
              <Text style={styles.familyName}>
                {invite.familyName || 'Unnamed Family'}
              </Text>
              <Text style={styles.detail}>
                Invited by {invite.inviterName || invite.inviterEmail || 'Unknown'}
              </Text>
              <Text style={styles.detail}>
                Role: {invite.label}
              </Text>
              <TouchableOpacity
                style={[styles.acceptButton, accepting === invite.membershipId && styles.buttonDisabled]}
                onPress={() => handleAccept(invite)}
                disabled={accepting !== null}
              >
                {accepting === invite.membershipId ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept Invitation</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            {error
              ? 'Could not check for invites. Tap below to try again.'
              : 'No pending invites found. If your co-parent already sent an invite, it may take a moment to arrive.'}
          </Text>
          <TouchableOpacity
            style={[styles.checkAgainButton, checking && styles.buttonDisabled]}
            onPress={handleCheckAgain}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color={colors.parentA} />
            ) : (
              <Text style={styles.checkAgainButtonText}>Check Again</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.replace('/(auth)/onboarding')}
          >
            <Text style={styles.createButtonText}>Create a Family Instead</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    maxWidth: 300,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  familyName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  acceptButton: {
    backgroundColor: colors.parentA,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  checkAgainButton: {
    borderWidth: 2,
    borderColor: colors.parentA,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 12,
    minWidth: 200,
  },
  checkAgainButtonText: {
    color: colors.parentA,
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: colors.parentA,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 32,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
