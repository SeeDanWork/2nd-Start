import { useEffect, useState, useRef, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '../src/stores/auth';
import { useSocketStore } from '../src/stores/socket';
import { useChatStore } from '../src/stores/chat';
import { colors } from '../src/theme/colors';

const INVITE_POLL_INTERVAL_MS = 10_000;
const INVITE_POLL_MAX_MS = 120_000;

function NotificationBanner() {
  const lastEvent = useSocketStore((s) => s.lastEvent);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!lastEvent) return;

    const messages: Record<string, string> = {
      schedule_updated: 'Schedule updated',
      proposal_received: 'New proposal received',
      proposal_accepted: 'Proposal accepted',
      proposal_expired: 'Proposal expired',
      emergency_changed: 'Emergency mode changed',
    };

    setMessage(messages[lastEvent.type] || 'Update received');
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [lastEvent]);

  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

function InviteBanner() {
  const { pendingInvite, acceptPendingInvite, setPendingInvite, setFamily } =
    useAuthStore();
  const isOnboarding = useChatStore((s) => s.isOnboarding);
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);

  // Don't interrupt onboarding — toast appears after it finishes
  if (!pendingInvite || isOnboarding) return null;

  const inviterLabel = pendingInvite.inviterName || 'Your co-parent';
  const familyLabel = pendingInvite.familyName || 'their family';

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const family = await acceptPendingInvite();
      if (family) {
        // Start joiner onboarding BEFORE setting family so AuthGate
        // sees isOnboarding=true and doesn't redirect to main tabs
        await useChatStore
          .getState()
          .startJoinerOnboarding(family.id, family.name || 'Your Family');
        setFamily(family);
        router.replace('/(auth)/onboarding');
      }
    } catch {
      setAccepting(false);
    }
  };

  return (
    <View style={styles.inviteBanner}>
      <Text style={styles.inviteBannerText}>
        {inviterLabel} invited you to join "{familyLabel}"
      </Text>
      <View style={styles.inviteBannerActions}>
        <TouchableOpacity
          style={styles.inviteDismissButton}
          onPress={() => setPendingInvite(null)}
          disabled={accepting}
        >
          <Text style={styles.inviteDismissText}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inviteAcceptButton, accepting && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={accepting}
        >
          {accepting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.inviteAcceptText}>Accept</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, family, checkForPendingInvites } = useAuthStore();
  const isOnboarding = useChatStore((s) => s.isOnboarding);
  const segments = useSegments();
  const router = useRouter();
  const { connect, joinFamily, disconnect } = useSocketStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && !family && !inAuthGroup) {
      router.replace('/(auth)/pending-invites');
    } else if (isAuthenticated && family && inAuthGroup && !isOnboarding) {
      router.replace('/(main)/(tabs)/');
    }
  }, [isAuthenticated, isLoading, family, segments, isOnboarding]);

  // Poll for pending invites while authenticated
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isLoading) {
      stopPolling();
      return;
    }

    // Start polling for invites
    pollStartRef.current = Date.now();
    checkForPendingInvites();

    pollRef.current = setInterval(() => {
      if (Date.now() - pollStartRef.current > INVITE_POLL_MAX_MS) {
        stopPolling();
        return;
      }
      checkForPendingInvites();
    }, INVITE_POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [isAuthenticated, isLoading, isOnboarding]);

  // Connect socket when authenticated
  useEffect(() => {
    if (isAuthenticated && family) {
      connect('');  // Token passed via auth interceptor
      joinFamily(family.id);
    }
    return () => {
      disconnect();
    };
  }, [isAuthenticated, family]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.parentA} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <AuthGate>
      <NotificationBanner />
      <InviteBanner />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  banner: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: colors.parentA,
    borderRadius: 12,
    padding: 14,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  inviteBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.parentA,
  },
  inviteBannerText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 20,
  },
  inviteBannerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  inviteDismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  inviteDismissText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  inviteAcceptButton: {
    backgroundColor: colors.parentA,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  inviteAcceptText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
