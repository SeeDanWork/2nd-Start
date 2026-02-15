import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../src/theme/colors';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Anti-Drama Co-Parenting</Text>
      <Text style={styles.subtitle}>Fair over time. Stable for the child.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
