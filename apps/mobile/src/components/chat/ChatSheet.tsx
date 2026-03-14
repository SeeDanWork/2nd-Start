import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import { ChatScreen } from './ChatScreen';
import { useChatStore } from '../../stores/chat';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function ChatSheet({ visible, onClose }: ChatSheetProps) {
  const startLifecycle = useChatStore((s) => s.startLifecycle);

  useEffect(() => {
    if (visible) {
      startLifecycle();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Grabber */}
        <View style={styles.grabberRow}>
          <View style={styles.grabber} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeIcon}>{'\u2715'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Chat</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Chat content */}
        <View style={styles.content}>
          <ChatScreen mode="lifecycle" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 8,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 100,
    backgroundColor: '#CCC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 17,
    color: colors.textSecondary,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.43,
  },
  content: {
    flex: 1,
  },
});
