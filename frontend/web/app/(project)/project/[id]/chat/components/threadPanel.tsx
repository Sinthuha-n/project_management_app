'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { ChatMessage, ChatReactionSummary } from './chat';
import { isFileDocument } from './chatMessage';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';

interface ThreadPanelProps {
  rootMessage: ChatMessage | null;
  threadMessages: ChatMessage[];
  userProfilePics?: Record<string, string>;
  reactionsByMessageId: Record<number, ChatReactionSummary[]>;
  onClose: () => void;
  onSendReply: (content: string) => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
}

const DEFAULT_REACTIONS = ['👍', '🔥', '✅', '🎉'];

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-sky-400 to-blue-500',
  'from-indigo-500 to-blue-600',
  'from-teal-400 to-emerald-500',
  'from-cyan-500 to-blue-600',
  'from-blue-400 to-indigo-500',
  'from-slate-400 to-slate-500',
];

const avatarColor = (name: string) =>
  AVATAR_COLORS[(name.charCodeAt(0) % AVATAR_COLORS.length)];

function formatTime(timestamp?: string | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const ThreadPanel = ({
  rootMessage,
  threadMessages,
  userProfilePics = {},
  reactionsByMessageId,
  onClose,
  onSendReply,
  onToggleReaction,
}: ThreadPanelProps) => {
  const [replyInput, setReplyInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const orderedMessages = useMemo(() => {
    if (!rootMessage) return [] as ChatMessage[];
    const root = threadMessages.find((m) => m.id === rootMessage.id) || rootMessage;
    const replies = threadMessages.filter((m) => m.id !== root.id);
    return [root, ...replies];
  }, [rootMessage, threadMessages]);

  // Track scroll position inside the thread panel.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Always scroll to bottom when the thread is first opened (root message change).
  useEffect(() => {
    if (!scrollRef.current) return;
    isAtBottomRef.current = true;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rootMessage?.id]);

  // Scroll to bottom on new replies only if already near the bottom.
  useEffect(() => {
    if (!scrollRef.current || !isAtBottomRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [threadMessages.length]);

  if (!rootMessage) return null;

  const handleSend = () => {
    const value = replyInput.trim();
    if (!value) return;
    onSendReply(value);
    setReplyInput('');
  };

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-cu-border bg-cu-bg shadow-cu-sm">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-cu-border flex-shrink-0 bg-cu-bg-secondary">
        <div>
          <h4 className="text-[14.5px] font-bold text-cu-text-primary flex items-center gap-2 tracking-tight">
            <MessageCircle size={16} className="text-cu-primary" strokeWidth={2.4} /> Thread
          </h4>
          <p className="text-[12px] text-cu-text-secondary font-medium">
            {Math.max(orderedMessages.length - 1, 0)} repl{orderedMessages.length === 2 ? 'y' : 'ies'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-cu-text-muted hover:text-cu-text-primary hover:bg-cu-bg-tertiary transition-colors"
          aria-label="Close thread panel"
          title="Close"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 scrollbar-thin">
        {orderedMessages.map((message, index) => {
          const isRoot = index === 0;
          const messageReactions = message.id ? (reactionsByMessageId[message.id] || []) : [];
          const isFile = !message.deleted && isFileDocument(message.content);
          const profilePicUrl = resolveProfilePhotoUrl(userProfilePics?.[message.sender]);

          return (
            <div key={`${message.id || 'tmp'}-${index}`}>
              {/* Root Separator showing chronological split */}
              {!isRoot && index === 1 && (
                <div className="flex items-center gap-3 mb-5 mt-2">
                  <div className="flex-1 h-px bg-cu-border" />
                  <span className="text-[11px] font-semibold text-cu-text-muted bg-cu-bg px-3 py-0.5 rounded-full border border-cu-border">
                    Replies
                  </span>
                  <div className="flex-1 h-px bg-cu-border" />
                </div>
              )}

              <div className={`group flex gap-3 rounded-xl ${isRoot ? 'mb-2 bg-cu-bg-secondary/80 p-3 ring-1 ring-cu-border' : ''}`}>
                {profilePicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profilePicUrl} alt={message.sender} className="w-8 h-8 rounded-full object-cover shadow-cu-sm flex-shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(message.sender || '')} flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0`}>
                    {(message.sender || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12.5px] font-bold text-cu-text-primary">{message.sender}</span>
                    {message.timestamp && (
                      <span className="text-[10.5px] text-cu-text-muted">
                        {formatTime(message.timestamp)}
                      </span>
                    )}
                  </div>

                  <div className="text-[13.5px] leading-relaxed text-cu-text-secondary font-medium">
                    {message.deleted ? (
                      <span className="text-cu-text-muted italic">This message was deleted</span>
                    ) : isFile ? (
                      <a href={message.content} target="_blank" rel="noopener noreferrer" className="text-cu-primary hover:text-cu-primary-hover flex items-center gap-1.5 bg-cu-primary/10 px-3 py-2 rounded-xl border border-cu-primary/20 inline-flex mt-1">
                        <span className="truncate max-w-[180px]">View Attachment</span>
                      </a>
                    ) : (
                      <span className="break-words whitespace-pre-wrap">{message.content}</span>
                    )}
                  </div>
                  
                  {message.editedAt && !message.deleted && (
                    <span className="text-[10px] text-cu-text-muted italic mt-1 block">edited</span>
                  )}

                  {!!message.id && !message.deleted && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {messageReactions.map((reaction) => (
                        <button
                          key={`${message.id}-${reaction.emoji}`}
                          onClick={() => onToggleReaction(message.id as number, reaction.emoji)}
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium border transition-all
                            ${reaction.reactedByCurrentUser
                              ? 'bg-cu-primary/10 border-cu-primary/25 text-cu-primary'
                              : 'bg-cu-bg-secondary border-cu-border text-cu-text-secondary hover:border-cu-primary/25'}`}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}
                      {/* Active hover area for quick reactions */}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                        {DEFAULT_REACTIONS.map((emoji) => (
                          <button
                            key={`${message.id}-pick-${emoji}`}
                            onClick={() => onToggleReaction(message.id as number, emoji)}
                            className="bg-cu-bg-secondary hover:bg-cu-bg-tertiary border border-cu-border rounded-full px-1.5 py-0.5 text-[12px] transition-transform hover:scale-110"
                            aria-label={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply input */}
      <div className="flex-shrink-0 border-t border-cu-border bg-cu-bg p-3">
        <div className="flex items-center gap-2 bg-cu-bg-secondary border border-cu-border rounded-xl px-2 py-1.5 focus-within:bg-cu-bg-tertiary focus-within:border-cu-primary/40 focus-within:ring-2 focus-within:ring-cu-primary/10 transition-all">
          <input
            type="text"
            placeholder="Reply in thread..."
            value={replyInput}
            onChange={(e) => setReplyInput(e.target.value)}
            className="flex-1 bg-transparent px-2 py-1 text-[13px] text-cu-text-primary placeholder:text-cu-text-muted outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
          />
          <button
            onClick={handleSend}
            disabled={!replyInput.trim()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
              ${replyInput.trim() 
                ? 'bg-cu-primary text-white hover:bg-cu-primary-dark'
                : 'bg-cu-bg-tertiary text-cu-text-muted cursor-not-allowed'}`}
          >
            <Send size={14} strokeWidth={2.5} style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>
    </aside>
  );
};
