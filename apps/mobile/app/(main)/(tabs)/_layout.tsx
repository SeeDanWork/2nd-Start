import { Tabs } from 'expo-router';
import { colors } from '../../../src/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.parentA,
        tabBarInactiveTintColor: colors.neutral,
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarLabel: 'Calendar' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarLabel: 'Chat' }} />
      <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarLabel: 'Requests' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  );
}
