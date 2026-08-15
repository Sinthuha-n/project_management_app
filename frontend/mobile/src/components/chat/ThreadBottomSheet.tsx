import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import { ChatMessage as ChatMessageType, ChatReactionSummary } from '../../types/chat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82;
const SWIPE_DISMISS_THRESHOLD = 80;
const SPRING_CONFIG = { damping: 20, stiffness: 230 };

interface ThreadBottomSheetProps {
  visible: boolean;
  rootMessage: ChatMessageType | null;
  threadMessages: ChatMessageType[];
  userProfilePics: Record<string, string>;
  reactionsByMessageId: Record<number, ChatReactionSummary[]>;
  currentUser: string;
  currentUserAliases?: string[];
  onClose: () => void;
  onSendReply: (content: string) => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
  projectId: string;
}

export function ThreadBottomSheet(props: ThreadBottomSheetProps) {
  const {
    visible,
    rootMessage,
    threadMessages,
    userProfilePics,
    reactionsByMessageId,
    currentUser,
    currentUserAliases = [],
    onClose,
    onSendReply,
    onToggleReaction,
    projectId,
  } = props;

  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);

  const replies = useMemo(() => {
    if (!rootMessage?.id) return threadMessages;
    return threadMessages.filter(message => message.id !== rootMessage.id);
  }, [rootMessage?.id, threadMessages]);

  const identitySet = useMemo(
    () => new Set([
      currentUser.trim().toLowerCase(),
      ...currentUserAliases.map(alias => alias.trim().toLowerCase()),
    ]),
    [currentUser, currentUserAliases],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = SCREEN_HEIGHT;
      translateY.value = withSpring(0, SPRING_CONFIG);
    } else if (mounted) {
      translateY.value = withSpring(SCREEN_HEIGHT, SPRING_CONFIG, finished => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [mounted, translateY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const closeWithAnimation = () => {
    translateY.value = withSpring(SCREEN_HEIGHT, SPRING_CONFIG, finished => {
      if (finished) runOnJS(onClose)();
    });
  };

  const handleGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    translateY.value = Math.max(event.nativeEvent.translationY, 0);
  };

  const handleGestureStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    const { state, translationY } = event.nativeEvent;
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return;

    if (translationY > SWIPE_DISMISS_THRESHOLD) {
      closeWithAnimation();
      return;
    }

    translateY.value = withSpring(0, SPRING_CONFIG);
  };

  if (!mounted || !rootMessage) return null;

  // On iOS, the KAV inside a Modal needs an offset for the top safe area
  const kavOffset = Platform.OS === 'ios' ? insets.top + 10 : 0;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={closeWithAnimation}>
      <Pressable style={styles.overlay} onPress={closeWithAnimation} />

      <PanGestureHandler
        activeOffsetY={10}
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleGestureStateChange}
      >
        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Drag handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="chatbubbles-outline" size={18} color={Colors.primary} />
              <Text style={styles.title}>Thread</Text>
            </View>
            <TouchableOpacity onPress={closeWithAnimation} style={styles.closeBtn} activeOpacity={0.75}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Quoted root message */}
          <QuotedRootMessage message={rootMessage} />

          {/* Reply count */}
          <View style={styles.replyCountRow}>
            <View style={styles.replyCountLine} />
            <Text style={styles.replyCount}>
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </Text>
            <View style={styles.replyCountLine} />
          </View>

          {/* Reply list */}
          <FlatList
            data={replies}
            inverted={false}
            keyExtractor={(item, index) => {
              if (item.localId) return `thread-reply-${item.localId}-${index}`;
              if (item.id) return `thread-reply-${item.id}-${index}`;
              return `thread-reply-${index}`;
            }}
            renderItem={({ item, index }) => (
              <ChatMessage
                message={item}
                isMe={identitySet.has((item.sender || '').trim().toLowerCase())}
                showAvatar={index === 0 || item.sender !== replies[index - 1]?.sender}
                userProfilePics={userProfilePics}
                currentUser={currentUser}
                currentUserAliases={currentUserAliases}
                reactions={item.id ? (reactionsByMessageId[item.id] || []) : []}
                onLongPress={() => {}}
                onToggleReaction={onToggleReaction}
                onOpenThread={() => {}}
                projectId={projectId}
              />
            )}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          />

          {/* Thread input with keyboard avoidance */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={kavOffset}
          >
            <View style={[styles.inputWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <ChatInput
                onSendMessage={onSendReply}
                onTypingChange={() => {}}
                placeholder="Reply in thread…"
                projectId={projectId}
                enableMentions={false}
                mentionCandidates={[]}
              />
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </PanGestureHandler>
    </Modal>
  );
}

function QuotedRootMessage({ message }: { message: ChatMessageType }) {
  const preview = message.deleted ? 'This message was deleted' : message.content;

  return (
    <View style={styles.rootCard}>
      <View style={styles.accentBar} />
      <View style={styles.rootContent}>
        <View style={styles.rootHeader}>
          <Text style={styles.rootSender} numberOfLines={1}>{message.sender}</Text>
          <View style={styles.originalBadge}>
            <Text style={styles.originalLabel}>Original</Text>
          </View>
        </View>
        <Text style={styles.rootPreview} numberOfLines={2}>{preview}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.chatDivider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  rootCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    padding: 12,
    margin: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  accentBar: {
    width: 3,
    borderRadius: 2,
    minHeight: 42,
    backgroundColor: Colors.primary,
  },
  rootContent: {
    flex: 1,
    minWidth: 0,
  },
  rootHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  rootSender: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  originalBadge: {
    backgroundColor: '#E0E7FF',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  originalLabel: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '700',
  },
  rootPreview: {
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.textSecondary,
  },

  replyCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  replyCountLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.chatDivider,
  },
  replyCount: {
    fontSize: 11.5,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  listContent: {
    paddingBottom: 8,
  },
  inputWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.chatDivider,
    backgroundColor: Colors.cardBg,
  },
});
