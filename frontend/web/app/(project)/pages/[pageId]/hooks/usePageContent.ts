'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageItem } from '../../components/types';
import { predefinedTemplates } from '../../data/templates';
import { usePages } from '../../components/usePages';
import { pagesApi, PageVersionDto } from '@/services/api-contract';

export function usePageContent(pageId: string, projectId: string | null) {
    const searchParams = useSearchParams();
    // The literal string "new" is the route convention for a draft — no numeric ID exists yet
    const isDraft = pageId === 'new';

    const [selectedPage, setSelectedPage] = useState<PageItem | null>(null);
    const [title, setTitle] = useState('');
    const [loadingPage, setLoadingPage] = useState(false);
    const [versions, setVersions] = useState<PageVersionDto[]>([]);

    const {
        filteredPages, error, searchQuery, setSearchQuery,
        updatePage, createPage, deletePage, refetch,
        toggleStar, movePage,
    } = usePages(projectId);

    useEffect(() => {
        if (!pageId) return;

        if (isDraft) {
            // Template ID comes from the URL so the template choice survives navigation without being stored in state
            const templateId = searchParams.get('template') || 'blank';
            const template = predefinedTemplates.find(t => t.id === templateId) ?? predefinedTemplates[0];
            const defaultTitle = template.id === 'blank' ? 'Untitled Page' : template.name;
            queueMicrotask(() => {
                setSelectedPage({ id: 'new', title: defaultTitle, content: template.content, isStarred: false });
                setTitle(defaultTitle);
                setVersions([]);
            });
            return;
        }

        const fetchPageDetail = async () => {
            setLoadingPage(true);
            try {
                const response = await pagesApi.get(pageId);
                if (projectId) {
                    void pagesApi.markViewed(projectId, pageId);
                }
                const pageData: PageItem = {
                    id: response.id,
                    title: response.title,
                    content: response.content || '',
                    updatedAt: response.updatedAt,
                    isStarred: response.isStarred || false,
                };
                // Both updates inside an async callback — not synchronous setState in effect body
                setSelectedPage(pageData);
                setTitle(pageData.title);

                // Fetch actual page version history if page is not a draft and projectId is available
                if (projectId) {
                    const versionsData = await pagesApi.getVersions(projectId, pageId);
                    setVersions(versionsData);
                } else {
                    setVersions([]);
                }
            } catch (err) {
                console.error('Error fetching page:', err);
            } finally {
                setLoadingPage(false);
            }
        };

        queueMicrotask(() => void fetchPageDetail());
    }, [pageId, projectId, isDraft, searchParams]);

    return {
        selectedPage, setSelectedPage,
        title, setTitle,
        loadingPage,
        versions, setVersions,
        isDraft,
        filteredPages, error, searchQuery, setSearchQuery,
        updatePage, createPage, deletePage, refetch,
        toggleStar, movePage,
    };
}
