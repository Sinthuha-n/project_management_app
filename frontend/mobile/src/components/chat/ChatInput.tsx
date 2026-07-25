import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Text,
  ScrollView,
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import * as DocumentPicker from 'expo-document-picker';
import { CHAT_ATTACHMENT_MIME_TYPES, uploadChatDocument } from '../../services/chatService';
import { apiErrorMessage } from '../../utils/apiError';

interface ChatInputProps {
  onSendMessage: (msg: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  enableMentions?: boolean;
  mentionCandidates?: string[];
  projectId: string;
}

const COMMON_EMOJIS = [
  '👍', '❤️', '🔥', '✅', '😂', '🎉', '😊', '🙌',
  '🚀', '✨', '👀', '💯', '🤔', '👋', '😢', '😮',
  '👏', '💪', '🙏', '🤝', '🎈', '🎁', '📅', '📌',
  '💬', '🔔', '📢', '📁', '📄', '📎', '🔗', '🛠',
  '💻', '📱', '⌚', '📷', '🎨', '🎬', '🎧', '🎮',
  '🌟', '🌙', '☀️', '🌈', '🔥', '🌊', '🍀', '🍎',
];

const AVATAR_COLORS = ['#155DFC', '#9810FA', '#16A34A', '#F59E0B', '#EF4444'];

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

const CHAR_WARN_THRESHOLD = 180;
const CHAR_MAX = 256;

export function ChatInput(props: ChatInputProps) {
  const insets = useSafeAreaInsets();
  const {
    onSendMessage,
    onTypingChange,
    disabled,
    placeholder,
    enableMentions,
    mentionCandidates = [],
    projectId,
  } = props;

  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const sendScale = useSharedValue(1);
  const emojiTranslateY = useSharedValue(260);
  const focusAnim = useSharedValue(0);
  const shimmerAnim = useSharedValue(0);

  // Focus ring animation
  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 180 });
  }, [isFocused, focusAnim]);

  // Emoji panel slide animation
  useEffect(() => {
    emojiTranslateY.value = withSpring(showEmojiPicker ? 0 : 260, {
      damping: 22,
      stiffness: 220,
    });
  }, [showEmojiPicker, emojiTranslateY]);

  // Upload shimmer
  useEffect(() => {
    if (uploading) {
      shimmerAnim.value = withRepeat(
        withTiming(1, { duration: 900 }),
        -1,
        true,
      );
    } else {
      shimmerAnim.value = 0;
    }
  }, [uploading, shimmerAnim]);

  const animatedSendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const animatedEmojiStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: emojiTranslateY.value }],
  }));

  const animatedInputBorder = useAnimatedStyle(() => ({
    borderColor: focusAnim.value === 1
      ? Colors.focusBorder
      : '#E5E7EB',
    borderWidth: interpolate(focusAnim.value, [0, 1], [1.2, 2]),
  }));

  const handleTextChange = (text: string) => {
    if (text.length > CHAR_MAX) return;
    setInput(text);

    if (text.trim()) {
      sendScale.value = withSequence(
        withSpring(1.12, { damping: 10, stiffness: 300 }),
        withSpring(1, { damping: 15 }),
      );
    }

    if (enableMentions) {
      const match = text.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
      setMentionQuery(match ? match[2].toLowerCase() : null);
    }

    if (onTypingChange) {
      onTypingChange(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTypingChange(false), 2000);
    }
  };

  const handleSend = useCallback(() => {
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      setInput('');
      setMentionQuery(null);
      if (onTypingChange) onTypingChange(false);
    }
  }, [input, disabled, onSendMessage, onTypingChange]);

  const handleAttach = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: CHAT_ATTACHMENT_MIME_TYPES,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setUploading(true);
        try {
          const url = await uploadChatDocument(projectId, asset);
          onSendMessage(url);
        } finally {
          setUploading(false);
        }
      }
    } catch (err) {
      console.error('File picker error:', err);
      Alert.alert('File not uploaded', apiErrorMessage(err, 'Please choose a supported file and try again.'));
      setUploading(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const insertMention = (user: string) => {
    const lastAt = input.lastIndexOf('@');
    setInput(input.slice(0, lastAt) + '@' + user + ' ');
    setMentionQuery(null);
  };

  const filteredMentions = mentionCandidates.filter(u =>
    u.toLowerCase().includes(mentionQuery ?? '')
  );

  const onContainerLayout = (e: LayoutChangeEvent) => {
    setContainerHeight(e.nativeEvent.layout.height);
  };

  const charsLeft = CHAR_MAX - input.length;
  const showCharCount = input.length >= CHAR_WARN_THRESHOLD;

  return (
    <View>
      {/*
       * Emoji sheet — positioned absolutely above the input bar.
       * translateY:260 parks it behind the input; 0 reveals it.
       */}
      <Animated.View
        style={[
          styles.emojiSheet,
          animatedEmojiStyle,
          { bottom: containerHeight, pointerEvents: showEmojiPicker ? 'auto' : 'none' },
        ]}
      >
        <View style={styles.emojiHandle} />
        <View style={styles.emojiHeader}>
          <Text style={styles.emojiHeaderText}>Emoji</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.emojiGrid}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {COMMON_EMOJIS.map((emoji, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.emojiBtn}
              onPress={() => insertEmoji(emoji)}
              activeOpacity={0.65}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Input bar — renders after emoji sheet so it sits on top */}
      <View
        style={[styles.container, { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : (insets.bottom > 100 ? 8 : Math.max(insets.bottom, 8)) }]}
        onLayout={onContainerLayout}
      >
        {uploading && (
          <View style={styles.uploadBanner}>
            <Ionicons name="cloud-upload-outline" size={16} color={Colors.bannerAmberText} />
            <Text style={styles.uploadText}>Uploading file…</Text>
            <ActivityIndicator size="small" color={Colors.bannerAmberText} />
            <TouchableOpacity style={styles.uploadDismiss} onPress={() => setUploading(false)}>
              <Ionicons name="close" size={16} color={Colors.bannerAmberText} />
            </TouchableOpacity>
          </View>
        )}

        <Animated.View style={[styles.inputPill, animatedInputBorder]}>
          {/* Emoji toggle */}
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            onPress={() => {
              setShowEmojiPicker(v => !v);
              if (!showEmojiPicker) setIsFocused(false);
            }}
          >
            <Ionicons
              name={showEmojiPicker ? 'happy' : 'happy-outline'}
              size={22}
              color={showEmojiPicker ? Colors.primary : Colors.textSecondary}
            />
          </Pressable>

          <TextInput
            style={styles.textInput}
            placeholder={placeholder ?? 'Type a message...'}
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={handleTextChange}
            onFocus={() => { setIsFocused(true); setShowEmojiPicker(false); }}
            onBlur={() => setIsFocused(false)}
            multiline
            editable={!disabled}
            returnKeyType="default"
            blurOnSubmit={false}
          />

          <View style={styles.rightIcons}>
            {showCharCount && (
              <Text style={[styles.charCount, charsLeft <= 20 && styles.charCountWarn]}>
                {charsLeft}
              </Text>
            )}

            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              onPress={handleAttach}
            >
              <Ionicons name="attach-outline" size={22} color={Colors.textSecondary} />
            </Pressable>

            <Animated.View style={animatedSendStyle}>
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim() || !!disabled}
                activeOpacity={0.82}
              >
                {input.trim() && !disabled ? (
                  <LinearGradient
                    colors={[Colors.gradientStart, Colors.gradientMid]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sendBtn}
                  >
                    <Ionicons name="send" size={16} color={Colors.white} />
                  </LinearGradient>
                ) : (
                  <View style={[styles.sendBtn, styles.sendBtnDisabled]}>
                    <Ionicons name="send" size={16} color={Colors.textMuted} />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>

      {/*
       * Mention dropdown — renders last so it sits above the input bar.
       * bottom: containerHeight keeps it anchored just above the input area.
       */}
      {mentionQuery !== null && filteredMentions.length > 0 && (
        <View style={[styles.mentionDropdown, { bottom: containerHeight }]}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            style={{ maxHeight: 180 }}
            showsVerticalScrollIndicator={false}
          >
            {filteredMentions.map(user => (
              <TouchableOpacity
                key={user}
                style={styles.mentionRow}
                onPress={() => insertMention(user)}
                activeOpacity={0.75}
              >
                <View style={[styles.mentionAvatar, { backgroundColor: getAvatarColor(user) }]}>
                  <Text style={styles.mentionAvatarText}>{user.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.mentionTextCol}>
                  <Text style={styles.mentionName}>@{user}</Text>
                  <Text style={styles.mentionSub}>Tap to mention</Text>
                </View>
                <Ionicons name="at-outline" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.chatHeaderBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.chatDivider,
    paddingHorizontal: 10,
    paddingTop: 10,
  },

  // ── Input pill ────────────────────────────────────────────────────────────────
  inputPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.chatInputBg,
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: '#E5E7EB',
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 4,
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },

  iconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    fontSize: 15.5,
    color: Colors.textPrimary,
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 9 : 7,
    paddingBottom: Platform.OS === 'ios' ? 9 : 7,
    lineHeight: 20,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  charCount: {
    fontSize: 11,
    color: Colors.textMuted,
    minWidth: 22,
    textAlign: 'center',
  },
  charCountWarn: {
    color: '#EF4444',
    fontWeight: '600',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  sendBtnDisabled: {
    backgroundColor: '#F3F4F6',
    shadowOpacity: 0,
    elevation: 0,
  },

  // ── Upload banner ─────────────────────────────────────────────────────────────
  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bannerAmberBg,
    padding: 9,
    borderRadius: 10,
    marginBottom: 8,
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.bannerAmberBorder,
  },
  uploadText: {
    flex: 1,
    fontSize: 13,
    color: Colors.bannerAmberText,
    fontWeight: '500',
  },
  uploadDismiss: {
    padding: 2,
  },

  // ── Emoji bottom sheet ────────────────────────────────────────────────────────
  emojiSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
    }),
  },
  emojiHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderDefault,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  emojiHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.chatDivider,
    marginBottom: 4,
  },
  emojiHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  emojiBtn: {
    width: '12.5%',
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  emojiText: {
    fontSize: 24,
  },

  // ── Mention dropdown ──────────────────────────────────────────────────────────
  mentionDropdown: {
    position: 'absolute',
    left: 10,
    right: 10,
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      android: { elevation: 10 },
    }),
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
    gap: 10,
  },
  mentionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  mentionAvatarText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  mentionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  mentionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
