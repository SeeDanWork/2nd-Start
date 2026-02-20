import { useEffect } from 'react';
import { useChatStore } from '../../src/stores/chat';
import { ChatScreen } from '../../src/components/chat/ChatScreen';

export default function OnboardingScreen() {
  const startOnboarding = useChatStore((s) => s.startOnboarding);
  const isOnboarding = useChatStore((s) => s.isOnboarding);

  useEffect(() => {
    if (!isOnboarding) {
      startOnboarding();
    }
  }, []);

  return <ChatScreen mode="onboarding" />;
}
