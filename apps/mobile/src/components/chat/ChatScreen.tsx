import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { ChatMessage } from '../../chat/types';
import { ChatBubble } from './ChatBubble';
import { OptionDetailModal } from './OptionDetailModal';
import { useChatStore, ScheduleOption } from '../../stores/chat';
import { useAuthStore } from '../../stores/auth';
import { calendarApi } from '../../api/client';

interface ChatScreenProps {
  mode: 'onboarding' | 'lifecycle';
}

export function ChatScreen({ mode }: ChatScreenProps) {
  const messages = useChatStore((s) => s.messages);
  const processUserInput = useChatStore((s) => s.processUserInput);
  const processChipSelection = useChatStore((s) => s.processChipSelection);
  const options = useChatStore((s) => s.options);
  const isOnboarding = useChatStore((s) => s.isOnboarding);
  const isJoinerOnboarding = useChatStore((s) => s.isJoinerOnboarding);
  const advanceOnboarding = useChatStore((s) => s.advanceOnboarding);
  const advanceJoinerOnboarding = useChatStore((s) => s.advanceJoinerOnboarding);
  const addMessage = useChatStore((s) => s.addMessage);
  const family = useAuthStore((s) => s.family);
  const joinerFamilyId = useChatStore((s) => s.joinerFamilyId);
  const router = useRouter();

  const [inputText, setInputText] = useState('');
  const [detailOption, setDetailOption] = useState<ScheduleOption | null>(null);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText('');
    processUserInput(trimmed);
  }, [inputText, processUserInput]);

  const handleChipSelect = useCallback(
    (value: string) => {
      // Navigation chips
      if (value === 'nav_calendar') {
        if (isOnboarding) {
          useChatStore.setState({ isOnboarding: false });
        }
        router.replace('/(main)/(tabs)/calendar');
        return;
      }
      if (value === 'nav_requests') {
        router.push('/(main)/(tabs)/requests');
        return;
      }
      if (value === 'explore_chat') {
        useChatStore.setState({ isOnboarding: false, isJoinerOnboarding: false });
        router.replace('/(main)/(tabs)/chat');
        return;
      }
      if (value === 'retry_generate') {
        if (isJoinerOnboarding) {
          advanceJoinerOnboarding();
        } else {
          advanceOnboarding();
        }
        return;
      }
      processChipSelection(value);
    },
    [isOnboarding, isJoinerOnboarding, processChipSelection, advanceOnboarding, advanceJoinerOnboarding, router],
  );

  const handleSelectSchedule = useCallback(
    async (optionId: string) => {
      const option = options.find((o) => o.id === optionId);
      if (!option) return;

      const targetFamilyId = isJoinerOnboarding ? joinerFamilyId : family?.id;
      if (!targetFamilyId) return;

      try {
        if (option.assignments.length > 0) {
          await calendarApi.createManualSchedule(
            targetFamilyId,
            option.assignments.map((a) => ({
              date: a.date,
              assignedTo: a.parentId,
            })),
          );
        }

        // Notify web harness so data panels refresh
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.parent !== window) {
          window.parent.postMessage(
            { type: 'schedule_updated', payload: { familyId: targetFamilyId }, source: 'adcp-mobile' },
            '*',
          );
        }

        addMessage({
          id: Date.now().toString(36),
          role: 'bot',
          content: `Great choice! "${option.profileName}" is now your active schedule.`,
          timestamp: Date.now(),
        });

        if (isJoinerOnboarding) {
          advanceJoinerOnboarding();
        } else {
          advanceOnboarding();
        }
      } catch {
        addMessage({
          id: Date.now().toString(36),
          role: 'bot',
          content: 'Schedule saved! Head to the Calendar tab to see it in action.',
          timestamp: Date.now(),
        });
        if (isJoinerOnboarding) {
          advanceJoinerOnboarding();
        } else {
          advanceOnboarding();
        }
      }
    },
    [options, family, joinerFamilyId, isJoinerOnboarding, addMessage, advanceOnboarding, advanceJoinerOnboarding],
  );

  const handleDetailSchedule = useCallback(
    (optionId: string) => {
      const option = options.find((o) => o.id === optionId);
      if (option) setDetailOption(option);
    },
    [options],
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      // FlatList is inverted, so index 0 is the last message
      const isLatest = index === 0;
      return (
        <ChatBubble
          message={item}
          isLatest={isLatest}
          onChipSelect={handleChipSelect}
          onSelectSchedule={handleSelectSchedule}
          onDetailSchedule={handleDetailSchedule}
        />
      );
    },
    [handleChipSelect, handleSelectSchedule, handleDetailSchedule],
  );

  // Show text input for lifecycle mode, or during text_input onboarding steps
  const showTextInput = mode === 'lifecycle' || !isOnboarding;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
      />

      {showTextInput && (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.neutral}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Text style={styles.sendButtonText}>{'\u2191'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <OptionDetailModal
        option={detailOption}
        visible={detailOption !== null}
        onClose={() => setDetailOption(null)}
        onSelect={(id) => {
          setDetailOption(null);
          handleSelectSchedule(id);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messageList: {
    paddingVertical: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.parentA,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
