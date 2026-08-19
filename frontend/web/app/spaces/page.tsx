'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getUserFromToken, User } from '@/lib/auth';
import {
    buildSessionCacheKey,
    getSessionCache,
    setSessionCache,
} from '@/lib/session-cache';
import { useOnlineStatus } from '@/components/pwa/OnlineStatusProvider';
import { projectsApi } from '@/services/api-contract';
import RecentProjectCard from '../dashboard/components/recentspaces/RecentProjectCard';

import Link from 'next/link';
import { LayoutGrid, List } from 'lucide-react';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';
import { formatDate } from '@/lib/date-time';

const SPACES_PROJECTS_CACHE_TTL = 2 * 60_000;

interface SpaceProject {
    id: number;
    name: string;
    projectKey?: string;
    isFavorite?: boolean;
    favoriteMarkedAt?: string;
    type?: 'AGILE' | 'KANBAN' | string;
    updatedAt?: string;
    lastAccessedAt?: string;
    memberCount?: number;
}

function SpacesPageContent() {
    const { isOnline } = useOnlineStatus();
    const [projects, setProjects] = useState<SpaceProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [usingCachedData, setUsingCachedData] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchParams = useSearchParams();
    const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'favorites-first'>('recent');
    const [filterBy, setFilterBy] = useState<'all' | 'starred'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [user, setUser] = useState<User | null>(null);

    const setAndPersistView = (nextView: 'grid' | 'list') => {
        setViewMode(nextView);
        localStorage.setItem('spaces-view', nextView);
    };

    const fetchProjects = async ({ checkCache = false }: { checkCache?: boolean } = {}) => {
        const currentUser = getUserFromToken();
        const cacheKey = currentUser
            ? buildSessionCacheKey('spaces_projects', [currentUser.userId])
            : null;

        if (checkCache && cacheKey) {
            const cached = getSessionCache<SpaceProject[]>(cacheKey, { allowStale: true });
            if (cached.data) {
                setProjects(cached.data);
                setUsingCachedData(true);
                setLoading(false);
                if (!isOnline) return;
            }
        }

        if (!isOnline) {
            setLoading(false);
            return;
        }

        try {
            const response = await projectsApi.list();
            const fresh = response as SpaceProject[];
            setProjects(fresh);
            setUsingCachedData(false);
            if (cacheKey) {
                setSessionCache(cacheKey, fresh, SPACES_PROJECTS_CACHE_TTL);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const filter = searchParams.get('filter');
        queueMicrotask(() => {
            if (filter === 'favorites') {
                setFilterBy('starred');
                setSortBy('favorites-first');
            } else if (filter === 'recent') {
                setFilterBy('all');
                setSortBy('recent');
            }
        });
    }, [searchParams]);

    useEffect(() => {
        const savedView = localStorage.getItem('spaces-view') ?? 'grid';
        if (savedView === 'list' || savedView === 'grid') {
            queueMicrotask(() => setViewMode(savedView));
        }
    }, []);

    useEffect(() => {
        const userData = getUserFromToken();
        queueMicrotask(() => {
            setUser(userData);
            void fetchProjects({ checkCache: true });
        });

        const handleProjectAccessed = () => { void fetchProjects(); };
        const handleFavToggled = () => { void fetchProjects(); };
        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible') {
                void fetchProjects();
            }
        };

        window.addEventListener('planora:project-accessed', handleProjectAccessed);
        window.addEventListener('planora:favorite-toggled', handleFavToggled);
        window.addEventListener('focus', handleVisibilityOrFocus);
        document.addEventListener('visibilitychange', handleVisibilityOrFocus);

        return () => {
            window.removeEventListener('planora:project-accessed', handleProjectAccessed);
            window.removeEventListener('planora:favorite-toggled', handleFavToggled);
            window.removeEventListener('focus', handleVisibilityOrFocus);
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline]);

    const filteredAndSortedProjects = [...projects]
        .filter((project) => {
            const matchesSearch =
                project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (project.projectKey && project.projectKey.toLowerCase().includes(searchQuery.toLowerCase()));
            if (filterBy === 'starred') return matchesSearch && Boolean(project.isFavorite);
            return matchesSearch;
        })
        .sort((a, b) => {
            if (filterBy === 'starred') {
                const aAt = a.favoriteMarkedAt ? new Date(a.favoriteMarkedAt).getTime() : 0;
                const bAt = b.favoriteMarkedAt ? new Date(b.favoriteMarkedAt).getTime() : 0;
                return aAt !== bAt ? bAt - aAt : a.name.localeCompare(b.name);
            }
            if (sortBy === 'favorites-first') {
                const aS = Boolean(a.isFavorite), bS = Boolean(b.isFavorite);
                return aS === bS ? a.name.localeCompare(b.name) : bS ? 1 : -1;
            }
            if (sortBy === 'alphabetical') return a.name.localeCompare(b.name);
            const aR = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
            const bR = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
            return bR - aR;
        });

    return (
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-2 sm:pt-6 pb-10">

            {/* ── Mobile top bar ──────────────────────────────────────────── */}
            <div className="flex items-center gap-2 py-3 md:hidden">
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
                    className="p-2 -ml-1 rounded-xl text-cu-text-secondary hover:bg-cu-hover transition-colors"
                    aria-label="Toggle Sidebar"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <div className="flex-1 font-outfit text-[17px] font-extrabold tracking-tight text-cu-text-primary flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-cu-primary rounded-full" />
                    PLANORA
                </div>
                <Link
                    href="/createProject"
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-cu-primary text-white"
                    aria-label="Create project"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </Link>
            </div>

            {!isOnline && usingCachedData && (
                <div className="mb-4 rounded-cu-xl border border-cu-warning/30 bg-cu-warning-light px-4 py-3 text-sm text-cu-text-primary shadow-cu-sm">
                    <span className="font-bold">Offline read-only mode.</span>{' '}
                    <span className="text-cu-text-secondary">Showing cached project spaces until your connection returns.</span>
                </div>
            )}

            {/* ── Desktop header ──────────────────────────────────────────── */}
            <div className="hidden sm:flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-cu-text-primary leading-tight">All Projects</h1>
                    <p className="text-cu-text-secondary text-sm mt-0.5">
                        {projects.length > 0
                            ? `${projects.length} project${projects.length !== 1 ? 's' : ''}`
                            : 'Create and manage your projects'}
                    </p>
                </div>
            </div>

            {/* ── Mobile page title (compact) ─────────────────────────────── */}
            <div className="md:hidden mb-3">
                <h1 className="text-xl font-bold text-cu-text-primary leading-tight">All Projects</h1>
                <p className="text-cu-text-secondary text-xs mt-0.5">
                    {projects.length > 0
                        ? `${projects.length} project${projects.length !== 1 ? 's' : ''}`
                        : 'Create and manage your projects'}
                </p>
            </div>

            {/* ── View tabs ───────────────────────────────────────────────── */}
            <div className="flex gap-1 mb-4 bg-cu-bg-secondary p-1 rounded-xl w-full sm:w-fit border border-cu-border">
                <span className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-[13px] font-semibold bg-cu-bg text-cu-primary shadow-cu-sm cursor-default">
                    All Projects
                </span>
                <Link
                    href="/portfolios"
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-[13px] font-medium text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover transition-colors"
                >
                    Portfolios
                </Link>
            </div>

            {/* ── Search (both) ───────────────────────────────────────────── */}
            <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="text-cu-text-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                </div>
                <input
                    type="text"
                    placeholder="Search projects"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 border border-cu-border rounded-xl bg-cu-bg placeholder-cu-text-muted focus:outline-none focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary text-sm transition-all text-cu-text-primary shadow-cu-sm"
                />
            </div>

            {/* ── Mobile filter strip (single scrollable row) ─────────────── */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 sm:hidden">
                {(['all', 'starred'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilterBy(tab)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            filterBy === tab
                                ? 'bg-cu-primary text-white'
                                : 'bg-cu-bg-secondary text-cu-text-secondary'
                        }`}
                    >
                        {tab === 'all' ? 'All' : '⭐ Starred'}
                    </button>
                ))}
                <div className="w-px h-4 bg-cu-border flex-shrink-0" />
                {([
                    { key: 'recent', label: 'Recent' },
                    { key: 'alphabetical', label: 'A–Z' },
                    { key: 'favorites-first', label: 'Favorites' },
                ] as const).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setSortBy(tab.key)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            sortBy === tab.key
                                ? 'bg-cu-primary text-white'
                                : 'bg-cu-bg-secondary text-cu-text-secondary'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
                <div className="w-px h-4 bg-cu-border flex-shrink-0" />
                <div className="flex-shrink-0 flex items-center bg-cu-bg-secondary p-0.5 rounded-lg border border-cu-border">
                    <button
                        onClick={() => setAndPersistView('grid')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-cu-bg text-cu-primary shadow-cu-sm' : 'text-cu-text-secondary'}`}
                        aria-label="Grid view"
                    >
                        <LayoutGrid size={14} />
                    </button>
                    <button
                        onClick={() => setAndPersistView('list')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-cu-bg text-cu-primary shadow-cu-sm' : 'text-cu-text-secondary'}`}
                        aria-label="List view"
                    >
                        <List size={14} />
                    </button>
                </div>
            </div>

            {/* ── Desktop filter bar ──────────────────────────────────────── */}
            <div className="hidden sm:flex justify-between items-center gap-3 pb-4 border-b border-cu-border mb-6">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-cu-bg-secondary p-1 rounded-xl border border-cu-border">
                        {(['all', 'starred'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setFilterBy(tab)}
                                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                                    filterBy === tab ? 'bg-cu-bg text-cu-primary shadow-cu-sm' : 'text-cu-text-secondary hover:text-cu-text-primary'
                                }`}
                            >
                                {tab === 'all' ? 'All' : 'Starred'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 bg-cu-bg-secondary p-1 rounded-xl border border-cu-border">
                        {([
                            { key: 'recent', label: 'Recent' },
                            { key: 'alphabetical', label: 'A-Z' },
                            { key: 'favorites-first', label: 'Favorites first' },
                        ] as const).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setSortBy(tab.key)}
                                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                                    sortBy === tab.key ? 'bg-cu-bg text-cu-primary shadow-cu-sm' : 'text-cu-text-secondary hover:text-cu-text-primary'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-cu-bg-secondary p-1 rounded-xl border border-cu-border">
                        <button
                            onClick={() => setAndPersistView('grid')}
                            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${viewMode === 'grid' ? 'bg-cu-bg text-cu-primary shadow-cu-sm' : 'text-cu-text-secondary hover:text-cu-text-primary'}`}
                            aria-label="Grid view"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setAndPersistView('list')}
                            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${viewMode === 'list' ? 'bg-cu-bg text-cu-primary shadow-cu-sm' : 'text-cu-text-secondary hover:text-cu-text-primary'}`}
                            aria-label="List view"
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Projects ────────────────────────────────────────────────── */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="skeleton h-[160px] rounded-2xl" />
                    ))}
                </div>
            ) : filteredAndSortedProjects.length > 0 ? (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {filteredAndSortedProjects.map((project) => (
                            <RecentProjectCard
                                key={project.id}
                                id={project.id.toString()}
                                name={project.name}
                                projectKey={project.projectKey}
                                isFavorite={project.isFavorite}
                                onFavoriteToggle={() => void fetchProjects()}
                                favoriteDisabled={!isOnline}
                                type={project.type === 'AGILE' ? 'Agile Scrum' : 'Kanban'}
                                boardCount={1}
                                width="w-full min-w-0 max-w-none"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-cu-border bg-cu-bg shadow-cu-sm">
                        <table className="min-w-full text-sm">
                            <thead className="bg-cu-bg-secondary text-cu-text-secondary">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold">Project Name</th>
                                    <th className="text-left px-4 py-3 font-semibold">Type</th>
                                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Members</th>
                                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Last Updated</th>
                                    <th className="text-left px-4 py-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedProjects.map((project) => (
                                    <tr key={project.id} className="border-t border-cu-border hover:bg-cu-hover">
                                        <td className="px-4 py-3 font-semibold text-cu-text-primary">
                                            <div>{project.name}</div>
                                            {project.projectKey && (
                                                <div className="text-xs text-cu-text-muted mt-0.5">{project.projectKey}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-cu-primary/10 text-cu-primary">
                                                {project.type === 'AGILE' ? 'Agile' : 'Kanban'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-cu-text-secondary hidden md:table-cell">{project.memberCount ?? '-'}</td>
                                        <td className="px-4 py-3 text-cu-text-secondary hidden md:table-cell">
                                            {project.updatedAt ? formatDate(project.updatedAt) : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={async () => {
                                                        if (!isOnline) return;
                                                        try {
                                                            await projectsApi.toggleFavorite(project.id);
                                                            window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
                                                            void fetchProjects();
                                                        } catch (error) {
                                                            console.error('Failed to toggle favorite:', error);
                                                        }
                                                    }}
                                                    disabled={!isOnline}
                                                    title={!isOnline ? 'Favorites are read-only while offline' : undefined}
                                                    className={`p-2 rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${project.isFavorite ? 'text-cu-warning border-cu-warning/30 bg-cu-warning/10' : 'text-cu-text-muted border-cu-border hover:text-cu-warning hover:bg-cu-hover'}`}
                                                    aria-label={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                                >
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill={project.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                    </svg>
                                                </button>
                                                <Link
                                                    href={`/summary/${project.id}`}
                                                    className="px-3 py-1.5 rounded-lg bg-cu-primary text-white text-xs font-semibold hover:bg-cu-primary-hover transition-colors"
                                                >
                                                    Open
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : !isOnline && !usingCachedData ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cu-warning-light text-3xl text-cu-warning">
                        !
                    </div>
                    <h3 className="text-base font-semibold text-cu-text-primary">No cached spaces available</h3>
                    <p className="mt-1 max-w-xs text-sm text-cu-text-secondary">
                        Reconnect once to load your projects, then Planora can show them here while offline.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-cu-primary/10 flex items-center justify-center mb-4 text-3xl">
                        📋
                    </div>
                    <h3 className="text-base font-semibold text-cu-text-primary">No projects found</h3>
                    <p className="text-cu-text-secondary text-sm mt-1 max-w-xs">
                        {searchQuery ? 'Try a different search term' : 'Create your first project to get started.'}
                    </p>
                    {!searchQuery && (
                        <Link
                            href="/createProject"
                            className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 bg-cu-primary"
                        >
                            Create Project
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

export default function SpacesPage() {
    return (
        <Suspense fallback={<RouteLoadingState title="Loading spaces" subtitle="Preparing your project spaces." variant="cards" />}>
            <SpacesPageContent />
        </Suspense>
    );
}
