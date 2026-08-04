'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback, ChangeEvent } from 'react';
import { Paperclip, Send, Smile, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { EmojiStyle, Theme } from 'emoji-picker-react';
import { CHAT_ATTACHMENT_ACCEPT, uploadChatDocument } from './uploadChatDocument';
import { useParams } from 'next/navigation';
import { toast } from '@/components/ui';

interface ChatInputProps {
  onSendMessage: (msg: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  enableMentions?: boolean;
  mentionCandidates?: string[];
}
const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => (
    <div className="w-[320px] h-[400px] flex items-center justify-center bg-cu-bg"><Loader2 className="animate-spin text-cu-text-muted" size={20} /></div>
  ),
});

export const ChatInput = ({
  onSendMessage,
  onTypingChange,
  disabled,
  placeholder,
  enableMentions,
  mentionCandidates = [],
}: ChatInputProps) => {
  const params = useParams();
  const projectId = params.id as string;
  const [input, setInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setUploading(true);
    try {
      const url = await uploadChatDocument(projectId, file);
      // Uploaded S3 URLs are the chat attachment contract: isFileDocument renders
      // them with attachment chrome in messages, threads, and conversation previews.
      onSendMessage(url);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Couldn't upload file. Please try again.",
        'error',
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const filteredMentionCandidates = useMemo(() => {
    if (!enableMentions || !showMentionList) return [] as string[];
    const q = mentionQuery.trim().toLowerCase();
    return mentionCandidates
      .filter((n) => !!n)
      .filter((n) => q.length === 0 || n.toLowerCase().includes(q))
      .slice(0, 6);
  }, [enableMentions, mentionCandidates, mentionQuery, showMentionList]);

  const updateMentionState = (value: string, caretIndex: number) => {
    if (!enableMentions) { setMentionQuery(''); setShowMentionList(false); return; }
    const prefix = value.slice(0, caretIndex);
    const match = prefix.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
    if (!match) { setMentionQuery(''); setShowMentionList(false); return; }
    setMentionQuery(match[2] || '');
    setShowMentionList(true);
  };

  const applyMention = (memberName: string) => {
    const caret = textareaRef.current?.selectionStart ?? input.length;
    const prefix = input.slice(0, caret);
    const suffix = input.slice(caret);
    const match = prefix.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
    if (!match) return;
    const leading = match[1] || '';
    const mentionStart = prefix.length - match[0].length + leading.length;
    const nextValue = `${prefix.slice(0, mentionStart)}@${memberName} ${suffix}`;
    setInput(nextValue);
    setMentionQuery('');
    setShowMentionList(false);
    onTypingChange?.(nextValue.trim().length > 0);
    textareaRef.current?.focus();
  };

  const handleSend = useCallback(() => {
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      setInput('');
      setMentionQuery('');
      setShowMentionList(false);
      onTypingChange?.(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [input, disabled, onSendMessage, onTypingChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && showMentionList && filteredMentionCandidates.length > 0) {
      e.preventDefault();
      applyMention(filteredMentionCandidates[0]);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Escape closes mention list
    if (e.key === 'Escape') {
      setShowMentionList(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setInput(nextValue);
    updateMentionState(nextValue, e.target.selectionStart ?? nextValue.length);
    onTypingChange?.(nextValue.trim().length > 0);

    // Auto-resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  };

  const canSend = input.trim().length > 0 && !disabled && !uploading;

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !emojiPickerRef.current?.contains(target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [showEmojiPicker]);

  return (
    <div
      className="relative flex-shrink-0 border-t border-cu-border bg-cu-bg/95 px-2 sm:px-4 py-3 mb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:mb-0 z-30 shadow-cu-sm supports-[backdrop-filter]:backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Mention dropdown */}
      {showMentionList && filteredMentionCandidates.length > 0 && (
        <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-4 mb-2 bg-cu-bg border border-cu-border rounded-2xl shadow-cu-lg overflow-hidden z-20">
          <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-bold text-cu-text-muted uppercase tracking-wider">
            Mention a teammate
          </div>
          {filteredMentionCandidates.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyMention(candidate)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] hover:bg-cu-bg-secondary transition-colors text-left"
              aria-label={`Mention ${candidate}`}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {candidate.charAt(0).toUpperCase()}
              </div>
              <span className="text-[13px] font-medium text-cu-text-primary">@{candidate}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className={`flex items-center gap-2 bg-cu-bg-secondary border rounded-2xl px-3 py-2.5 sm:py-2 transition-all
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'focus-within:bg-cu-bg-tertiary focus-within:border-[var(--cu-focus-border)] focus-within:ring-2 focus-within:ring-[var(--cu-focus-ring)]'}
        border-cu-border shadow-cu-sm`}>

        <div ref={emojiPickerRef} className="relative flex-shrink-0">
          {/* Emoji Picker Dropdown */}
          {showEmojiPicker && !disabled && (
            <div className="absolute bottom-[calc(100%+12px)] left-0 z-50 shadow-cu-lg rounded-2xl overflow-hidden border border-cu-border bg-cu-bg">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  const nextValue = input + emojiData.emoji;
                  setInput(nextValue);
                  setShowEmojiPicker(false);
                  onTypingChange?.(nextValue.trim().length > 0);
                  textareaRef.current?.focus();
                }}
                lazyLoadEmojis={true}
                emojiStyle={EmojiStyle.NATIVE}
                theme={Theme.DARK}
                searchDisabled={true}
                previewConfig={{ showPreview: false }}
                height={350}
                width={320}
              />
            </div>
          )}

          {/* Emoji placeholder button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={disabled}
            className={`w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all flex-shrink-0
              ${showEmojiPicker ? 'text-cu-primary bg-cu-primary/10' : 'text-cu-text-muted hover:text-cu-text-primary hover:bg-cu-bg-tertiary'}`}
            title="Emoji Picker"
            aria-label="Toggle emoji picker"
          >
            <Smile size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={CHAT_ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          aria-label="Attach a file"
        />

        {/* Attach button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-cu-text-muted hover:text-cu-text-primary hover:bg-cu-bg-tertiary transition-all flex-shrink-0"
          title="Attach file"
          aria-label="Attach file"
        >
          {uploading ? (
            <span className="w-4 h-4 border-2 border-cu-border border-t-cu-primary rounded-full animate-spin" />
          ) : (
            <Paperclip size={17} strokeWidth={2} />
          )}
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id="chat-input"
          value={input}
          onChange={handleInput}
          onClick={(e) => {
            const target = e.target as HTMLTextAreaElement;
            updateMentionState(target.value, target.selectionStart ?? target.value.length);
          }}
          onBlur={() => onTypingChange?.(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type a message...'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-[16px] sm:text-[14px] text-cu-text-primary placeholder:text-cu-text-muted outline-none resize-none leading-relaxed py-1 max-h-32 overflow-y-auto"
          aria-label="Message input"
          aria-multiline="true"
          aria-autocomplete="list"
          autoComplete="off"
        />

        {/* Send button */}
        <button
          id="chat-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          className={`w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-all duration-150
            ${canSend
              ? 'bg-cu-primary text-white hover:bg-cu-primary-dark shadow-cu-sm active:scale-95'
              : 'bg-cu-bg-tertiary text-cu-text-muted cursor-not-allowed'}`}
          aria-label="Send message"
          title="Send (Enter)"
        >
          <Send size={15} strokeWidth={2.5} />
        </button>
      </div>

      {/* Hint */}
      {!disabled && (
        <p className="hidden sm:block text-[10px] text-cu-text-muted text-center mt-1.5">
          <span className="font-medium">Enter</span> to send &middot; <span className="font-medium">Shift+Enter</span> for new line
        </p>
      )}
    </div>
  );
};
