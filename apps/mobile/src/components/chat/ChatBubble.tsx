import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors } from '../../theme/colors';
import { ChatMessage } from '../../chat/types';
import { ChipRow } from './ChipRow';
import { DayChipRow } from './DayChipRow';
import { MiniCalendar } from './MiniCalendar';
import { ScheduleOptionCard } from './ScheduleOptionCard';
import { OnboardingChecklist } from './OnboardingChecklist';
import { PatternPickerCard } from './PatternPickerCard';
import { DisruptionCheckInCard } from './DisruptionCheckInCard';
import { StartDatePickerCard } from './StartDatePickerCard';
import { useChatStore, ScheduleOption } from '../../stores/chat';

interface ChatBubbleProps {
  message: ChatMessage;
  isLatest: boolean;
  onChipSelect: (value: string) => void;
  onSelectSchedule: (optionId: string) => void;
  onDetailSchedule: (optionId: string) => void;
}

export function ChatBubble({
  message,
  isLatest,
  onChipSelect,
  onSelectSchedule,
  onDetailSchedule,
}: ChatBubbleProps) {
  const isBot = message.role === 'bot';

  const hasCard = !!message.card;

  return (
    <View style={[styles.row, isBot ? styles.rowBot : styles.rowUser]}>
      <View style={[styles.bubble, isBot ? styles.bubbleBot : styles.bubbleUser, hasCard && styles.bubbleWide]}>
        {message.content && (
          <Text style={[styles.text, isBot ? styles.textBot : styles.textUser]}>
            {message.content}
          </Text>
        )}
        {message.card && (
          <CardRenderer
            card={message.card}
            isLatest={isLatest}
            onSelectSchedule={onSelectSchedule}
            onDetailSchedule={onDetailSchedule}
          />
        )}
      </View>
      {message.chips && isLatest && (
        <View style={styles.chipsContainer}>
          <ChipRow chips={message.chips} onSelect={onChipSelect} />
        </View>
      )}
    </View>
  );
}

function CardRenderer({
  card,
  isLatest,
  onSelectSchedule,
  onDetailSchedule,
}: {
  card: ChatMessage['card'];
  isLatest: boolean;
  onSelectSchedule: (id: string) => void;
  onDetailSchedule: (id: string) => void;
}) {
  if (!card) return null;
  const selectedDays = useChatStore((s) => s.selectedDays);
  const setSelectedDays = useChatStore((s) => s.setSelectedDays);
  const setWizardField = useChatStore((s) => s.setWizardField);
  const options = useChatStore((s) => s.options);

  switch (card.type) {
    case 'day_selector':
      return (
        <DayChipRow
          selected={selectedDays}
          onChange={setSelectedDays}
          label={card.data.label as string}
          disabled={!isLatest}
        />
      );

    case 'text_input':
      return (
        <TextInputCard
          placeholder={card.data.placeholder as string}
          field={card.data.field as string}
          disabled={!isLatest}
          onChangeText={(text) => setWizardField(card.data.field as any, text)}
        />
      );

    case 'loading':
      return <LoadingCard phases={card.data.phases as string[]} />;

    case 'schedule_preview': {
      const assignments = (card.data.assignments as string[]) || [];
      if (assignments.length === 0) {
        return (
          <View style={cardStyles.info}>
            <Text style={cardStyles.infoText}>No existing schedule to preview.</Text>
          </View>
        );
      }
      return <MiniCalendar assignments={assignments} />;
    }

    case 'schedule_option':
      return (
        <ScheduleOptionsCarousel
          options={options}
          onSelect={onSelectSchedule}
          onDetail={onDetailSchedule}
        />
      );

    case 'checklist':
      return (
        <OnboardingChecklist
          items={card.data.items as Array<{ label: string; done: boolean }>}
        />
      );

    case 'info':
      return (
        <View style={cardStyles.info}>
          <Text style={cardStyles.infoText}>
            {(card.data.text as string) || ''}
          </Text>
        </View>
      );

    case 'visual_pattern':
      return <PatternPickerCard disabled={!isLatest} />;

    case 'disruption_checkin':
      return (
        <DisruptionCheckInCard
          date={card.data.date as string | undefined}
          disabled={!isLatest}
        />
      );

    case 'start_date_picker':
      return <StartDatePickerCard disabled={!isLatest} />;

    default:
      return null;
  }
}

function TextInputCard({
  placeholder,
  field,
  disabled,
  onChangeText,
}: {
  placeholder: string;
  field: string;
  disabled: boolean;
  onChangeText: (text: string) => void;
}) {
  return (
    <TextInput
      style={cardStyles.textInput}
      placeholder={placeholder}
      placeholderTextColor={colors.neutral}
      editable={!disabled}
      onChangeText={onChangeText}
      autoCapitalize={field === 'inviteEmail' ? 'none' : 'sentences'}
      keyboardType={field === 'inviteEmail' ? 'email-address' : 'default'}
    />
  );
}

function LoadingCard({ phases }: { phases: string[] }) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1 < phases.length ? prev + 1 : prev));
    }, 2000);
    return () => clearInterval(interval);
  }, [phases.length]);

  return (
    <View style={cardStyles.loading}>
      <ActivityIndicator size="small" color={colors.parentA} />
      <Text style={cardStyles.loadingText}>{phases[phaseIndex]}</Text>
    </View>
  );
}

function ScheduleOptionsCarousel({
  options,
  onSelect,
  onDetail,
}: {
  options: ScheduleOption[];
  onSelect: (id: string) => void;
  onDetail: (id: string) => void;
}) {
  if (options.length === 0) {
    return (
      <View style={cardStyles.loading}>
        <Text style={cardStyles.loadingText}>No options generated yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={cardStyles.carousel}
    >
      {options.map((opt) => (
        <ScheduleOptionCard
          key={opt.id}
          option={opt}
          onSelect={onSelect}
          onDetail={onDetail}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  rowBot: {
    alignItems: 'flex-start',
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
  },
  bubbleBot: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 4,
  },
  bubbleWide: {
    maxWidth: '100%',
  },
  bubbleUser: {
    backgroundColor: colors.parentA,
    borderTopRightRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  textBot: {
    color: colors.text,
  },
  textUser: {
    color: '#FFFFFF',
  },
  chipsContainer: {
    marginTop: 4,
    maxWidth: '85%',
  },
});

const cardStyles = StyleSheet.create({
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    marginTop: 8,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  carousel: {
    paddingVertical: 8,
  },
  info: {
    backgroundColor: colors.parentALight,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.parentA,
    lineHeight: 18,
  },
});
