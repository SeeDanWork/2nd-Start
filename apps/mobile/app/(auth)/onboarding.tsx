import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/auth';

export default function OnboardingScreen() {
  const [familyName, setFamilyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'create' | 'invite'>('create');
  const { createFamily, family } = useAuthStore();
  const router = useRouter();

  const handleCreateFamily = async () => {
    setLoading(true);
    try {
      await createFamily(
        familyName.trim() || 'My Family',
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      setStep('invite');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create family.');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const { familiesApi } = await import('../../src/api/client');
      await familiesApi.invite(family!.id, {
        email: inviteEmail.trim().toLowerCase(),
        role: 'parent_b',
        label: 'Parent B',
      });
      Alert.alert('Invitation Sent', `We sent an invite to ${inviteEmail}.`, [
        { text: 'Continue', onPress: () => router.replace('/(main)/(tabs)/') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipInvite = () => {
    router.replace('/(main)/(tabs)/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        {step === 'create' ? (
          <>
            <Text style={styles.title}>Set Up Your Family</Text>
            <Text style={styles.subtitle}>
              Create your co-parenting family to start scheduling.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>Family Name (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Smith-Jones Family"
                placeholderTextColor={colors.neutral}
                value={familyName}
                onChangeText={setFamilyName}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleCreateFamily}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Create Family</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Invite Co-Parent</Text>
            <Text style={styles.subtitle}>
              Invite the other parent to join your family. They'll receive an
              email with a link to join.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>Co-parent's email</Text>
              <TextInput
                style={styles.input}
                placeholder="coparent@example.com"
                placeholderTextColor={colors.neutral}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleInvite}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Invitation</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkButton} onPress={handleSkipInvite}>
                <Text style={styles.linkText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    marginBottom: 40,
    lineHeight: 22,
    maxWidth: 300,
  },
  form: {
    width: '100%',
    maxWidth: 340,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.parentA,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: colors.parentA,
    fontSize: 14,
  },
});
