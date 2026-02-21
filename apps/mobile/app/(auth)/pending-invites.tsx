import { useState, useEffect } from 'react';
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

export default function PendingInvitesScreen() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const { setFamily } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    try {
      const { data } = await familiesApi.getMyInvites();
      const list = Array.isArray(data) ? data : [];
      if (list.length === 0) {
        // No pending invites — skip straight to onboarding
        router.replace('/(auth)/onboarding');
        return;
      }
      setInvites(list);
    } catch {
      // Failed to load invites — go to onboarding
      router.replace('/(auth)/onboarding');
      return;
    } finally {
      setLoading(false);
    }
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
            No pending invites found. Ask your co-parent to send you an invite, or create your own family.
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.replace('/(auth)/onboarding')}
          >
            <Text style={styles.createButtonText}>Create a Family</Text>
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
