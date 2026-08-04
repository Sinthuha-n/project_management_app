'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';

interface ChatSearchResult {
  messageId: number;
  highlightedContent?: string;
  content?: string;
  senderName?: string;
  sender?: string;
  context?: string;
  deepLinkUrl: string;
  roomId?: number | null;
  timestamp?: string | null;
}

interface ChatSearchPanelProps {
  showSearch: boolean;
  phaseDEnabled: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onExecuteSearch: () => Promise<void>;
  isSearchLoading: boolean;
  searchResults: ChatSearchResult[];
  onOpenResult: (result: ChatSearchResult) => Promise<void>;
}

export function ChatSearchPanel({
  showSearch,
  phaseDEnabled,
  searchQuery,
  onSearchQueryChange,
  onExecuteSearch,
  isSearchLoading,
  searchResults,
  onOpenResult,
}: ChatSearchPanelProps) {
  return (
    <AnimatePresence>
      {phaseDEnabled && showSearch && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-b border-cu-border bg-cu-bg"
        >
          <div className="px-5 py-3 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-cu-bg-secondary border border-cu-border rounded-xl px-3 py-2 focus-within:border-[var(--cu-focus-border)] focus-within:ring-2 focus-within:ring-[var(--cu-focus-ring)] transition-all">
              <Search size={14} className="text-cu-text-muted flex-shrink-0" strokeWidth={2.5} />
              <input
                type="text"
                id="chat-search-input"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void onExecuteSearch()}
                placeholder="Search all messages..."
                className="flex-1 bg-transparent text-[13px] text-cu-text-primary placeholder:text-cu-text-muted outline-none"
                aria-label="Search all chat messages"
                autoFocus
              />
            </div>
            <button
              onClick={() => void onExecuteSearch()}
              disabled={isSearchLoading || !searchQuery.trim()}
              className="px-4 py-2 rounded-xl bg-cu-primary hover:bg-cu-primary-dark text-white text-[12.5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Submit search"
            >
              {isSearchLoading ? '...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="px-5 pb-3 space-y-1 max-h-56 overflow-y-auto" role="listbox" aria-label="Search results">
              {searchResults.slice(0, 10).map((result) => (
                <button
                  key={result.messageId}
                  onClick={() => void onOpenResult(result)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-cu-bg-secondary transition-colors border border-transparent hover:border-cu-border"
                  role="option"
                  aria-selected="false"
                  aria-label={`Message from ${result.senderName ?? result.sender ?? 'unknown'}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                      {result.context ?? (result.roomId ? 'ROOM' : 'CHAT')}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-600">{result.senderName ?? result.sender ?? 'unknown'}</span>
                  </div>
                  <p className="text-[12.5px] text-gray-700 truncate">{result.highlightedContent ?? result.content ?? ''}</p>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
