'use client';

// Component for global site-wide search across projects, tasks, documents, and members.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';

const RECENT_SEARCH_LIMIT = 6;

type SearchResultType = 'TASK' | 'DOCUMENT' | 'MEMBER' | 'PROJECT';

interface SearchResultBase {
  id: number;
  subtitle: string;
  url: string;
  type: SearchResultType;
}

interface TaskSearchResult extends SearchResultBase {
  id: number;
  title: string;
  projectName: string;
  status: string;
}

interface DocumentSearchResult extends SearchResultBase {
  id: number;
  title: string;
}

interface MemberSearchResult extends SearchResultBase {
  id: number;
  name: string;
}

interface ProjectSearchResult extends SearchResultBase {
  id: number;
  title: string;
}

interface GlobalSearchResult {
  tasks: TaskSearchResult[];
  documents: DocumentSearchResult[];
  members: MemberSearchResult[];
  projects: ProjectSearchResult[];
}

type FlattenedResult =
  | (TaskSearchResult & { section: 'tasks'; key: string })
  | (DocumentSearchResult & { section: 'documents'; key: string })
  | (MemberSearchResult & { section: 'members'; key: string })
  | (ProjectSearchResult & { section: 'projects'; key: string });

interface GlobalSearchProps {
  projectId?: string | null;
}

export default function GlobalSearch({ projectId }: GlobalSearchProps = {}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'PROJECT' | 'GLOBAL'>('PROJECT');

  useEffect(() => {
    setScope(projectId ? 'PROJECT' : 'GLOBAL');
  }, [projectId]);

  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const recentSearchStorageKey = useMemo(() => {
    const user = getUserFromToken();
    const identity = user?.userId ?? user?.email ?? 'anonymous';
    return `planora:global-search:recent:${identity}`;
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentSearchStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((item): item is string => typeof item === 'string').slice(0, RECENT_SEARCH_LIMIT));
        }
      }
    } catch {
      localStorage.removeItem(recentSearchStorageKey);
    }
  }, [recentSearchStorageKey]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runSearch = useCallback((value: string, currentScope: 'PROJECT' | 'GLOBAL', currentProjectId?: string | null) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const normalized = value.trim();

    if (normalized.length < 2) {
      setLoading(false);
      setResults(null);
      setSelectedIndex(-1);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params: { q: string; projectId?: string } = { q: normalized };
        if (currentScope === 'PROJECT' && currentProjectId && currentProjectId !== 'null') {
          params.projectId = currentProjectId;
        }
        const { data } = await api.get<GlobalSearchResult>('/api/search', { params });
        setResults(data);
        setSelectedIndex(-1);
      } catch (_err) {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    runSearch(query, scope, projectId);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, scope, projectId, runSearch]);

  const flatResults: FlattenedResult[] = useMemo(() => [
    ...(results?.projects?.map(item => ({ ...item, section: 'projects' as const, key: `project-${item.id}` })) || []),
    ...(results?.tasks?.map(item => ({ ...item, section: 'tasks' as const, key: `task-${item.id}` })) || []),
    ...(results?.documents?.map(item => ({ ...item, section: 'documents' as const, key: `document-${item.id}` })) || []),
    ...(results?.members?.map(item => ({ ...item, section: 'members' as const, key: `member-${item.id}` })) || []),
  ], [results]);

  const saveRecentSearch = useCallback((term: string) => {
    const normalized = term.trim();
    if (normalized.length < 2) return;

    setRecentSearches(prev => {
      const next = [
        normalized,
        ...prev.filter(item => item.toLowerCase() !== normalized.toLowerCase()),
      ].slice(0, RECENT_SEARCH_LIMIT);

      try {
        localStorage.setItem(recentSearchStorageKey, JSON.stringify(next));
      } catch {
        // Recent searches are a convenience; search should still work if storage is unavailable.
      }
      return next;
    });
  }, [recentSearchStorageKey]);

  const handleResultSelect = useCallback((result: FlattenedResult) => {
    saveRecentSearch(query);
    setIsOpen(false);
    setQuery('');
    router.push(result.url);
  }, [query, router, saveRecentSearch]);

  const handleRecentSearchSelect = useCallback((term: string) => {
    saveRecentSearch(term);
    setQuery(term);
    setResults(null);
    setIsOpen(true);
    setSelectedIndex(-1);
  }, [saveRecentSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const normalizedQuery = query.trim();
    const showingRecentSearches = normalizedQuery.length === 0 && recentSearches.length > 0;
    const navigableCount = showingRecentSearches ? recentSearches.length : flatResults.length;

    if (!isOpen || navigableCount === 0) {
      if (e.key === 'ArrowDown' && recentSearches.length > 0 && normalizedQuery.length === 0) {
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % navigableCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev === -1 ? navigableCount - 1 : (prev - 1 + navigableCount) % navigableCount));
        break;
      case 'Enter':
        e.preventDefault();
        if (showingRecentSearches && selectedIndex >= 0 && selectedIndex < recentSearches.length) {
          handleRecentSearchSelect(recentSearches[selectedIndex]);
        } else if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
          handleResultSelect(flatResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  }, [flatResults, handleRecentSearchSelect, handleResultSelect, isOpen, query, recentSearches, selectedIndex]);

  const isEmpty = !loading && query.trim().length >= 2 && flatResults.length === 0;
  const shouldShowRecentSearches = query.trim().length === 0 && recentSearches.length > 0;

  const renderIcon = (type: SearchResultType) => {
    if (type === 'TASK') {
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
    }
    if (type === 'DOCUMENT') {
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>;
    }
    if (type === 'PROJECT') {
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><rect x="7" y="7" width="3" height="10" /><rect x="14" y="7" width="3" height="6" /></svg>;
    }
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
  };

  const iconColorClass = (type: SearchResultType) => {
    if (type === 'TASK')     return 'bg-cu-primary/15 text-cu-primary';
    if (type === 'DOCUMENT') return 'bg-cu-warning/15 text-cu-warning';
    if (type === 'PROJECT')  return 'bg-violet-500/15 text-violet-500';
    return 'bg-cu-success/15 text-cu-success';
  };

  const renderSection = (title: string, items: FlattenedResult[], startOffset: number) => {
    if (items.length === 0) return null;

    return (
      <div>
        <div className="px-4 py-1.5 text-[10px] font-bold text-cu-text-muted uppercase tracking-widest">{title}</div>
        {items.map((item, idx) => {
          const absIndex = startOffset + idx;
          const isSelected = selectedIndex === absIndex;

          return (
            <button
              key={item.key}
              onClick={() => handleResultSelect(item)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors group text-left ${
                isSelected ? 'bg-cu-primary/10 border-l-2 border-l-cu-primary' : 'hover:bg-cu-hover'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColorClass(item.type)}`}>
                {renderIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-cu-text-primary truncate group-hover:text-cu-primary transition-colors">
                  {'title' in item ? item.title : item.name}
                </div>
                <div className="text-[11px] text-cu-text-secondary truncate">{item.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative flex-1 max-w-[480px] z-[var(--cu-z-dropdown)]" ref={searchRef}>
      <div className="relative w-full group">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-cu-text-muted z-10 group-focus-within:text-cu-primary transition-colors"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            const normalizedValue = value.trim();
            setQuery(value);
            setIsOpen(normalizedValue.length >= 2 || (normalizedValue.length === 0 && recentSearches.length > 0));
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const normalizedQuery = query.trim();
            if (normalizedQuery.length >= 2 || (normalizedQuery.length === 0 && recentSearches.length > 0)) {
              setIsOpen(true);
            }
          }}
          placeholder="Search projects, tasks, docs..."
          className="w-full bg-cu-bg-tertiary border border-transparent rounded-[10px] h-9 pl-10 pr-4 text-[13px] text-cu-text-primary outline-none focus:bg-cu-bg focus:border-cu-primary focus:ring-4 focus:ring-cu-primary/10 transition-all placeholder:text-cu-text-muted font-outfit"
        />

        {!query && (
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 5, ease: 'linear' }}
            className="absolute top-0 bottom-0 w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg] pointer-events-none"
          />
        )}
      </div>

      <AnimatePresence>
        {isOpen && (query.trim().length >= 2 || shouldShowRecentSearches) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-0 right-0 top-full mt-2 bg-cu-bg border border-cu-border rounded-xl shadow-cu-xl z-[var(--cu-z-dropdown)] overflow-hidden"
          >
            {projectId && (
              <div className="bg-cu-bg-secondary/80 border-b border-cu-border px-4 py-2.5 flex items-center gap-6">
                 <button
                    onClick={() => setScope('PROJECT')}
                    className="flex items-center gap-2 cursor-pointer group focus:outline-none"
                    type="button"
                 >
                    <div className={`flex items-center justify-center w-4 h-4 rounded-full border-2 transition-all shadow-sm ${scope === 'PROJECT' ? 'border-cu-primary bg-cu-primary' : 'border-cu-border bg-cu-bg'}`}>
                       {scope === 'PROJECT' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                    <span className={`text-[12px] font-semibold transition-colors ${scope === 'PROJECT' ? 'text-cu-text-primary' : 'text-cu-text-secondary group-hover:text-cu-text-primary'}`}>This Project</span>
                 </button>

                 <button
                    onClick={() => setScope('GLOBAL')}
                    className="flex items-center gap-2 cursor-pointer group focus:outline-none"
                    type="button"
                 >
                    <div className={`flex items-center justify-center w-4 h-4 rounded-full border-2 transition-all shadow-sm ${scope === 'GLOBAL' ? 'border-cu-primary bg-cu-primary' : 'border-cu-border bg-cu-bg'}`}>
                       {scope === 'GLOBAL' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                    <span className={`text-[12px] font-semibold transition-colors ${scope === 'GLOBAL' ? 'text-cu-text-primary' : 'text-cu-text-secondary group-hover:text-cu-text-primary'}`}>All Projects</span>
                 </button>
              </div>
            )}

            <div className="max-h-[400px] overflow-y-auto py-2">
              {shouldShowRecentSearches ? (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-bold text-cu-text-muted uppercase tracking-widest">Recent Searches</div>
                  {recentSearches.map((term, idx) => {
                    const isSelected = selectedIndex === idx;

                    return (
                      <button
                        key={term}
                        onClick={() => handleRecentSearchSelect(term)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors group text-left ${
                          isSelected ? 'bg-cu-primary/10 border-l-2 border-l-cu-primary' : 'hover:bg-cu-hover'
                        }`}
                        type="button"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-cu-bg-tertiary text-cu-text-muted">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 2" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-cu-text-primary truncate group-hover:text-cu-primary transition-colors">
                            {term}
                          </div>
                          <div className="text-[11px] text-cu-text-secondary truncate">Search again</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : loading ? (
                <div className="px-4 py-8 flex items-center justify-center gap-2 text-cu-text-secondary">
                  <span className="w-4 h-4 rounded-full border-2 border-cu-border border-t-cu-primary animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : flatResults.length > 0 ? (
                <>
                  {renderSection('Projects', (results?.projects || []).map(item => ({ ...item, section: 'projects', key: `project-${item.id}` })), 0)}
                  {renderSection('Tasks', (results?.tasks || []).map(item => ({ ...item, section: 'tasks', key: `task-${item.id}` })), results?.projects?.length || 0)}
                  {renderSection('Documents', (results?.documents || []).map(item => ({ ...item, section: 'documents', key: `document-${item.id}` })), (results?.projects?.length || 0) + (results?.tasks?.length || 0))}
                  {renderSection('Members', (results?.members || []).map(item => ({ ...item, section: 'members', key: `member-${item.id}` })), (results?.projects?.length || 0) + (results?.tasks?.length || 0) + (results?.documents?.length || 0))}
                </>
              ) : isEmpty ? (
                <div className="px-4 py-8 text-center">
                  <div className="text-cu-text-muted text-sm italic">No results for &quot;{query}&quot;</div>
                </div>
              ) : null}
            </div>

            {(flatResults.length > 0 || shouldShowRecentSearches) && (
              <div className="bg-cu-bg-secondary px-4 py-2 border-t border-cu-border flex items-center justify-between">
                <span className="text-[10px] text-cu-text-muted font-bold uppercase tracking-widest">
                  {shouldShowRecentSearches ? `${recentSearches.length} recent` : `${flatResults.length} results`}
                </span>
                <span className="text-[10px] text-cu-text-muted font-medium">
                  ↑↓ navigate • ↵ select • ⎋ close
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
