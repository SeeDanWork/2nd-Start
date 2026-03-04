import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/auth';

const DEV_EMAIL = 'father@test.local';

export default function WelcomeScreen() {
  const router = useRouter();
  const { devLogin, restoreFamily } = useAuthStore();
  const [devLoading, setDevLoading] = useState(false);

  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      await devLogin(DEV_EMAIL);
      const family = await restoreFamily();
      if (family) {
        router.replace('/(main)/(tabs)/');
      } else {
        router.replace('/(auth)/onboarding');
      }
    } catch (err: any) {
      Alert.alert('Dev Login Failed', err.message || 'Is the API running?');
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Anti-Drama{'\n'}Co-Parenting</Text>
        <Text style={styles.subtitle}>Fair over time. Stable for the child.</Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.secondaryButtonText}>I Have an Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.devButton}
            onPress={handleDevLogin}
            disabled={devLoading}
          >
            <Text style={styles.devButtonText}>
              {devLoading ? 'Logging in...' : `Dev Login (${DEV_EMAIL})`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 48,
  },
  buttons: {
    width: '100%',
    maxWidth: 340,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.parentA,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  devButton: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
    borderStyle: 'dashed',
  },
  devButtonText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '500',
  },
});
