'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PanelLeft, RefreshCw } from 'lucide-react';
import DocumentSidebar from './components/DocumentSidebar';
import TemplateSelector, { predefinedTemplates } from './components/TemplateSelector';
import { usePages } from './components/usePages';
import { Template } from './components/types';

export default function PagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL param is the authoritative source; localStorage fallback preserves the project context
  // when the user navigates here without a full URL (e.g. direct sidebar click after page refresh)
  const projectId = searchParams.get('projectId') || (typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null);

  const {
    pages,
    loading,
    filteredPages,
    error,
    refetch,
    setSearchQuery,
  } = usePages(projectId);

  const [searchInput, setSearchInput] = useState('');
  const [showDocSidebar, setShowDocSidebar] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput, setSearchQuery]);

  const handleTemplateSelect = (template: Template) => {
    try {
      router.push(projectId ? `/pages/new?projectId=${projectId}&template=${template.id}` : `/pages/new?template=${template.id}`);
    } catch (err) {
      console.error('Error selecting template:', err);
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-cu-bg-secondary">
        <div className="text-center">
          <p className="text-gray-500 font-outfit text-sm">Loading project information...</p>
        </div>
      </div>
    );
  }

  if (loading && pages.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-cu-bg-secondary p-4 md:p-6 gap-4">
        <div className="h-10 w-56 rounded-2xl bg-cu-bg-tertiary animate-pulse" />
        <div className="grid flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-cu-border bg-cu-bg p-4 shadow-cu-sm space-y-3 animate-pulse">
            <div className="h-4 w-32 rounded bg-cu-bg-tertiary" />
            {Array.from({ length: 6 }).map((_, item) => (
              <div key={item} className="h-12 rounded-xl bg-cu-bg-secondary" />
            ))}
          </div>
          <div className="rounded-2xl border border-cu-border bg-cu-bg p-5 shadow-cu-sm space-y-3 animate-pulse">
            <div className="h-5 w-48 rounded bg-cu-bg-tertiary" />
            <div className="h-3 w-80 rounded bg-cu-bg-secondary" />
            {Array.from({ length: 4 }).map((_, item) => (
              <div key={item} className="h-16 rounded-2xl bg-cu-bg-secondary" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row h-full w-full bg-white overflow-hidden">
        {/* Mobile sidebar toggle button */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 lg:hidden">
          <button
            onClick={() => setShowDocSidebar(s => !s)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <PanelLeft size={16} />
            {showDocSidebar ? 'Hide pages' : 'Show pages'}
          </button>
        </div>

        {/* Left Sidebar */}
        <div className={showDocSidebar ? 'flex' : 'hidden lg:flex'}>
          <DocumentSidebar
            pages={filteredPages}
            searchQuery={searchInput}
            onSearchChange={setSearchInput}
            projectId={projectId}
            selectedPageId={null}
            onCreateClick={() => handleTemplateSelect(predefinedTemplates[0])}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-0">
          <TemplateSelector 
            onSelect={handleTemplateSelect} 
          />
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-[var(--cu-z-toast)] max-w-sm rounded-xl border border-cu-danger/20 bg-cu-bg p-4 shadow-cu-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cu-danger/10 text-cu-danger">
              <RefreshCw size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-cu-text-primary">Failed to load pages</p>
              <p className="mt-1 text-xs text-cu-text-secondary">{error}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cu-primary px-3 py-2 text-xs font-semibold text-white hover:bg-cu-primary-hover transition-colors"
              >
                Retry fetch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
