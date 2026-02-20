import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';

export default function WelcomeScreen() {
  const router = useRouter();

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
});
