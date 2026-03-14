import { Stack } from 'expo-router';

export default function MainTabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="calendar" />
      <Stack.Screen
        name="settings"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      {/* Keep these routes accessible but they're no longer tabs */}
      <Stack.Screen name="index" options={{ presentation: 'modal' }} />
      <Stack.Screen name="requests" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
