'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { pagesApi, type PageDetailDto, type PageSummaryDto } from '@/services/api-contract';

import { PageItem } from './types';
export type { PageItem };

interface UsePagesReturn {
  pages: PageItem[];
  filteredPages: PageItem[];
  loading: boolean;
  error: string | null;
  activeTab: 'all' | 'starred' | 'recent';
  setActiveTab: (tab: 'all' | 'starred' | 'recent') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  createPage: (title: string, content: string) => Promise<PageItem>;
  updatePage: (pageId: string | number, title: string, content: string) => Promise<PageItem>;
  deletePage: (pageId: string | number) => Promise<void>;
  refetch: () => Promise<void>;
  toggleStar: (pageId: string | number) => Promise<void>;
  movePage: (pageId: string | number, parentPageId: string | number | null) => Promise<void>;
}

const PAGES_CACHE_VERSION = 2;
const PAGES_CACHE_TTL_MS = 5 * 60 * 1000;

interface PagesCacheEnvelope {
  version: number;
  projectId: string;
  timestamp: number;
  pages: PageItem[];
}

const getPagesCacheKey = (projectId: string | number) => `planora:pages:${projectId}`;

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const toPageItem = (page: PageSummaryDto | PageDetailDto, existing?: PageItem): PageItem => ({
  id: page.id,
  title: page.title,
  parentId: page.parentPageId ?? existing?.parentId ?? null,
  isStarred: page.isStarred ?? existing?.isStarred ?? false,
  updatedAt: page.updatedAt ?? existing?.updatedAt,
});

const toStatePageItem = (page: PageDetailDto, existing?: PageItem): PageItem => ({
  ...toPageItem(page, existing),
  content: page.content,
  createdAt: page.createdAt,
});

const toCachedPageItem = (page: PageItem): PageItem => ({
  id: page.id,
  title: page.title,
  parentId: page.parentId ?? null,
  isStarred: page.isStarred ?? false,
  updatedAt: page.updatedAt,
});

const readPagesCache = (projectId: string | number): PageItem[] | null => {
  if (!isBrowser()) return null;

  const cacheKey = getPagesCacheKey(projectId);
  const cached = window.localStorage.getItem(cacheKey);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached) as PagesCacheEnvelope | PageItem[];
    if (Array.isArray(parsed)) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    if (
      parsed.version !== PAGES_CACHE_VERSION ||
      parsed.projectId !== String(projectId) ||
      Date.now() - parsed.timestamp > PAGES_CACHE_TTL_MS ||
      !Array.isArray(parsed.pages)
    ) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    return parsed.pages.map(toCachedPageItem);
  } catch {
    window.localStorage.removeItem(cacheKey);
    return null;
  }
};

const writePagesCache = (projectId: string | number | null, pages: PageItem[]) => {
  if (!projectId || !isBrowser()) return;

  const envelope: PagesCacheEnvelope = {
    version: PAGES_CACHE_VERSION,
    projectId: String(projectId),
    timestamp: Date.now(),
    pages: pages.map(toCachedPageItem),
  };
  window.localStorage.setItem(getPagesCacheKey(projectId), JSON.stringify(envelope));
};

export function usePages(projectId: string | number | null): UsePagesReturn {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [recentPages, setRecentPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'starred' | 'recent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const pagesRef = useRef<PageItem[]>([]);

  const hydratePages = useCallback((nextPages: PageItem[]) => {
    pagesRef.current = nextPages;
    setPages(nextPages);
  }, []);

  const applyPages = useCallback((nextPages: PageItem[]) => {
    pagesRef.current = nextPages;
    setPages(nextPages);
    writePagesCache(projectId, nextPages);
  }, [projectId]);

  const updatePages = useCallback((updater: (prev: PageItem[]) => PageItem[]) => {
    setPages((prev) => {
      const nextPages = updater(prev);
      pagesRef.current = nextPages;
      writePagesCache(projectId, nextPages);
      return nextPages;
    });
  }, [projectId]);

  // Fetch all pages for the project
  const fetchPages = useCallback(async () => {
    if (!projectId) {
      setError('Project ID not found');
      return;
    }

    // Stale-while-revalidate: the sidebar populates instantly from cache while the fresh list loads in the background
    const cached = readPagesCache(projectId);
    if (cached) {
      hydratePages(cached);
      setLoading(false);
    }

    setError(null);
    try {
      const response = await pagesApi.listByProject(projectId);
      const pagesData = (response || []).map((page) => toPageItem(page));
      applyPages(pagesData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to fetch pages';
      if (!cached) setError(message);
      console.error('Error fetching pages:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, applyPages, hydratePages]);

  // Fetch pages on mount or when projectId changes
  useEffect(() => {
    queueMicrotask(() => void fetchPages());
  }, [projectId, fetchPages]);

  const fetchRecentPages = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await pagesApi.getRecent(projectId);
      const recentData = (response || []).map((page) => toPageItem(page));
      setRecentPages(recentData);
    } catch (err) {
      console.error('Error fetching recent pages:', err);
    }
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'recent') {
      queueMicrotask(() => void fetchRecentPages());
    }
  }, [activeTab, fetchRecentPages]);

  useEffect(() => {
    if (!projectId || !isBrowser()) return undefined;

    const cacheKey = getPagesCacheKey(projectId);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== cacheKey) return;
      const cachedPages = readPagesCache(projectId);
      if (cachedPages) hydratePages(cachedPages);
      void fetchPages();
    };
    const handleFocus = () => {
      void fetchPages();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [projectId, hydratePages, fetchPages]);

  // Filter pages based on active tab and search query
  const filteredPages = (activeTab === 'recent' ? recentPages : pages).filter((page) => {
    const matchesSearch = page.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    switch (activeTab) {
      case 'starred':
        return page.isStarred;
      case 'recent':
        return true;
      case 'all':
      default:
        return true;
    }
  });

  // Create a new page
  const createPage = async (title: string, content: string): Promise<PageItem> => {
    if (!projectId) throw new Error('Project ID not found');

    try {
      const response = await pagesApi.create(projectId, { title, content });
      const newPage = toStatePageItem(response);
      updatePages((prev) => [...prev, newPage]);
      return newPage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to create page';
      setError(message);
      throw new Error(message);
    }
  };

  // Update an existing page
  const updatePage = async (pageId: string | number, title: string, content: string): Promise<PageItem> => {
    try {
      const response = await pagesApi.update(pageId, {
        title,
        content,
      });
      const existingPage = pagesRef.current.find((p) => p.id === pageId);
      const updatedPage = toStatePageItem(response, existingPage);
      updatePages((prev) => prev.map((p) => (p.id === pageId ? updatedPage : p)));
      return updatedPage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to update page';
      setError(message);
      throw new Error(message);
    }
  };

  // Delete a page
  const deletePage = async (pageId: string | number): Promise<void> => {
    try {
      await pagesApi.delete(pageId);
      updatePages((prev) => prev.filter((p) => p.id !== pageId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to delete page';
      setError(message);
      throw new Error(message);
    }
  };

  // Toggle star status
  const toggleStar = async (pageId: string | number) => {
    if (!projectId) return;
    try {
      // Optimistic update
      updatePages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isStarred: !p.isStarred } : p)));
      setRecentPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isStarred: !p.isStarred } : p)));
      
      const response = await pagesApi.toggleStar(projectId, pageId);
      const isStarred = response.isStarred ?? false;
      updatePages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isStarred } : p)));
      setRecentPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isStarred } : p)));
    } catch (err) {
      console.error('Error toggling star:', err);
      // Revert optimistic update
      updatePages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isStarred: !p.isStarred } : p)));
      setRecentPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isStarred: !p.isStarred } : p)));
    }
  };

  // Move page status
  const movePage = async (pageId: string | number, parentPageId: string | number | null) => {
    if (!projectId) return;
    try {
      // Optimistic update
      updatePages((prev) => prev.map((p) => (p.id === pageId ? { ...p, parentId: parentPageId } : p)));
      const response = await pagesApi.movePage(projectId, pageId, parentPageId);
      updatePages((prev) => prev.map((p) => (p.id === pageId ? { ...p, parentId: response.parentPageId ?? null } : p)));
    } catch (err) {
      console.error('Error moving page:', err);
      refetch();
      throw err;
    }
  };

  // Refetch pages
  const refetch = fetchPages;

  return {
    pages,
    filteredPages,
    loading,
    error,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    createPage,
    updatePage,
    deletePage,
    refetch,
    toggleStar,
    movePage,
  };
}
