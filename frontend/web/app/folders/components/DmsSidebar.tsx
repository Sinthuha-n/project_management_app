'use client';

import Link from 'next/link';
import { DocumentFolder, ProjectStorageQuotaResponse } from '@/lib/dms';
import { Clock, Folder, Plus, Star, Trash2, Lock } from 'lucide-react';
import { ViewMode } from '@/app/folders/components/types';

interface DmsSidebarProps {
    mode: ViewMode;
    isTrashMode: boolean;
    projectId: number | null;
    projectName: string | null;
    folders: DocumentFolder[];
    selectedFolderId?: number;
    setSelectedFolderId: (id: number | undefined) => void;
    onDeleteFolder: (folder: DocumentFolder) => void;
    newFolderName: string;
    setNewFolderName: (value: string) => void;
    onCreateFolder: () => Promise<void>;
    busy: boolean;
    folderCount: number;
    filteredDocumentCount: number;
    withProjectId: (basePath: string) => string;
    quota: ProjectStorageQuotaResponse | null;
    onOpenFolderPermissions: (folder: DocumentFolder) => void;
}

export default function DmsSidebar({
    mode,
    isTrashMode,
    projectId,
    projectName,
    folders,
    selectedFolderId,
    setSelectedFolderId,
    onDeleteFolder,
    newFolderName,
    setNewFolderName,
    onCreateFolder,
    busy,
    folderCount,
    filteredDocumentCount,
    withProjectId,
    quota,
    onOpenFolderPermissions,
}: DmsSidebarProps) {
    const navLinkClass = (active: boolean, danger = false) =>
        `w-full block text-left px-3 py-2 rounded-md text-sm transition-colors ${
            active
                ? danger
                    ? 'bg-cu-danger-light text-cu-danger'
                    : 'bg-cu-primary-light text-cu-primary'
                : danger
                ? 'text-cu-text-secondary hover:bg-cu-danger-light hover:text-cu-danger'
                : 'text-cu-text-secondary hover:bg-cu-hover'
        }`;

    return (
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2 border-r border-cu-border bg-cu-bg-secondary p-4 flex flex-col gap-4">
            {/* ---- View Nav ---- */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-cu-text-secondary mb-2">Views</h2>
                <nav className="space-y-1">
                    <Link
                        href={withProjectId('/folders/view-all')}
                        prefetch={false}
                        className={navLinkClass(mode === 'view-all')}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Folder size={14} />
                            All documents
                        </span>
                    </Link>
                    <Link
                        href={withProjectId('/folders/recent')}
                        prefetch={false}
                        className={navLinkClass(mode === 'recent')}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Clock size={14} />
                            Recent
                        </span>
                    </Link>
                    <Link
                        href={withProjectId('/folders/favorites')}
                        prefetch={false}
                        className={navLinkClass(mode === 'favorites')}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Star size={14} />
                            Favorites
                        </span>
                    </Link>
                    <Link
                        href={withProjectId('/folders/trash')}
                        prefetch={false}
                        className={navLinkClass(isTrashMode, true)}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Trash2 size={14} />
                            Trash
                        </span>
                    </Link>
                </nav>
            </div>

            {/* ---- Folder list ---- */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-cu-text-secondary mb-2">Folders</h2>
                <div className="space-y-1">
                    {folders.length === 0 && (
                        <p className="text-xs text-cu-text-tertiary px-3 py-2 italic">No folders yet</p>
                    )}
                    {folders.map((folder) => (
                        <div key={folder.id} className="group flex items-center gap-1">
                            <button
                                onClick={() => setSelectedFolderId(folder.id)}
                                disabled={isTrashMode}
                                className={`flex-1 text-left px-3 py-2 rounded-md text-sm inline-flex items-center gap-2 ${
                                    selectedFolderId === folder.id
                                        ? 'bg-cu-primary-light text-cu-primary'
                                        : 'text-cu-text-secondary hover:bg-cu-hover'
                                } disabled:opacity-50`}
                            >
                                <Folder size={14} />
                                <span className="truncate">{folder.name}</span>
                            </button>
                            {!isTrashMode && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onOpenFolderPermissions(folder)}
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-transparent text-cu-text-tertiary hover:text-cu-primary hover:border-cu-primary/30 hover:bg-cu-primary-light"
                                        title="Folder permissions"
                                    >
                                        <Lock size={14} />
                                    </button>
                                    <button
                                        onClick={() => onDeleteFolder(folder)}
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-transparent text-cu-text-tertiary hover:text-cu-danger hover:border-cu-danger/30 hover:bg-cu-danger-light"
                                        title="Delete folder"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ---- Create folder ---- */}
            {!isTrashMode && (
                <div className="rounded-lg border border-cu-border bg-cu-bg p-3">
                    <div className="flex items-center rounded-md border border-cu-border bg-cu-bg overflow-hidden">
                        <input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="New folder name…"
                            className="flex-1 h-[36px] px-3 text-sm bg-transparent text-cu-text-primary placeholder:text-cu-text-tertiary border-0 focus:outline-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    void onCreateFolder();
                                }
                            }}
                        />
                        <button
                            onClick={() => void onCreateFolder()}
                            disabled={busy}
                            className="h-8 w-8 inline-flex items-center justify-center border-l border-cu-border text-cu-text-secondary hover:bg-cu-hover disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Add folder"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* ---- Stats & Storage Quota ---- */}
            <div className="mt-auto flex flex-col gap-3 rounded-md border border-cu-border bg-cu-bg p-3 text-xs text-cu-text-secondary">
                <div>
                    <p className="font-semibold text-cu-text-primary truncate mb-0.5">
                        {projectName ?? `Project #${projectId}`}
                    </p>
                    <p className="text-cu-text-tertiary mb-2">Project documents</p>
                    <p>Folders: <span className="font-semibold text-cu-text-primary">{folderCount}</span></p>
                    <p className="mt-0.5">Documents: <span className="font-semibold text-cu-text-primary">{filteredDocumentCount}</span></p>
                </div>

                {quota && (
                    <div className="border-t border-cu-border pt-3">
                        <div className="flex justify-between items-center text-xs font-semibold mb-1">
                            <span className="text-cu-text-secondary">Storage Used</span>
                            <span className="text-cu-text-primary">{quota.humanReadableUsed} / {quota.humanReadableQuota}</span>
                        </div>
                        <div className="w-full bg-cu-bg-tertiary rounded-full h-2 overflow-hidden">
                            <div
                                style={{ width: `${Math.min(100, Math.max(0, (quota.usedBytes / quota.quotaBytes) * 100))}%` }}
                                className={`h-2 rounded-full transition-all duration-300 ${
                                    (quota.usedBytes / quota.quotaBytes) > 0.9
                                        ? 'bg-red-500'
                                        : (quota.usedBytes / quota.quotaBytes) > 0.7
                                        ? 'bg-amber-500'
                                        : 'bg-cu-primary'
                                }`}
                            />
                        </div>
                        <p className="text-[10px] text-cu-text-tertiary mt-1">
                            {((quota.usedBytes / quota.quotaBytes) * 100).toFixed(1)}% of 5GB quota used
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
}
