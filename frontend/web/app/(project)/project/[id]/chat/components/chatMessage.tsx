'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Pencil, Trash2, MessageSquare, Pin, PinOff, FileText, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChatMessage, ChatReactionSummary } from './chat';
import { EditMessageModal, ConfirmDeleteModal } from './chatModals';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import api from '@/lib/axios';
import { avatarColor } from '@/hooks/chat/chat-utils';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';

interface ChatMessagesProps {
  projectId: string;
  messages: ChatMessage[];
  targetMessageId?: number | null;
  currentUser: string;
  currentUserAliases: string[];
  userProfilePics?: Record<string, string>;
  isPrivateChat?: boolean;
  activeRoomId?: number | null;
  pinnedMessageId?: number | null;
  reactionsByMessageId: Record<number, ChatReactionSummary[]>;
  onOpenThread: (message: ChatMessage) => void;
  onEditMessage: (messageId: number, content: string) => void;
  onDeleteMessage: (messageId: number) => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
  onPinRoomMessage?: (messageId: number | null) => void;
  typingUser?: string;
}

export const isFileDocument = (content: string) => {
  try {
    const url = new URL(content);
    const isS3Domain = url.hostname.includes('s3') && url.hostname.includes('amazonaws.com');
    const hasS3Signature = url.searchParams.has('X-Amz-Signature') && url.searchParams.has('X-Amz-Credential');
    return isS3Domain || hasS3Signature;
  } catch {
    return false;
  }
};

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '✅', '😂', '🎉'];



function formatTime(timestamp?: string | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(timestamp?: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function shouldShowDateSeparator(current: ChatMessage, previous?: ChatMessage): boolean {
  if (!previous) return true;
  const currentDate = new Date(current.timestamp || '').toDateString();
  const prevDate = new Date(previous.timestamp || '').toDateString();
  return currentDate !== prevDate;
}

function isGrouped(current: ChatMessage, previous?: ChatMessage): boolean {
  if (!previous) return false;
  if (current.sender !== previous.sender) return false;
  const diff = new Date(current.timestamp || '').getTime() - new Date(previous.timestamp || '').getTime();
  return diff < 120000; // 2 minutes
}

/** Renders message content with @mentions highlighted for the current user. */
function renderMentionContent(content: string, aliasSet: Set<string>): React.ReactNode {
  // Split on @word boundaries (word chars + dots/dashes/underscores)
  const parts = content.split(/(@[a-zA-Z0-9._-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const handle = part.slice(1).toLowerCase();
      const isMentionedUser = aliasSet.has(handle) || Array.from(aliasSet).some(a => a.split('@')[0] === handle);
      if (isMentionedUser) {
        return (
          <mark
            key={i}
            className="rounded bg-amber-500/15 px-0.5 font-semibold text-amber-500 not-italic"
            style={{ boxShadow: '0 0 0 1px rgba(251,191,36,0.4)' }}
          >
            {part}
          </mark>
        );
      }
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function messageIsMentioned(content: string | undefined | null, aliasSet: Set<string>): boolean {
  if (!content) return false;
  const mentions = content.match(/@([a-zA-Z0-9._-]+)/g) || [];
  return mentions.some(m => {
    const handle = m.slice(1).toLowerCase();
    return aliasSet.has(handle) || Array.from(aliasSet).some(a => a.split('@')[0] === handle);
  });
}

function TypingIndicator({ user, userProfilePics = {} }: { user: string; userProfilePics?: Record<string, string> }) {
  const profilePicUrl = resolveProfilePhotoUrl(userProfilePics?.[user]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-end gap-2.5 px-4 py-1"
    >
      {profilePicUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profilePicUrl} alt={user} className="w-7 h-7 rounded-full object-cover shadow-cu-sm flex-shrink-0" />
      ) : (
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(user)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
          {user.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-cu-border bg-cu-bg px-4 py-2.5 shadow-cu-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-cu-text-muted"
            style={{ animation: `typingBounce 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </motion.div>
  );
}

const ClockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1 mt-[1px] inline-block opacity-80">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

export const ChatMessages = ({
  projectId,
  messages,
  targetMessageId,
  currentUser,
  currentUserAliases,
  isPrivateChat,
  activeRoomId,
  pinnedMessageId,
  reactionsByMessageId,
  onOpenThread,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onPinRoomMessage,
  typingUser,
  userProfilePics = {},
}: ChatMessagesProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loadingFileId, setLoadingFileId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<number | null>(null);
  // Track whether the user is scrolled near the bottom so we don't interrupt
  // reading history when new messages arrive.
  const isAtBottomRef = useRef(true);
  // Stable ref to the virtualizer so scroll effects don't re-run on every render.
  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);

  const aliasSet = new Set([
    currentUser.toLowerCase(),
    ...currentUserAliases.map((a) => a.toLowerCase()),
  ]);

  const visibleMessages = messages.filter((msg) => msg.type !== 'JOIN' && !msg.parentMessageId);

  const rowVirtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    measureElement: el => el?.getBoundingClientRect().height ?? 120,
    overscan: 3,
  });

  // Keep the stable ref in sync with the latest virtualizer instance.
  virtualizerRef.current = rowVirtualizer;

  // Track user scroll position so we can decide whether to auto-scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      // Consider "at bottom" when within 80px of the end.
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to bottom when the active chat context switches (room / private / team).
  // This should always fire regardless of scroll position.
  useEffect(() => {
    isAtBottomRef.current = true;
    const virtualizer = virtualizerRef.current;
    if (!virtualizer || visibleMessages.length === 0) return;
    virtualizer.scrollToIndex(visibleMessages.length - 1, { align: 'end' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, isPrivateChat]);

  // Scroll to bottom when new messages arrive — but only if the user is already
  // near the bottom so we don't disrupt someone reading old messages.
  useEffect(() => {
    const virtualizer = virtualizerRef.current;
    if (!virtualizer || visibleMessages.length === 0) return;
    if (!isAtBottomRef.current) return;
    const t = setTimeout(() => virtualizer.scrollToIndex(visibleMessages.length - 1, { align: 'end' }), 50);
    return () => clearTimeout(t);
  }, [visibleMessages.length]);

  useEffect(() => {
    if (!targetMessageId) {
      return;
    }
    const targetIndex = visibleMessages.findIndex((message) => message.id === targetMessageId);
    if (targetIndex < 0) {
      return;
    }

    const virtualizer = virtualizerRef.current;
    if (!virtualizer) {
      return;
    }
    virtualizer.scrollToIndex(targetIndex, { align: 'center' });
  }, [targetMessageId, visibleMessages]);

  useEffect(() => {
    if (activeMessageId == null) return;
    if (!visibleMessages.some((message) => message.id === activeMessageId)) {
      setActiveMessageId(null);
    }
  }, [activeMessageId, visibleMessages]);

  const handleDocumentClick = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    originalUrl: string,
    messageId?: number
  ) => {
    e.preventDefault();
    if (!messageId) { window.open(originalUrl, '_blank'); return; }
    setLoadingFileId(messageId);
    try {
      const response = await api.get(`/api/projects/${projectId}/chat/messages/refresh-document`, {
        params: { url: originalUrl },
      });
      window.open(response.data, '_blank');
    } catch {
      window.open(originalUrl, '_blank');
    } finally {
      setLoadingFileId(null);
    }
  };

  if (visibleMessages.length === 0 && !typingUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-cu-primary/10 text-cu-primary flex items-center justify-center mb-4">
          <span className="text-3xl">💬</span>
        </div>
        <h3 className="mb-1 text-[15px] font-semibold text-cu-text-primary">No messages yet</h3>
        <p className="text-[13px] text-cu-text-muted">Be the first to say hello!</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onClick={() => setActiveMessageId(null)}
      className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 py-2.5 sm:py-4 space-y-0.5 overscroll-y-contain touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
          {rowVirtualizer.getVirtualItems().map((row) => {
            const idx = row.index;
            const msg = visibleMessages[idx];
            const prevMsg = idx > 0 ? visibleMessages[idx - 1] : undefined;
            const isMe = aliasSet.has((msg.sender || '').toLowerCase());
            const hasAvatar = !isMe && !isPrivateChat;
            const grouped = isGrouped(msg, prevMsg);
            const showSeparator = shouldShowDateSeparator(msg, prevMsg);
            const msgReactions = msg.id ? (reactionsByMessageId[msg.id] || []) : [];
            const isPinned = pinnedMessageId === msg.id;
            const fileDoc = !msg.deleted && isFileDocument(msg.content);
            const isLoadingFile = loadingFileId === msg.id;
            const isMentioned = !isMe && !msg.deleted && !fileDoc && messageIsMentioned(msg.content, aliasSet);
            const isActiveMessage = !!msg.id && activeMessageId === msg.id;
            const profilePicUrl = resolveProfilePhotoUrl(userProfilePics?.[msg.sender]);

            return (
              <div
                key={msg.id ?? `local-msg-${idx}`}
                data-index={idx}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${row.start}px)`,
                }}
              >
                {/* Date separator */}
              {showSeparator && (
                <div className="flex items-center gap-3 my-4">
                  <div className="h-px flex-1 bg-cu-border" />
                  <span className="rounded-full border border-cu-border bg-cu-bg px-3 py-1 text-[11px] font-semibold text-cu-text-muted">
                    {formatDateSeparator(msg.timestamp)}
                  </span>
                  <div className="h-px flex-1 bg-cu-border" />
                </div>
              )}

              <div
                className={`flex items-end ${hasAvatar ? 'gap-2.5' : 'gap-1.5'} relative ${grouped ? 'mt-0.5' : 'mt-3'} ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isMentioned ? 'pl-1.5 border-l-2 border-amber-400 rounded-l' : ''}`}
              >
                {/* Avatar */}
                {hasAvatar && (
                  <div className={`relative flex-shrink-0 ${grouped ? 'opacity-0' : 'opacity-100'}`}>
                    {profilePicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profilePicUrl} alt={msg.sender} className="w-7 h-7 rounded-full object-cover shadow-cu-sm" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(msg.sender || '')} flex items-center justify-center text-white text-xs font-bold`}>
                        {(msg.sender || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                {/* Bubble column */}
                <div className={`flex flex-col max-w-[82%] sm:max-w-[74%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender name (others, no group) */}
                  {!isMe && !grouped && !isPrivateChat && (
                    <span className="mb-1 ml-1 text-[11.5px] font-semibold text-cu-text-secondary">{msg.sender}</span>
                  )}

                  {/* Pinned badge */}
                  {isPinned && (
                    <span className="mb-1.5 flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500">
                      <Pin size={10} /> Pinned
                    </span>
                  )}

                  {/* Bubble + action bar wrapper */}
                  <div
                    onClick={(event) => {
                      event.stopPropagation();
                      if (msg.id) {
                        setActiveMessageId(msg.id);
                      }
                    }}
                    className="group/message relative cursor-pointer"
                  >
                    {/* Hover action bar */}
                    {!!msg.id && !msg.deleted && (
                      <div
                        className={`absolute bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} z-10 flex items-center gap-1 rounded-xl border border-cu-border bg-cu-bg px-2 py-2 shadow-cu-lg transition-opacity ${
                          isActiveMessage
                            ? 'opacity-100'
                            : 'pointer-events-none opacity-0 group-hover/message:pointer-events-auto group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100'
                        }`}
                      >
                        {/* Quick reactions */}
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => onToggleReaction(msg.id as number, emoji)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-all hover:scale-110 hover:bg-cu-hover active:scale-95"
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}

                        <div className="mx-0.5 h-4 w-px bg-cu-border" />

                        {/* Thread */}
                        <button
                          onClick={() => onOpenThread(msg)}
                          className="flex min-h-[36px] items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-cu-text-muted transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
                          title="Reply in thread"
                        >
                          <MessageSquare size={12} strokeWidth={2} />
                        </button>

                        {/* Pin/Unpin */}
                        {!!activeRoomId && onPinRoomMessage && (
                          <button
                            onClick={() => onPinRoomMessage(isPinned ? null : (msg.id as number))}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-cu-text-muted transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
                            title={isPinned ? 'Unpin' : 'Pin message'}
                          >
                            {isPinned ? <PinOff size={12} strokeWidth={2} /> : <Pin size={12} strokeWidth={2} />}
                          </button>
                        )}

                        {/* Edit / Delete own */}
                        {isMe && !msg.deleted && (
                          <>
                            {!fileDoc && (
                              <button
                                onClick={() => setEditingMessage(msg)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-cu-text-muted transition-colors hover:bg-cu-hover hover:text-cu-primary"
                                title="Edit"
                              >
                                <Pencil size={12} strokeWidth={2} />
                              </button>
                            )}
                            <button
                              onClick={() => setMessageToDelete(msg.id as number)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-cu-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                              title="Delete message"
                            >
                              <Trash2 size={12} strokeWidth={2} />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className={`
                      relative px-4 py-2.5 pr-14 pb-4 text-[13.5px] leading-relaxed shadow-cu-sm
                      ${msg.deleted
                        ? 'bg-cu-bg-secondary text-cu-text-muted italic rounded-2xl'
                        : !msg.id
                          ? 'bg-cu-primary/70 text-white opacity-80 rounded-2xl rounded-br-sm'
                          : isMe
                            ? 'bg-cu-primary text-white rounded-2xl rounded-br-sm'
                            : 'bg-cu-bg-secondary border border-cu-border text-cu-text-primary rounded-2xl rounded-bl-sm'
                      }
                    `}>
                      {msg.deleted ? (
                        <span>This message was deleted</span>
                      ) : fileDoc ? (
                        <a
                          href={msg.content}
                          onClick={(e) => handleDocumentClick(e, msg.content, msg.id as number)}
                          className={`flex items-center gap-2 font-medium ${isMe ? 'text-white/85 hover:text-white' : 'text-cu-primary hover:text-cu-primary-hover'}`}
                          aria-label={isLoadingFile ? 'Opening file...' : 'View File'}
                        >
                          {isLoadingFile
                            ? <Loader2 size={15} className="animate-spin" />
                            : <FileText size={15} />}
                          <span className="truncate max-w-[180px]">
                            {isLoadingFile ? 'Opening...' : 'View File'}
                          </span>
                        </a>
                      ) : (
                        <span className="break-words whitespace-pre-wrap">
                          {renderMentionContent(msg.content, aliasSet)}
                        </span>
                      )}

                      {/* Time + edited inside bubble */}
                      {!msg.deleted && (
                        <span className={`absolute bottom-1.5 right-3 flex items-center text-[10px] leading-none ${isMe ? 'text-white/70' : 'text-cu-text-muted'}`}>
                          {msg.editedAt && <span className="mr-1 italic">edited</span>}
                          {!msg.id ? (
                            <><ClockIcon /> Sending...</>
                          ) : msg.timestamp ? (
                            formatTime(msg.timestamp)
                          ) : null}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reactions row */}
                  {!!msg.id && !msg.deleted && msgReactions.length > 0 && (
                    <div
                      onClick={(event) => event.stopPropagation()}
                      className="flex flex-wrap gap-1 mt-1.5"
                    >
                      {msgReactions.map((reaction) => (
                        <button
                          key={`${msg.id}-${reaction.emoji}`}
                          onClick={() => onToggleReaction(msg.id as number, reaction.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium border transition-all
                            ${reaction.reactedByCurrentUser
                              ? 'bg-cu-primary/10 border-cu-primary/25 text-cu-primary'
                              : 'bg-cu-bg-secondary border-cu-border text-cu-text-secondary hover:border-cu-primary/25 hover:text-cu-text-primary'}`}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </div>
            );
          })}
      </div>

      {/* Typing indicator */}
      {typingUser && <TypingIndicator key="typing" user={typingUser} userProfilePics={userProfilePics} />}

      {/* Modals */}
      <EditMessageModal
        isOpen={editingMessage !== null}
        onClose={() => setEditingMessage(null)}
        initialContent={editingMessage?.content || ''}
        onSave={(newContent) => {
          if (editingMessage?.id) {
            onEditMessage(editingMessage.id, newContent);
          }
        }}
      />

      <ConfirmDeleteModal
        isOpen={messageToDelete !== null}
        onClose={() => setMessageToDelete(null)}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action is permanent and cannot be undone."
        onConfirm={() => {
          if (messageToDelete) onDeleteMessage(messageToDelete);
          setMessageToDelete(null);
        }}
      />
    </div>
  );
};
