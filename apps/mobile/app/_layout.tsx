import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '../src/stores/auth';
import { useSocketStore } from '../src/stores/socket';
import { useChatStore } from '../src/stores/chat';
import { colors } from '../src/theme/colors';

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

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, family, pendingInvite, checkForPendingInvites, acceptPendingInvite, setPendingInvite } = useAuthStore();
  const isOnboarding = useChatStore((s) => s.isOnboarding);
  const segments = useSegments();
  const router = useRouter();
  const { connect, joinFamily, disconnect } = useSocketStore();
  const inviteCheckDone = useRef(false);

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

  // One-time check: if user already has a family, see if they also have a pending invite
  useEffect(() => {
    if (isAuthenticated && family && !isLoading && !inviteCheckDone.current) {
      inviteCheckDone.current = true;
      checkForPendingInvites();
    }
  }, [isAuthenticated, family, isLoading]);

  // Show alert when a pending invite is detected for a user who already has a family
  useEffect(() => {
    if (!pendingInvite || !family) return;

    const inviterLabel = pendingInvite.inviterName || 'your co-parent';
    const familyLabel = pendingInvite.familyName || 'their family';

    Alert.alert(
      'Pending Invitation',
      `${inviterLabel} invited you to join "${familyLabel}". Would you like to switch to their family?`,
      [
        {
          text: 'Stay in Current Family',
          style: 'cancel',
          onPress: () => setPendingInvite(null),
        },
        {
          text: 'Switch Family',
          onPress: async () => {
            try {
              await acceptPendingInvite();
            } catch {
              Alert.alert('Error', 'Failed to switch families. Please try again.');
            }
          },
        },
      ],
    );
  }, [pendingInvite, family]);

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
});
