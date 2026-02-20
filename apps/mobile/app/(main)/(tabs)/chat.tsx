import { useEffect } from 'react';
import { useChatStore } from '../../../src/stores/chat';
import { ChatScreen } from '../../../src/components/chat/ChatScreen';

export default function ChatTab() {
  const startLifecycle = useChatStore((s) => s.startLifecycle);

  useEffect(() => {
    startLifecycle();
  }, []);

  return <ChatScreen mode="lifecycle" />;
}
