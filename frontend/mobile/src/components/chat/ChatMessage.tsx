import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Linking,
  FlatList, Dimensions, GestureResponderEvent,
} from 'react-native';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/src/constants/colors';
import { ChatMessage as ChatMessageType, ChatReactionSummary } from '../../types/chat';
import { avatarColor, formatTime } from '@/src/hooks/chat/chatUtils';
import { refreshChatDocument } from '../../services/chatService';
import { LinearGradient } from 'expo-linear-gradient';

const MAX_BUBBLE_WIDTH = Dimensions.get('window').width * 0.74;

interface ChatMessageProps {
  message: ChatMessageType;
  isMe: boolean;
  showAvatar: boolean;
  showDateSep?: string;
  userProfilePics: Record<string, string>;
  currentUser: string;
  currentUserAliases: string[];
  reactions: ChatReactionSummary[];
  onLongPress: (message: ChatMessageType, event: GestureResponderEvent, isMe: boolean) => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
  onOpenThread: (message: ChatMessageType) => void;
  isPinned?: boolean;
  projectId?: string;
}

function isFileUrl(content: string): boolean {
  return (
    (content.includes('s3') && content.includes('amazonaws.com')) ||
    (content.includes('X-Amz-Signature'))
  );
}

function getFileName(url: string): string {
  try {
    const p = new URL(url).pathname;
    const parts = p.split('/');
    const raw = decodeURIComponent(parts[parts.length - 1]) || 'Attachment';
    const cleaned = raw.replace(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/, '');
    return cleaned || raw || 'Attachment';
  } catch {
    return 'Attachment';
  }
}

function renderMentions(content: string, aliasSet: Set<string>): React.ReactNode {
  const parts = content.split(/(@[a-zA-Z0-9._-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const handle = part.slice(1).toLowerCase();
      const isMine = aliasSet.has(handle) || Array.from(aliasSet).some(a => a.split('@')[0] === handle);
      if (isMine) {
        return (
          <Text key={i} style={styles.mentionHighlight}>{part}</Text>
        );
      }
    }
    return <Text key={i}>{part}</Text>;
  });
}

// Derive a unique-per-user color for the sender name label
function senderNameColor(sender: string): string {
  const PALETTE = [
    '#155DFC', '#9810FA', '#16A34A', '#F59E0B',
    '#EF4444', '#0891B2', '#7C3AED', '#059669',
  ];
  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function ChatMessage({
  message, isMe, showAvatar, showDateSep,
  userProfilePics, currentUser, currentUserAliases,
  reactions, onLongPress, onToggleReaction, onOpenThread, isPinned,
  projectId,
}: ChatMessageProps) {
  if (message.type === 'JOIN' || message.type === 'LEAVE') return null;

  const isDeleted = !!message.deleted;
  const isEdited = !!message.editedAt;
  const isFile = !isDeleted && isFileUrl(message.content || '');
  const threadCount = (message as any).threadCount ?? message.replyCount ?? 0;
  const hasRead = !!(message as any).read;
  const isPending = message.syncStatus === 'pending' || message.syncStatus === 'syncing';
  const isFailed = message.syncStatus === 'failed';

  const aliasSet = new Set([
    currentUser.toLowerCase(),
    ...currentUserAliases.map(a => a.toLowerCase()),
  ]);

  const timeColor = isMe ? 'rgba(255,255,255,0.65)' : Colors.textMuted;
  const readTickColor = hasRead ? '#60A5FA' : 'rgba(255,255,255,0.65)';

  const handleOpenDocument = async (url: string) => {
    try {
      if (projectId) {
        const freshUrl = await refreshChatDocument(projectId, url);
        await Linking.openURL(freshUrl || url);
        return;
      }
    } catch {
      // If refresh fails (e.g. offline or unroutable), fallback to opening original URL
    }
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open document URL:', err);
    });
  };

  const renderAvatar = () => {
    if (!showAvatar) return <View style={styles.avatarSpacer} />;
    const pic = userProfilePics[message.sender];
    return (
      <View style={styles.avatarContainer}>
        {pic ? (
          <Image source={{ uri: pic }} style={styles.avatar} />
        ) : (
          <LinearGradient
            colors={[avatarColor(message.sender), avatarColor(message.sender + '2')]}
            style={styles.avatar}
          >
            <Text style={styles.avatarInitial}>{message.sender.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (isDeleted) {
      return <Text style={styles.deletedText}>This message was deleted</Text>;
    }
    if (isFile) {
      const name = getFileName(message.content);
      return (
        <TouchableOpacity
          activeOpacity={0.82}
          style={[
            styles.fileCard,
            isMe ? styles.fileCardMe : styles.fileCardOther,
          ]}
          onPress={() => handleOpenDocument(message.content)}
        >
          <View style={[styles.fileIconBadge, isMe ? styles.fileIconBadgeMe : styles.fileIconBadgeOther]}>
            <Ionicons
              name="document-text"
              size={22}
              color={isMe ? 'rgba(255,255,255,0.9)' : Colors.primary}
            />
          </View>
          <View style={styles.fileTextColumn}>
            <Text
              style={[styles.fileName, isMe ? styles.fileNameMe : styles.fileNameOther]}
              numberOfLines={2}
            >
              {name}
            </Text>
            <Text style={[styles.fileSubtext, isMe ? styles.fileSubtextMe : styles.fileSubtextOther]}>
              Tap to open
            </Text>
          </View>
          <Ionicons
            name="open-outline"
            size={14}
            color={isMe ? 'rgba(255,255,255,0.6)' : Colors.textMuted}
          />
        </TouchableOpacity>
      );
    }
    return (
      <Text style={[styles.contentText, isMe ? styles.myText : styles.otherText]}>
        {renderMentions(message.content, aliasSet)}
      </Text>
    );
  };

  const renderTimestampRow = () => (
    <View style={styles.timestampRow}>
      {isEdited && (
        <Text style={[styles.editedLabel, { color: timeColor }]}>(edited) </Text>
      )}
      <Text style={[styles.timeText, { color: timeColor }]}>{formatTime(message.timestamp)}</Text>
      {isMe && isFailed && (
        <Ionicons
          name="alert-circle"
          size={12}
          color="#FCA5A5"
          style={styles.tickIcon}
        />
      )}
      {isMe && !isFailed && (
        <Ionicons
          name={isPending ? 'time-outline' : hasRead ? 'checkmark-done' : 'checkmark'}
          size={12}
          color={isPending ? 'rgba(255,255,255,0.5)' : readTickColor}
          style={styles.tickIcon}
        />
      )}
    </View>
  );

  return (
    <Animated.View entering={FadeInDown.duration(220).springify().damping(18)} style={styles.wrapper}>
      {showDateSep && (
        <View style={styles.dateSep}>
          <View style={styles.dateLine} />
          <View style={styles.datePillContainer}>
            <Text style={styles.datePill}>{showDateSep}</Text>
          </View>
          <View style={styles.dateLine} />
        </View>
      )}

      {isPinned && (
        <View style={[styles.pinnedRow, isMe ? styles.pinnedRowRight : styles.pinnedRowLeft]}>
          <Ionicons name="pin" size={10} color={Colors.mentionAmber} />
          <Text style={styles.pinnedText}>Pinned</Text>
        </View>
      )}

      <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
        {!isMe && renderAvatar()}

        <View style={{ maxWidth: MAX_BUBBLE_WIDTH }}>
          {!isMe && showAvatar && (
            <Text style={[styles.senderName, { color: senderNameColor(message.sender) }]}>
              {message.sender}
            </Text>
          )}

          <TouchableOpacity onLongPress={(event) => onLongPress(message, event, isMe)} activeOpacity={0.87}>
            <View style={[
              styles.bubble,
              isMe ? styles.myBubble : styles.otherBubble,
              isPinned && styles.pinnedBubble,
            ]}>
              {renderContent()}
              {renderTimestampRow()}
              {isFailed && (
                <Text style={styles.failedText} numberOfLines={2}>
                  {message.failureReason || 'Failed to send. Tap to retry.'}
                </Text>
              )}
              <View style={isMe ? styles.tailMe : styles.tailOther} />
            </View>
          </TouchableOpacity>

          {reactions.length > 0 && (
            <FlatList
              data={reactions}
              horizontal
              keyExtractor={(_, i) => String(i)}
              showsHorizontalScrollIndicator={false}
              style={[styles.reactionsList, isMe ? styles.reactionsRight : styles.reactionsLeft]}
              renderItem={({ item: r }) => (
                <TouchableOpacity
                  style={[styles.reactionChip, r.reactedByCurrentUser && styles.reactionChipActive]}
                  onPress={() => message.id && onToggleReaction(message.id, r.emoji)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                  <Text style={[styles.reactionCount, r.reactedByCurrentUser && styles.reactionCountActive]}>
                    {r.count}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          {threadCount > 0 && (
            <TouchableOpacity
              style={[styles.threadLink, isMe ? styles.threadLinkRight : styles.threadLinkLeft]}
              onPress={() => onOpenThread(message)}
              activeOpacity={0.75}
            >
              <View style={styles.threadLinkInner}>
                <Ionicons name="chatbubbles-outline" size={13} color={Colors.primary} />
                <Text style={styles.threadLinkText}>
                  {threadCount} {threadCount === 1 ? 'reply' : 'replies'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 2 },

  dateSep: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 18, paddingHorizontal: 20,
  },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.chatDivider },
  datePillContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 8,
  },
  datePill: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  pinnedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingBottom: 2 },
  pinnedRowLeft: { justifyContent: 'flex-start' },
  pinnedRowRight: { justifyContent: 'flex-end' },
  pinnedText: { fontSize: 10, color: Colors.mentionAmber, fontWeight: '600' },

  row: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 2, alignItems: 'flex-end' },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },

  avatarContainer: { width: 34, height: 34, marginRight: 7, flexShrink: 0 },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 13, fontWeight: '700' },
  avatarSpacer: { width: 34, marginRight: 7 },

  senderName: { fontSize: 11.5, fontWeight: '700', marginBottom: 3, marginLeft: 4 },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 7,
    minWidth: 64,
    position: 'relative',
  },
  myBubble: {
    backgroundColor: Colors.chatBubbleMe,
    borderBottomRightRadius: 4,
    ...StyleSheet.create({
      shadow: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
        elevation: 3,
      },
    }).shadow,
  },
  otherBubble: {
    backgroundColor: Colors.chatBubbleOther,
    borderBottomLeftRadius: 4,
    ...StyleSheet.create({
      shadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 3,
        elevation: 1,
      },
    }).shadow,
  },
  pinnedBubble: { borderWidth: 1.5, borderColor: Colors.mentionAmber },

  tailMe: {
    position: 'absolute', right: -8, bottom: 0,
    width: 0, height: 0,
    borderTopWidth: 10, borderTopColor: Colors.chatBubbleMe,
    borderLeftWidth: 8, borderLeftColor: 'transparent',
  },
  tailOther: {
    position: 'absolute', left: -8, bottom: 0,
    width: 0, height: 0,
    borderTopWidth: 10, borderTopColor: Colors.chatBubbleOther,
    borderRightWidth: 8, borderRightColor: 'transparent',
  },

  contentText: { fontSize: 15.5, lineHeight: 22 },
  myText: { color: Colors.chatBubbleMeText },
  otherText: { color: Colors.chatBubbleOtherText },
  deletedText: { fontStyle: 'italic', fontSize: 14, color: Colors.textMuted },
  mentionHighlight: {
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    borderRadius: 4,
    overflow: 'hidden',
    paddingHorizontal: 3,
    fontWeight: '700',
  },

  timestampRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  editedLabel: { fontSize: 9, fontStyle: 'italic' },
  timeText: { fontSize: 10 },
  tickIcon: { marginLeft: 3 },
  failedText: {
    marginTop: 4,
    fontSize: 10,
    color: '#FCA5A5',
    fontWeight: '600',
  },

  // ── File card ─────────────────────────────────────────────────────────────────
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    maxWidth: 240,
  },
  fileCardMe: { backgroundColor: 'rgba(255,255,255,0.14)' },
  fileCardOther: { backgroundColor: '#EEF2FF' },
  fileIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  fileIconBadgeMe: { backgroundColor: 'rgba(255,255,255,0.18)' },
  fileIconBadgeOther: { backgroundColor: '#E0E7FF' },
  fileTextColumn: { flex: 1, minWidth: 0 },
  fileName: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  fileNameMe: { color: Colors.chatBubbleMeText },
  fileNameOther: { color: Colors.textPrimary },
  fileSubtext: { marginTop: 2, fontSize: 11 },
  fileSubtextMe: { color: 'rgba(255,255,255,0.7)' },
  fileSubtextOther: { color: Colors.textMuted },

  // ── Reactions ─────────────────────────────────────────────────────────────────
  reactionsList: { marginTop: 5 },
  reactionsLeft: { alignSelf: 'flex-start' },
  reactionsRight: { alignSelf: 'flex-end' },
  reactionChip: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    marginRight: 5,
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'transparent',
    gap: 3,
  },
  reactionChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  reactionCountActive: { color: Colors.primary, fontWeight: '700' },

  // ── Thread link ───────────────────────────────────────────────────────────────
  threadLink: { marginTop: 5, paddingHorizontal: 2 },
  threadLinkLeft: { alignSelf: 'flex-start' },
  threadLinkRight: { alignSelf: 'flex-end' },
  threadLinkInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  threadLinkText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  // ── Pinned banner (exported component) ───────────────────────────────────────
  pinnedBanner: {
    height: 42,
    backgroundColor: Colors.bannerAmberBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bannerAmberBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pinnedBannerPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  pinnedBannerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedBannerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.mentionAmber,
  },
  pinnedBannerPreview: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pinnedBannerClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});

interface PinnedMessageBannerProps {
  pinnedMessage: ChatMessageType | null;
  onPress: () => void;
  onDismiss: () => void;
}

export function PinnedMessageBanner({ pinnedMessage, onPress, onDismiss }: PinnedMessageBannerProps) {
  if (!pinnedMessage) return null;

  const preview = pinnedMessage.deleted ? 'This message was deleted' : pinnedMessage.content;

  return (
    <View style={styles.pinnedBanner}>
      <TouchableOpacity
        activeOpacity={0.82}
        style={styles.pinnedBannerPress}
        onPress={onPress}
      >
        <View style={styles.pinnedBannerLabelRow}>
          <Ionicons name="pin" size={13} color={Colors.mentionAmber} />
          <Text style={styles.pinnedBannerLabel}>Pinned</Text>
        </View>
        <Text
          style={styles.pinnedBannerPreview}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {preview}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.pinnedBannerClose}
        onPress={onDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
