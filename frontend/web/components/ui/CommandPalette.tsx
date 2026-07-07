'use client';

import { useCallback, useMemo, useState } from 'react';
import {
    Search, X, Layout, List, Flag, FileText, ArrowRight, Layers, ChevronRight,
    Plus, FolderPlus, UserPlus, Bell, MessageSquare, Sun, Moon, Clock,
    Keyboard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import KeyboardShortcutsModal from '@/components/ui/KeyboardShortcutsModal';
import OverlayPortal from '@/components/ui/OverlayPortal';
import useCommandPalette, { hasMinRole } from '@/hooks/useCommandPalette';
import { useTheme } from '@/components/providers/ThemeProvider';
import type { Project } from '@/types';
import type { TaskResult } from '@/hooks/useCommandPalette';

// ── Status display helpers ────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    DONE: 'Done',
};

const STATUS_DOT: Record<string, string> = {
    TODO: 'bg-gray-400',
    IN_PROGRESS: 'bg-blue-500',
    IN_REVIEW: 'bg-amber-500',
    DONE: 'bg-green-500',
};

// ── Command definition ────────────────────────────────────────────────────────

type Section = 'actions' | 'navigate';

interface CommandDef {
    id: string;
    label: string;
    icon: LucideIcon;
    section: Section;
    action: () => void;
    shortcut?: string;
    requiresProject?: boolean;
    minRole?: string;
    keywords?: string[];
}

// ── Palette items (commands + task results + recent projects) ─────────────────

type PaletteItem =
    | { kind: 'command'; command: CommandDef }
    | { kind: 'task';    task: TaskResult }
    | { kind: 'recent';  project: Project };

// ── Static navigation paths ───────────────────────────────────────────────────

const NAV_DEFS: { id: string; label: string; path: string; icon: LucideIcon; shortcut?: string }[] = [
    { id: 'nav-board',      label: 'Go to Board',        path: '/kanban',       icon: Layout,     shortcut: 'G B' },
    { id: 'nav-backlog',    label: 'Go to Backlog',       path: '/backlog',      icon: List,       shortcut: 'G K' },
    { id: 'nav-sprint',     label: 'Go to Sprint Board',  path: '/sprint-board', icon: Layers },
    { id: 'nav-list',       label: 'Go to List',          path: '/list',         icon: ArrowRight },
    { id: 'nav-milestones', label: 'Go to Milestones',    path: '/milestones',   icon: Flag },
    { id: 'nav-pages',      label: 'Go to Pages',         path: '/pages',        icon: FileText },
];

// ── Section metadata ──────────────────────────────────────────────────────────

const SECTION_LABEL: Record<Section, string> = {
    actions:  'Actions',
    navigate: 'Navigate',
};

// ── KbdHint: small inline shortcut badge ─────────────────────────────────────

function KbdHint({ shortcut }: { shortcut: string }) {
    return (
        <span className="flex items-center gap-0.5 shrink-0">
            {shortcut.split(' ').map((k, i) => (
                <kbd
                    key={i}
                    className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-mono
                               bg-cu-bg-secondary border border-cu-border text-cu-text-muted leading-none"
                >
                    {k}
                </kbd>
            ))}
        </span>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommandPalette() {
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    const {
        open, setOpen, query, setQuery,
        taskResults, highlighted, setHighlighted,
        isSearching, selectedTaskId, setSelectedTaskId,
        inputRef, openTask, userRole, projects,
    } = useCommandPalette();

    // ── Helpers ───────────────────────────────────────────────────────────────

    const getProjectId = useCallback((): string | null => {
        if (typeof window === 'undefined') return null;
        return sessionStorage.getItem('currentProjectId') || localStorage.getItem('currentProjectId');
    }, []);

    const navigateTo = useCallback((path: string) => {
        const pid = getProjectId();
        setOpen(false);
        router.push(pid && pid !== 'null' ? `${path}?projectId=${pid}` : path);
    }, [router, setOpen, getProjectId]);

    const switchToProject = useCallback((project: Project) => {
        sessionStorage.setItem('currentProjectName', project.name);
        sessionStorage.setItem('currentProjectId', project.id.toString());
        localStorage.setItem('currentProjectName', project.name);
        localStorage.setItem('currentProjectId', project.id.toString());
        sessionStorage.removeItem('currentProjectType');
        localStorage.removeItem('currentProjectType');
        window.dispatchEvent(new CustomEvent('planora:project-accessed'));
        window.dispatchEvent(new Event('storage'));
        setOpen(false);
        router.push(`/kanban?projectId=${project.id}`);
    }, [router, setOpen]);

    // ── Build command list (role-aware, project-aware) ────────────────────────

    const commands = useMemo<CommandDef[]>(() => {
        const pid = getProjectId();
        const hasProject = !!pid && pid !== 'null';

        const all: CommandDef[] = [
            // ── Actions ──────────────────────────────────────────────────────
            {
                id: 'create-task',
                label: 'Create Task',
                icon: Plus,
                section: 'actions',
                action: () => navigateTo('/backlog'),
                shortcut: 'N',
                requiresProject: true,
                keywords: ['new task', 'add task'],
            },
            {
                id: 'create-project',
                label: 'Create Project',
                icon: FolderPlus,
                section: 'actions',
                action: () => { setOpen(false); router.push('/createProject'); },
                keywords: ['new project', 'add project'],
            },
            {
                id: 'invite-member',
                label: 'Invite Member',
                icon: UserPlus,
                section: 'actions',
                action: () => {
                    setOpen(false);
                    if (pid && pid !== 'null') router.push(`/members/${pid}`);
                },
                requiresProject: true,
                minRole: 'ADMIN',
                keywords: ['invite', 'add member', 'team'],
            },
            {
                id: 'open-notifications',
                label: 'Open Notifications',
                icon: Bell,
                section: 'actions',
                action: () => { setOpen(false); router.push('/dashboard/notifications'); },
                keywords: ['alerts', 'inbox'],
            },
            {
                id: 'open-chat',
                label: 'Open Inbox / Chat',
                icon: MessageSquare,
                section: 'actions',
                action: () => {
                    setOpen(false);
                    if (pid && pid !== 'null') router.push(`/project/${pid}/chat`);
                },
                requiresProject: true,
                keywords: ['messages', 'inbox', 'chat'],
            },
            {
                id: 'switch-theme',
                label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
                icon: theme === 'dark' ? Sun : Moon,
                section: 'actions',
                action: () => { toggleTheme(); setOpen(false); },
                keywords: ['dark mode', 'light mode', 'appearance', 'theme'],
            },
            // ── Navigate ─────────────────────────────────────────────────────
            ...NAV_DEFS.map((nav) => ({
                id: nav.id,
                label: nav.label,
                icon: nav.icon,
                section: 'navigate' as Section,
                action: () => navigateTo(nav.path),
                shortcut: nav.shortcut,
                requiresProject: true,
            })),
        ];

        return all.filter((cmd) => {
            if (cmd.requiresProject && !hasProject) return false;
            if (cmd.minRole && !hasMinRole(userRole, cmd.minRole)) return false;
            return true;
        });
    }, [getProjectId, navigateTo, router, setOpen, theme, toggleTheme, userRole]);

    // ── Recent projects (sorted by last access) ───────────────────────────────

    const recentProjects = useMemo<Project[]>(() =>
        [...projects]
            .sort((a, b) => {
                const at = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
                const bt = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
                return bt - at;
            })
            .slice(0, 5),
        [projects]
    );

    // ── Filter commands by query ──────────────────────────────────────────────

    const filteredCommands = useMemo<CommandDef[]>(() => {
        if (!query.trim()) return commands;
        const lower = query.toLowerCase();
        return commands.filter(
            (cmd) =>
                cmd.label.toLowerCase().includes(lower) ||
                cmd.keywords?.some((k) => k.toLowerCase().includes(lower))
        );
    }, [commands, query]);

    // ── Unified navigable item list ───────────────────────────────────────────

    const allItems = useMemo<PaletteItem[]>(() => {
        if (query.trim().length >= 2) {
            return [
                ...filteredCommands.map((c): PaletteItem => ({ kind: 'command', command: c })),
                ...taskResults.map((t): PaletteItem => ({ kind: 'task', task: t })),
            ];
        }
        return [
            ...filteredCommands.map((c): PaletteItem => ({ kind: 'command', command: c })),
            ...recentProjects.map((p): PaletteItem => ({ kind: 'recent', project: p })),
        ];
    }, [filteredCommands, taskResults, recentProjects, query]);

    // ── Keyboard navigation ───────────────────────────────────────────────────

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, allItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            const item = allItems[highlighted];
            if (!item) return;
            if (item.kind === 'command') item.command.action();
            else if (item.kind === 'task') openTask(item.task.id);
            else if (item.kind === 'recent') switchToProject(item.project);
        }
    }, [allItems, highlighted, openTask, setHighlighted, switchToProject]);

    // ── Rendering helpers ─────────────────────────────────────────────────────

    // Group visible commands by section for rendering section headers
    const commandsBySection = useMemo(() => {
        const map = new Map<Section, CommandDef[]>();
        for (const cmd of filteredCommands) {
            const list = map.get(cmd.section) ?? [];
            list.push(cmd);
            map.set(cmd.section, list);
        }
        return map;
    }, [filteredCommands]);

    const isSearchMode = query.trim().length >= 2;
    const hasTasks = taskResults.length > 0;
    const hasMatchingCommands = filteredCommands.length > 0;
    const hasRecent = recentProjects.length > 0 && !isSearchMode;
    const showEmptyState = !isSearching && isSearchMode && !hasTasks && !hasMatchingCommands;

    // Global index offset — tracks where in allItems each section starts
    // Used to compute the highlighted row within the unified list
    let globalIdx = 0;

    if (!open && selectedTaskId === null && !shortcutsOpen) return null;

    return (
        <>
            {open && (
                <OverlayPortal>
                <div
                    className="fixed inset-0 z-[var(--cu-z-command)] flex items-start justify-center pt-[12vh] px-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Command palette"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    />

                    <div className="relative w-full max-w-xl bg-cu-bg rounded-2xl shadow-2xl border border-cu-border overflow-hidden">

                        {/* ── Search input ─────────────────────────────────── */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-cu-border">
                            <Search size={18} className="text-cu-text-muted flex-shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search tasks, commands, or navigate…"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
                                onKeyDown={handleKeyDown}
                                className="flex-1 bg-transparent text-sm text-cu-text-primary placeholder-cu-text-muted outline-none"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => { setQuery(''); setHighlighted(0); }}
                                    className="text-cu-text-muted hover:text-cu-text-primary"
                                    aria-label="Clear search"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* ── Results ──────────────────────────────────────── */}
                        <div className="max-h-96 overflow-y-auto">

                            {/* Commands grouped by section */}
                            {hasMatchingCommands && (
                                <>
                                    {(['actions', 'navigate'] as Section[]).map((section) => {
                                        const sectionCmds = commandsBySection.get(section);
                                        if (!sectionCmds?.length) return null;
                                        return (
                                            <div key={section}>
                                                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-cu-text-muted uppercase tracking-wider">
                                                    {SECTION_LABEL[section]}
                                                </p>
                                                {sectionCmds.map((cmd) => {
                                                    const idx = globalIdx++;
                                                    const Icon = cmd.icon;
                                                    return (
                                                        <button
                                                            key={cmd.id}
                                                            type="button"
                                                            onClick={cmd.action}
                                                            onMouseEnter={() => setHighlighted(idx)}
                                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                                idx === highlighted
                                                                    ? 'bg-cu-primary/10'
                                                                    : 'hover:bg-cu-hover'
                                                            }`}
                                                        >
                                                            <Icon size={15} className="text-cu-text-secondary flex-shrink-0" />
                                                            <span className="flex-1 text-sm text-cu-text-primary">{cmd.label}</span>
                                                            {cmd.shortcut && <KbdHint shortcut={cmd.shortcut} />}
                                                            {!cmd.shortcut && (
                                                                <ChevronRight size={13} className="text-cu-border flex-shrink-0" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            {/* Recent projects (browse mode only) */}
                            {hasRecent && (
                                <div>
                                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-cu-text-muted uppercase tracking-wider">
                                        Recent Projects
                                    </p>
                                    {recentProjects.map((project) => {
                                        const idx = globalIdx++;
                                        return (
                                            <button
                                                key={project.id}
                                                type="button"
                                                onClick={() => switchToProject(project)}
                                                onMouseEnter={() => setHighlighted(idx)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                    idx === highlighted
                                                        ? 'bg-cu-primary/10'
                                                        : 'hover:bg-cu-hover'
                                                }`}
                                            >
                                                <Clock size={15} className="text-cu-text-secondary flex-shrink-0" />
                                                <span className="flex-1 text-sm text-cu-text-primary">{project.name}</span>
                                                {project.projectKey && (
                                                    <span className="text-xs text-cu-text-muted flex-shrink-0">
                                                        {project.projectKey}
                                                    </span>
                                                )}
                                                <ChevronRight size={13} className="text-cu-border flex-shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Task search results (search mode) */}
                            {isSearchMode && (
                                <>
                                    {isSearching && (
                                        <p className="px-4 py-3 text-sm text-cu-text-muted">Searching…</p>
                                    )}
                                    {!isSearching && hasTasks && (
                                        <>
                                            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-cu-text-muted uppercase tracking-wider">
                                                Tasks
                                            </p>
                                            {taskResults.map((task) => {
                                                const idx = globalIdx++;
                                                return (
                                                    <button
                                                        key={task.id}
                                                        type="button"
                                                        onClick={() => openTask(task.id)}
                                                        onMouseEnter={() => setHighlighted(idx)}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                            idx === highlighted
                                                                ? 'bg-cu-primary/10'
                                                                : 'hover:bg-cu-hover'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] ?? 'bg-cu-border'}`}
                                                        />
                                                        <span className="flex-1 text-sm text-cu-text-primary truncate">
                                                            {task.title}
                                                        </span>
                                                        {task.subtitle && (
                                                            <span className="text-xs text-cu-text-muted flex-shrink-0 font-mono">
                                                                {task.subtitle}
                                                            </span>
                                                        )}
                                                        {!task.subtitle && (
                                                            <span className="text-xs text-cu-text-muted flex-shrink-0">
                                                                {STATUS_LABEL[task.status] ?? task.status}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </>
                                    )}
                                </>
                            )}

                            {/* Empty state */}
                            {showEmptyState && (
                                <p className="px-4 py-3 text-sm text-cu-text-muted">
                                    No results for &quot;{query}&quot;
                                </p>
                            )}

                            {/* Browse mode placeholder when everything is filtered out */}
                            {!isSearchMode && !hasMatchingCommands && !hasRecent && (
                                <p className="px-4 py-4 text-sm text-cu-text-muted text-center">
                                    Type to search tasks or commands
                                </p>
                            )}
                        </div>

                        {/* ── Footer hints ─────────────────────────────────── */}
                        <div className="border-t border-cu-border px-4 py-2 flex items-center gap-3 text-[11px] text-cu-text-muted">
                            <span>
                                <kbd className="font-mono bg-cu-bg-secondary px-1 rounded">↑↓</kbd> navigate
                            </span>
                            <span>
                                <kbd className="font-mono bg-cu-bg-secondary px-1 rounded">↵</kbd> select
                            </span>
                            <span>
                                <kbd className="font-mono bg-cu-bg-secondary px-1 rounded">Esc</kbd> close
                            </span>
                            <span className="ml-auto">
                                <button
                                    type="button"
                                    onClick={() => { setOpen(false); setShortcutsOpen(true); }}
                                    className="flex items-center gap-1 hover:text-cu-text-primary transition-colors"
                                    aria-label="Show keyboard shortcuts"
                                >
                                    <Keyboard size={12} />
                                    <kbd className="font-mono bg-cu-bg-secondary px-1 rounded">?</kbd>
                                    shortcuts
                                </button>
                            </span>
                        </div>
                    </div>
                </div>
                </OverlayPortal>
            )}

            {selectedTaskId !== null && (
                <TaskCardModal
                    taskId={selectedTaskId}
                    onClose={(_wasModified) => setSelectedTaskId(null)}
                />
            )}

            <KeyboardShortcutsModal
                open={shortcutsOpen}
                onClose={() => setShortcutsOpen(false)}
            />
        </>
    );
}
