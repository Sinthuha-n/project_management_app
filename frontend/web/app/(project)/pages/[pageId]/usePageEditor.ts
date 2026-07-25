'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { usePageContent } from './hooks/usePageContent';
import { pagesApi } from '@/services/api-contract';
import TurndownService from 'turndown';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getValidToken, getUserFromToken, AUTH_TOKEN_CHANGED_EVENT } from '@/lib/auth';
import { resolveWebSocketBaseUrl } from '@/lib/realtime-url';
import { getApiBaseUrl } from '@/lib/api-base-url';
import api from '@/lib/axios';

const PALETTE = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // orange
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
];

function getStableColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

export function usePageEditor() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const pageId = params?.pageId as string;

  // Falls back to localStorage so projectId survives navigation events that strip query params
  const projectId = searchParams.get('projectId') || (typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null);

  const {
    selectedPage, setSelectedPage,
    title, setTitle,
    loadingPage,
    versions, setVersions,
    isDraft,
    filteredPages, error, searchQuery, setSearchQuery,
    updatePage, createPage, deletePage, refetch,
    toggleStar, movePage,
  } = usePageContent(pageId, projectId);

  // saveStatus starts as 'draft' for new pages, 'idle' otherwise
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle' | 'draft'>(
    () => (pageId === 'new' ? 'draft' : 'idle'),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDocSidebar, setShowDocSidebar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [collaborationUser, setCollaborationUser] = useState<{ name: string; color: string; avatar?: string } | null>(null);

  useEffect(() => {
    const fetchProfileAndSetUser = async () => {
      try {
        const tokenUser = getUserFromToken();
        if (!tokenUser) return;

        const response = await api.get('/api/user/profile');
        const profile = response.data;

        const name = profile.fullName || profile.username || tokenUser.username || tokenUser.email || 'Anonymous';
        const color = getStableColor(name);
        const avatar = profile.profilePicUrl || '';

        setCollaborationUser({ name, color, avatar });
      } catch (err) {
        console.error('Error fetching profile for collaboration:', err);
        const tokenUser = getUserFromToken();
        if (tokenUser) {
          const name = tokenUser.username || tokenUser.email || 'Anonymous';
          setCollaborationUser({
            name,
            color: getStableColor(name),
          });
        }
      }
    };

    void fetchProfileAndSetUser();
  }, []);

  useEffect(() => {
    if (isDraft || !pageId || pageId === 'new') {
       
      setYdoc(null);
      setProvider(null);
      return;
    }

    let wsProvider: WebsocketProvider | null = null;
    let doc: Y.Doc | null = null;

    const connect = () => {
      if (wsProvider) {
        wsProvider.disconnect();
        wsProvider.destroy();
      }
      if (doc) {
        doc.destroy();
      }

      doc = new Y.Doc();
      const backendUrl = getApiBaseUrl();
      const wsUrl = resolveWebSocketBaseUrl(backendUrl);
      const token = getValidToken();

      if (!token) return;

      if (typeof WebSocket === 'undefined') return;

      wsProvider = new WebsocketProvider(
        `${wsUrl}/yjs`,
        `page-${pageId}`,
        doc,
        {
          protocols: ['planora-yjs', `planora.jwt.${token}`],
          connect: true,
        }
      );

      setYdoc(doc);
      setProvider(wsProvider);
    };

    connect();

    const handleTokenChange = () => {
      connect();
    };

    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);

    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);
      if (wsProvider) {
        wsProvider.disconnect();
        wsProvider.destroy();
      }
      if (doc) {
        doc.destroy();
      }
      setYdoc(null);
      setProvider(null);
    };
  }, [pageId, isDraft]);

  // Tracks the latest editor HTML without waiting for the 800ms debounce.
  // Used by handleManualCreate so Publish always captures what the user typed.
  const latestContentRef = useRef<string>('');
  const setLatestContent = useCallback((html: string) => {
    latestContentRef.current = html;
  }, []);

  const handleUpdateContent = useCallback(async (htmlContent: string) => {
    if (!selectedPage || !projectId) return;
    setSelectedPage(prev => prev ? { ...prev, content: htmlContent } : null);
    if (isDraft) { setSaveStatus('draft'); return; }

    setSaveStatus('saving');
    try {
      await updatePage(selectedPage.id, title, htmlContent);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      
      const versionsData = await pagesApi.getVersions(projectId, selectedPage.id);
      setVersions(versionsData);
    } catch (err) {
      console.error('Error auto-saving:', err);
      setSaveStatus('error');
    }
  }, [selectedPage, title, projectId, updatePage, isDraft, setSelectedPage, setVersions]);

  // Debounced title save
  useEffect(() => {
    if (!selectedPage || title === selectedPage.title || !projectId) return;
    if (isDraft) { setSelectedPage(prev => prev ? { ...prev, title } : null); return; }

    const timeoutId = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updatePage(selectedPage.id, title, selectedPage.content || '');
        setSelectedPage(prev => prev ? { ...prev, title } : null);
        refetch();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);

        const versionsData = await pagesApi.getVersions(projectId, selectedPage.id);
        setVersions(versionsData);
      } catch (err) {
        console.error('Error auto-saving title:', err);
        setSaveStatus('error');
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [title, selectedPage, projectId, updatePage, refetch, isDraft, setSelectedPage, setVersions]);

  const handleManualCreate = async () => {
    if (!selectedPage || !projectId) return;
    setSaveStatus('saving');
    // Use latestContentRef to capture whatever is in the editor right now,
    // even if the 800ms debounce hasn't fired yet.
    const content = latestContentRef.current || selectedPage.content || '';
    try {
      const newPage = await createPage(title, content);
      setSaveStatus('saved');
      // replace() instead of push() so the Back button skips the blank draft and returns to the page list
      router.replace(projectId ? `/pages/${newPage.id}?projectId=${projectId}` : `/pages/${newPage.id}`);
    } catch (err) {
      console.error('Error creating document:', err);
      setSaveStatus('error');
    }
  };

  const handleDeletePage = () => {
    if (isDraft) {
      router.push(projectId ? `/pages?projectId=${projectId}` : '/pages');
      return;
    }
    if (!selectedPage) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedPage) return;
    setShowDeleteConfirm(false);
    try {
      await deletePage(selectedPage.id);
      router.push(projectId ? `/pages?projectId=${projectId}` : '/pages');
    } catch (err) {
      console.error('Error deleting page:', err);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPage) return;

    setLocalError(null);

    // Enforce max file size: 1MB
    const MAX_FILE_SIZE = 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setLocalError('File size exceeds the 1MB limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const isMd = file.name.endsWith('.md');
    const isHtml = file.name.endsWith('.html') || file.name.endsWith('.htm');

    if (!isMd && !isHtml) {
      setLocalError('Invalid file type. Only Markdown (.md) and HTML (.html) files are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let htmlContent = text;
        if (isMd) {
          const rawHtml = await marked.parse(text);
          htmlContent = typeof window !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;
        } else if (isHtml) {
          htmlContent = typeof window !== 'undefined' ? DOMPurify.sanitize(text) : text;
        }
        handleUpdateContent(htmlContent);
      } catch (err) {
        console.error('Error parsing file:', err);
        setLocalError('Failed to parse imported file.');
      }
    };
    reader.onerror = () => {
      setLocalError('Failed to read file.');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    if (!selectedPage) return;
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    const mdContent = turndownService.turndown(selectedPage.content || '');
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreVersion = async (versionId: string | number) => {
    if (!selectedPage || !projectId) return;
    setSaveStatus('saving');
    try {
      const restoredPage = await pagesApi.restoreVersion(projectId, selectedPage.id, versionId);
      setSelectedPage({
        id: restoredPage.id,
        title: restoredPage.title,
        content: restoredPage.content || '',
        updatedAt: restoredPage.updatedAt,
        isStarred: restoredPage.isStarred || false,
      });
      setTitle(restoredPage.title);

      const versionsData = await pagesApi.getVersions(projectId, selectedPage.id);
      setVersions(versionsData);

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Error restoring version:', err);
      setSaveStatus('error');
    }
  };

  return {
    pageId,
    isDraft,
    projectId,
    selectedPage,
    loadingPage,
    saveStatus,
    title, setTitle,
    showHistory, setShowHistory,
    versions,
    handleRestoreVersion,
    showDocSidebar, setShowDocSidebar,
    fileInputRef,
    filteredPages,
    error: error || localError,
    searchQuery, setSearchQuery,
    handleUpdateContent,
    setLatestContent,
    handleManualCreate,
    handleDeletePage,
    handleConfirmDelete,
    showDeleteConfirm, setShowDeleteConfirm,
    handleFileImport,
    handleExport,
    toggleStar,
    movePage,
    ydoc,
    provider,
    collaborationUser,
  };
}
