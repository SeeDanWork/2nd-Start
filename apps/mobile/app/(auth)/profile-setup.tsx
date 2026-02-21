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
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/auth';
import { authApi } from '../../src/api/client';

export default function ProfileSetupScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();

  const handleContinue = async () => {
    const first = firstName.trim();
    if (!first) {
      Alert.alert('Name Required', 'Please enter your first name.');
      return;
    }
    setSaving(true);
    try {
      const displayName = lastName.trim()
        ? `${first} ${lastName.trim()}`
        : first;
      const { data: updated } = await authApi.updateProfile({ displayName });
      useAuthStore.setState({ user: { ...user!, displayName: updated.displayName ?? displayName } });
      router.replace('/(auth)/pending-invites');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>What's your name?</Text>
        <Text style={styles.subtitle}>
          This is how your co-parent will see you in the app.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor={colors.neutral}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoFocus
            editable={!saving}
          />

          <Text style={styles.label}>Last name (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Last name"
            placeholderTextColor={colors.neutral}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            editable={!saving}
          />

          <TouchableOpacity
            style={[styles.button, (!firstName.trim() || saving) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!firstName.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    marginBottom: 32,
    lineHeight: 22,
    maxWidth: 300,
  },
  form: {
    width: '100%',
    maxWidth: 340,
  },
  label: {
    fontSize: 16,
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
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
