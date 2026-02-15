import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../src/theme/colors';
import { useAuthStore } from '../../../src/stores/auth';

export default function RequestsScreen() {
  const { family } = useAuthStore();

  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <Text style={styles.title}>Schedule Requests</Text>
        <Text style={styles.subtitle}>
          {family
            ? 'No pending requests. When you or your co-parent need a schedule change, create a request here.'
            : 'Set up your family first to use schedule requests.'}
        </Text>
        {family && (
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>New Request</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Requests Work</Text>
        <Text style={styles.infoText}>
          1. Choose a request type (need coverage, want extra time, swap dates)
        </Text>
        <Text style={styles.infoText}>
          2. Select the dates and provide a reason
        </Text>
        <Text style={styles.infoText}>
          3. The system generates fair proposal options
        </Text>
        <Text style={styles.infoText}>
          4. Your co-parent reviews and accepts a proposal
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.parentA,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
});
