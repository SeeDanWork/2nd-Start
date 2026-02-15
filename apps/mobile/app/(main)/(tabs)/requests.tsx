import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../../src/theme/colors';

export default function RequestsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Requests</Text>
      <Text style={styles.subtitle}>Schedule change requests will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
});
