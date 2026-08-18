'use client';

import { useEffect, useState } from 'react';
import { 
    DocumentItem, 
    DocumentVersionItem, 
    DocumentFolder, 
    FolderPermissionRequest 
} from '@/lib/dms';
import { 
    Info, Pencil, X, Lock, Shield, Check, Loader2, 
    ArrowLeftRight, FileText, Download, Eye, Clock,
    Trash2, AlertTriangle, AlertOctagon 
} from 'lucide-react';
import { formatBytes, toDateLabel } from '@/app/folders/components/dmsUtils';
import OverlayPortal from '@/components/ui/OverlayPortal';

interface DmsModalsProps {
    selectedVersionsDocId: number | null;
    selectedVersionsDoc: DocumentItem | null;
    versions: Record<number, DocumentVersionItem[]>;
    setSelectedVersionsDocId: (value: number | null) => void;
    selectedInfoDoc: DocumentItem | null;
    setSelectedInfoDoc: (value: DocumentItem | null) => void;
    getFolderName: (folderId: number | null) => string;
    isUploading?: boolean;
    uploadProgress?: number;
    renameDoc: DocumentItem | null;
    renameName: string;
    setRenameName: (value: string) => void;
    onConfirmRename: () => Promise<void>;
    onCancelRename: () => void;
    deleteDoc?: DocumentItem | null;
    onConfirmSoftDelete?: () => Promise<void>;
    onCancelSoftDelete?: () => void;
    permanentDeleteDoc?: DocumentItem | null;
    onConfirmPermanentDelete?: () => Promise<void>;
    onCancelPermanentDelete?: () => void;
    busy?: boolean;

    // Permissions Props
    selectedPermsFolder: DocumentFolder | null;
    folderPermissions: FolderPermissionRequest[];
    loadingPerms: boolean;
    savingPerms: boolean;
    onSaveFolderPermissions: (permissions: FolderPermissionRequest[]) => Promise<void>;
    onCloseFolderPermissions: () => void;
    projectId: number | null;

    // Preview Props
    previewDoc: DocumentItem | null;
    setPreviewDoc: (value: DocumentItem | null) => void;
}

export default function DmsModals({
    selectedVersionsDocId,
    selectedVersionsDoc,
    versions,
    setSelectedVersionsDocId,
    selectedInfoDoc,
    setSelectedInfoDoc,
    getFolderName,
    isUploading = false,
    uploadProgress = 0,
    renameDoc,
    renameName,
    setRenameName,
    onConfirmRename,
    onCancelRename,
    deleteDoc = null,
    onConfirmSoftDelete = async () => {},
    onCancelSoftDelete = () => {},
    permanentDeleteDoc = null,
    onConfirmPermanentDelete = async () => {},
    onCancelPermanentDelete = () => {},
    busy = false,

    selectedPermsFolder,
    folderPermissions,
    loadingPerms,
    savingPerms,
    onSaveFolderPermissions,
    onCloseFolderPermissions,
    projectId: _projectId,

    previewDoc,
    setPreviewDoc,
}: DmsModalsProps) {
    // ── Permission Modal State ──────────────────────────────────────────────────
    const [permsState, setPermsState] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (selectedPermsFolder && folderPermissions.length > 0) {
            const initialPerms: Record<string, string[]> = {};
            folderPermissions.forEach(p => {
                initialPerms[p.teamRole] = p.permissions;
            });
            queueMicrotask(() => setPermsState(initialPerms));
        } else if (selectedPermsFolder) {
            // Seed defaults if empty
            queueMicrotask(() => setPermsState({
                ADMIN: ['READ', 'WRITE', 'MANAGE'],
                MEMBER: ['READ', 'WRITE'],
                VIEWER: ['READ']
            }));
        }
    }, [selectedPermsFolder, folderPermissions]);

    const handleTogglePermission = (role: string, permission: string) => {
        const current = permsState[role] || [];
        let next: string[];

        if (current.includes(permission)) {
            next = current.filter(p => p !== permission);
            // If we remove READ, we must also remove WRITE and MANAGE (hierarchy check)
            if (permission === 'READ') {
                next = next.filter(p => p !== 'WRITE' && p !== 'MANAGE');
            }
            // If we remove WRITE, we must also remove MANAGE
            if (permission === 'WRITE') {
                next = next.filter(p => p !== 'MANAGE');
            }
        } else {
            next = [...current, permission];
            // If we add MANAGE, we must also add WRITE and READ (hierarchy check)
            if (permission === 'MANAGE') {
                if (!next.includes('WRITE')) next.push('WRITE');
                if (!next.includes('READ')) next.push('READ');
            }
            // If we add WRITE, we must also add READ
            if (permission === 'WRITE') {
                if (!next.includes('READ')) next.push('READ');
            }
        }

        setPermsState(prev => ({
            ...prev,
            [role]: next
        }));
    };

    const handleSavePermissions = async () => {
        const payload: FolderPermissionRequest[] = Object.entries(permsState).map(([role, perms]) => ({
            teamRole: role,
            permissions: perms
        }));
        await onSaveFolderPermissions(payload);
    };

    // ── Preview Modal State & Content Fetching ──────────────────────────────
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    useEffect(() => {
        if (!previewDoc || !previewDoc.downloadUrl) {
            queueMicrotask(() => setPreviewContent(null));
            return;
        }

        const isTextOrMarkdown = 
            previewDoc.contentType === 'text/plain' || 
            previewDoc.contentType === 'text/markdown' || 
            previewDoc.name.endsWith('.txt') || 
            previewDoc.name.endsWith('.md');

        if (isTextOrMarkdown) {
            const fetchText = async () => {
                try {
                    setLoadingPreview(true);
                    const res = await fetch(previewDoc.downloadUrl!);
                    if (res.ok) {
                        const txt = await res.text();
                        setPreviewContent(txt);
                    } else {
                        setPreviewContent('Failed to retrieve file contents.');
                    }
                } catch {
                    setPreviewContent('Error loading document content from S3.');
                } finally {
                    setLoadingPreview(false);
                }
            };
            queueMicrotask(() => void fetchText());
        } else {
            queueMicrotask(() => setPreviewContent(null));
        }
    }, [previewDoc]);

    const renderMarkdownContent = (text: string) => {
        // Simple but beautiful custom markdown parser to avoid external library errors
        const lines = text.split('\n');
        return lines.map((line, idx) => {
            if (line.startsWith('# ')) {
                return <h1 key={idx} className="text-xl font-bold text-cu-text-primary mt-4 mb-2 border-b border-cu-border pb-1">{line.slice(2)}</h1>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={idx} className="text-lg font-bold text-cu-text-primary mt-3 mb-2">{line.slice(3)}</h2>;
            }
            if (line.startsWith('### ')) {
                return <h3 key={idx} className="text-base font-bold text-cu-text-primary mt-2 mb-1">{line.slice(4)}</h3>;
            }
            if (line.startsWith('- ') || line.startsWith('* ')) {
                return <li key={idx} className="list-disc list-inside ml-4 text-sm text-cu-text-secondary my-0.5">{line.slice(2)}</li>;
            }
            if (line.trim() === '---' || line.trim() === '***') {
                return <hr key={idx} className="my-4 border-t border-cu-border" />;
            }
            if (line.startsWith('> ')) {
                return (
                    <blockquote key={idx} className="border-l-4 border-cu-primary bg-cu-bg-secondary pl-4 py-2 my-2 text-sm italic text-cu-text-secondary rounded-r">
                        {line.slice(2)}
                    </blockquote>
                );
            }
            return <p key={idx} className="text-sm text-cu-text-secondary min-h-[1rem] my-1.5 leading-relaxed">{line}</p>;
        });
    };

    // ── Version Comparison State & Logic ────────────────────────────────────
    const [compareLeftVersion, setCompareLeftVersion] = useState<DocumentVersionItem | null>(null);
    const [compareRightVersion, setCompareRightVersion] = useState<DocumentVersionItem | null>(null);
    const [isComparing, setIsComparing] = useState(false);
    const [leftTextContent, setLeftTextContent] = useState<string | null>(null);
    const [rightTextContent, setRightTextContent] = useState<string | null>(null);
    const [loadingCompare, setLoadingCompare] = useState(false);

    useEffect(() => {
        if (!isComparing || !compareLeftVersion || !compareRightVersion) {
            queueMicrotask(() => {
                setLeftTextContent(null);
                setRightTextContent(null);
            });
            return;
        }

        const isTextOrMarkdown = 
            selectedVersionsDoc?.contentType === 'text/plain' || 
            selectedVersionsDoc?.contentType === 'text/markdown' || 
            selectedVersionsDoc?.name.endsWith('.txt') || 
            selectedVersionsDoc?.name.endsWith('.md');

        if (isTextOrMarkdown) {
            const fetchCompareTexts = async () => {
                try {
                    setLoadingCompare(true);
                    const [resLeft, resRight] = await Promise.all([
                        fetch(compareLeftVersion.downloadUrl),
                        fetch(compareRightVersion.downloadUrl)
                    ]);
                    const [txtLeft, txtRight] = await Promise.all([
                        resLeft.ok ? resLeft.text() : 'Failed to load.',
                        resRight.ok ? resRight.text() : 'Failed to load.'
                    ]);
                    setLeftTextContent(txtLeft);
                    setRightTextContent(txtRight);
                } catch {
                    setLeftTextContent('Error loading Left version.');
                    setRightTextContent('Error loading Right version.');
                } finally {
                    setLoadingCompare(false);
                }
            };
            void fetchCompareTexts();
        }
    }, [isComparing, compareLeftVersion, compareRightVersion, selectedVersionsDoc]);

    const renderTextDiff = () => {
        if (loadingCompare) {
            return (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-cu-text-secondary">
                    <Loader2 className="animate-spin text-cu-primary h-8 w-8" />
                    <p className="text-sm">Fetching and comparing version contents...</p>
                </div>
            );
        }

        if (leftTextContent === null || rightTextContent === null) {
            return (
                <div className="p-6 text-center text-sm text-cu-text-secondary">
                    Select two text/markdown versions to compare their changes.
                </div>
            );
        }

        const leftLines = leftTextContent.split('\n');
        const rightLines = rightTextContent.split('\n');
        const maxLines = Math.max(leftLines.length, rightLines.length);

        const diffElements: React.ReactNode[] = [];

        for (let i = 0; i < maxLines; i++) {
            const leftLine = leftLines[i] !== undefined ? leftLines[i] : null;
            const rightLine = rightLines[i] !== undefined ? rightLines[i] : null;

            if (leftLine === rightLine) {
                // Unchanged
                diffElements.push(
                    <div key={i} className="grid grid-cols-2 text-xs font-mono py-0.5 border-b border-cu-border/30 hover:bg-cu-bg-secondary/40">
                        <div className="border-r border-cu-border/50 px-3 py-1 text-cu-text-secondary whitespace-pre-wrap">{leftLine}</div>
                        <div className="px-3 py-1 text-cu-text-secondary whitespace-pre-wrap">{rightLine}</div>
                    </div>
                );
            } else {
                // Changed
                diffElements.push(
                    <div key={i} className="grid grid-cols-2 text-xs font-mono py-0.5 border-b border-cu-border/30">
                        <div className="border-r border-cu-border/50 px-3 py-1 bg-red-500/10 text-red-700 border-red-500/20 whitespace-pre-wrap">
                            {leftLine !== null ? `- ${leftLine}` : ''}
                        </div>
                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-700 border-emerald-500/20 whitespace-pre-wrap">
                            {rightLine !== null ? `+ ${rightLine}` : ''}
                        </div>
                    </div>
                );
            }
        }

        return (
            <div className="border border-cu-border rounded-lg overflow-hidden bg-cu-bg flex flex-col max-h-[480px]">
                {/* Header Row */}
                <div className="grid grid-cols-2 bg-cu-bg-secondary font-semibold text-xs text-cu-text-primary border-b border-cu-border py-2 px-3">
                    <div className="border-r border-cu-border/50">Version #{compareLeftVersion?.versionNumber}</div>
                    <div className="pl-3">Version #{compareRightVersion?.versionNumber}</div>
                </div>
                {/* Diff Viewer Body */}
                <div className="overflow-y-auto flex-1 divide-y divide-cu-border/20">
                    {diffElements}
                </div>
            </div>
        );
    };

    const isBinaryCompare = () => {
        if (!selectedVersionsDoc) return false;
        const cType = selectedVersionsDoc.contentType;
        return !(cType === 'text/plain' || cType === 'text/markdown' || selectedVersionsDoc.name.endsWith('.txt') || selectedVersionsDoc.name.endsWith('.md'));
    };

    // If no modals should show, return null
    const isModalOpen = 
        renameDoc !== null || 
        deleteDoc !== null ||
        permanentDeleteDoc !== null ||
        isUploading || 
        selectedVersionsDocId !== null || 
        selectedInfoDoc !== null || 
        selectedPermsFolder !== null ||
        previewDoc !== null;

    if (!isModalOpen) return null;

    return (
        <OverlayPortal>
            <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
            
            {/* 1. RENAME DOCUMENT MODAL */}
            {renameDoc !== null && (
                <div className="w-full max-w-md rounded-xl border border-cu-border bg-cu-bg shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-cu-border px-5 py-4 bg-cu-bg-secondary">
                        <div className="inline-flex items-center gap-2 text-cu-text-primary">
                            <Pencil size={16} className="text-cu-primary" />
                            <h3 className="text-sm font-semibold">Rename document</h3>
                        </div>
                        <button
                            onClick={onCancelRename}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-cu-border text-cu-text-secondary hover:bg-cu-hover transition-colors"
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="px-5 py-4 space-y-4">
                        <div>
                            <label className="text-xs font-medium text-cu-text-primary mb-1.5 block">
                                Document name
                            </label>
                            <input
                                value={renameName}
                                onChange={(e) => setRenameName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void onConfirmRename();
                                    if (e.key === 'Escape') onCancelRename();
                                }}
                                className="w-full px-3 py-2 text-sm bg-cu-bg text-cu-text-primary border border-cu-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cu-primary/25"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={onCancelRename}
                                className="px-4 py-2 text-xs font-semibold border border-cu-border text-cu-text-secondary rounded-lg hover:bg-cu-hover transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => void onConfirmRename()}
                                disabled={busy || !renameName.trim() || renameName.trim() === renameDoc.name}
                                className="px-4 py-2 text-xs font-semibold bg-cu-primary text-white rounded-lg hover:bg-cu-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {busy ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                                Rename
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 1b. SOFT DELETE CONFIRMATION MODAL */}
            {deleteDoc !== null && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="soft-delete-modal-title"
                    className="w-full max-w-md rounded-xl border border-cu-border bg-cu-bg shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="flex items-center justify-between border-b border-cu-border px-5 py-4 bg-cu-bg-secondary">
                        <div className="inline-flex items-center gap-2 text-cu-text-primary">
                            <Trash2 size={16} className="text-amber-500" />
                            <h3 id="soft-delete-modal-title" className="text-sm font-semibold">Move to Trash?</h3>
                        </div>
                        <button
                            type="button"
                            onClick={onCancelSoftDelete}
                            disabled={busy}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-cu-border text-cu-text-secondary hover:bg-cu-hover transition-colors disabled:opacity-50"
                            title="Close"
                            aria-label="Close dialog"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="px-5 py-5 space-y-4">
                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                                <Trash2 size={20} />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-cu-text-primary">
                                    Move &ldquo;{deleteDoc.name}&rdquo; to Trash?
                                </h4>
                                <p className="text-xs text-cu-text-secondary mt-1 leading-relaxed">
                                    This document will be moved to the Trash folder. You can restore it to its original folder at any time or delete it permanently later.
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-cu-border bg-cu-bg-secondary/40 p-3 text-xs space-y-1.5">
                            <div className="flex justify-between text-cu-text-secondary">
                                <span className="text-cu-text-tertiary">Folder</span>
                                <span className="font-medium text-cu-text-primary truncate max-w-[200px]">{deleteDoc.folderName ?? getFolderName(deleteDoc.folderId)}</span>
                            </div>
                            <div className="flex justify-between text-cu-text-secondary">
                                <span className="text-cu-text-tertiary">Size</span>
                                <span className="font-medium text-cu-text-primary">{deleteDoc.humanReadableSize ?? formatBytes(deleteDoc.fileSize)}</span>
                            </div>
                            <div className="flex justify-between text-cu-text-secondary">
                                <span className="text-cu-text-tertiary">Current version</span>
                                <span className="font-medium text-cu-text-primary">v{deleteDoc.latestVersionNumber}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-cu-border">
                            <button
                                type="button"
                                onClick={onCancelSoftDelete}
                                disabled={busy}
                                className="px-4 py-2 text-xs font-semibold border border-cu-border text-cu-text-secondary rounded-lg hover:bg-cu-hover transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void onConfirmSoftDelete()}
                                disabled={busy}
                                className="px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 shadow-sm shadow-red-500/20"
                            >
                                {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
                                Move to Trash
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 1c. PERMANENT DELETE CONFIRMATION MODAL */}
            {permanentDeleteDoc !== null && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="permanent-delete-modal-title"
                    className="w-full max-w-md rounded-xl border border-cu-border bg-cu-bg shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="flex items-center justify-between border-b border-cu-border px-5 py-4 bg-red-500/5">
                        <div className="inline-flex items-center gap-2 text-red-600">
                            <AlertTriangle size={16} />
                            <h3 id="permanent-delete-modal-title" className="text-sm font-semibold">Permanently Delete Document?</h3>
                        </div>
                        <button
                            type="button"
                            onClick={onCancelPermanentDelete}
                            disabled={busy}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-cu-border text-cu-text-secondary hover:bg-cu-hover transition-colors disabled:opacity-50"
                            title="Close"
                            aria-label="Close dialog"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="px-5 py-5 space-y-4">
                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 flex items-center justify-center shrink-0 ring-4 ring-red-500/5">
                                <Trash2 size={20} />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-cu-text-primary">
                                    Permanently delete &ldquo;{permanentDeleteDoc.name}&rdquo;?
                                </h4>
                                <p className="text-xs text-cu-text-secondary mt-1 leading-relaxed">
                                    This action cannot be undone. Restoring this document will be impossible, all version histories will be wiped, and the file bytes will be permanently deleted from cloud storage.
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
                            <AlertOctagon size={16} className="shrink-0 mt-0.5" />
                            <p>
                                <strong className="font-semibold block mb-0.5">Permanent Deletion Warning:</strong>
                                All metadata, revision logs, and physical file assets will be permanently destroyed.
                            </p>
                        </div>

                        <div className="rounded-lg border border-cu-border bg-cu-bg-secondary/40 p-3 text-xs space-y-1.5">
                            <div className="flex justify-between text-cu-text-secondary">
                                <span className="text-cu-text-tertiary">Document ID</span>
                                <span className="font-mono text-cu-text-primary">{permanentDeleteDoc.id}</span>
                            </div>
                            <div className="flex justify-between text-cu-text-secondary">
                                <span className="text-cu-text-tertiary">Size</span>
                                <span className="font-medium text-cu-text-primary">{permanentDeleteDoc.humanReadableSize ?? formatBytes(permanentDeleteDoc.fileSize)}</span>
                            </div>
                            <div className="flex justify-between text-cu-text-secondary">
                                <span className="text-cu-text-tertiary">Total versions</span>
                                <span className="font-medium text-cu-text-primary">{permanentDeleteDoc.latestVersionNumber} version(s)</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-cu-border">
                            <button
                                type="button"
                                onClick={onCancelPermanentDelete}
                                disabled={busy}
                                className="px-4 py-2 text-xs font-semibold border border-cu-border text-cu-text-secondary rounded-lg hover:bg-cu-hover transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void onConfirmPermanentDelete()}
                                disabled={busy}
                                className="px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 shadow-sm shadow-red-500/20"
                            >
                                {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
                                Delete Forever
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. BACKGROUND UPLOAD WIDGET */}
            {isUploading && (
                <div className="fixed bottom-8 right-8 z-[var(--cu-z-toast)] w-80 rounded-xl border border-cu-border bg-cu-bg p-4 shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-semibold text-cu-text-primary">Uploading to S3...</p>
                        <span className="text-xs font-bold text-cu-primary">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-cu-bg-tertiary rounded-full h-2">
                        <div
                            style={{ width: `${uploadProgress}%` }}
                            className="h-2 rounded-full bg-cu-primary transition-all duration-200"
                        />
                    </div>
                    <p className="text-[10px] text-cu-text-tertiary mt-1.5">Direct-to-S3 secure upload pipeline active</p>
                </div>
            )}

            {/* 3. FOLDER LEVEL PERMISSIONS MODAL */}
            {selectedPermsFolder !== null && (
                <div className="w-full max-w-lg rounded-xl border border-cu-border bg-cu-bg shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-cu-border px-5 py-4 bg-cu-bg-secondary">
                        <div className="inline-flex items-center gap-2 text-cu-text-primary">
                            <Lock size={16} className="text-cu-primary" />
                            <h3 className="text-sm font-semibold">Folder level permissions</h3>
                        </div>
                        <button
                            onClick={onCloseFolderPermissions}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-cu-border text-cu-text-secondary hover:bg-cu-hover transition-colors"
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="px-5 py-4 space-y-4">
                        <div>
                            <span className="text-xs text-cu-text-tertiary font-semibold block mb-1">Target folder</span>
                            <span className="text-sm font-medium text-cu-text-primary bg-cu-bg-secondary px-3 py-1.5 rounded-lg border border-cu-border block truncate">
                                {selectedPermsFolder.name}
                            </span>
                        </div>

                        {loadingPerms ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                                <Loader2 className="animate-spin text-cu-primary h-6 w-6" />
                                <p className="text-xs text-cu-text-secondary">Retrieving access matrix...</p>
                            </div>
                        ) : (
                            <>
                                <div className="border border-cu-border rounded-lg overflow-hidden divide-y divide-cu-border">
                                    <div className="grid grid-cols-4 bg-cu-bg-secondary text-xs font-semibold text-cu-text-primary py-2 px-3">
                                        <span className="col-span-1">Team Role</span>
                                        <span className="text-center">READ</span>
                                        <span className="text-center">WRITE</span>
                                        <span className="text-center">MANAGE</span>
                                    </div>

                                    {/* OWNER ALWAYS HAS ALL - IMMUTABLE */}
                                    <div className="grid grid-cols-4 text-xs text-cu-text-secondary py-2.5 px-3 items-center bg-cu-bg-secondary/20">
                                        <span className="col-span-1 font-semibold text-cu-text-primary">OWNER</span>
                                        <span className="text-center text-emerald-500 font-bold"><Check size={14} className="mx-auto" /></span>
                                        <span className="text-center text-emerald-500 font-bold"><Check size={14} className="mx-auto" /></span>
                                        <span className="text-center text-emerald-500 font-bold"><Check size={14} className="mx-auto" /></span>
                                    </div>

                                    {/* ADMIN, MEMBER, VIEWER */}
                                    {['ADMIN', 'MEMBER', 'VIEWER'].map(role => {
                                        const rolePerms = permsState[role] || [];
                                        return (
                                            <div key={role} className="grid grid-cols-4 text-xs text-cu-text-primary py-2.5 px-3 items-center hover:bg-cu-bg-secondary/40">
                                                <span className="col-span-1 font-semibold">{role}</span>
                                                <div className="text-center">
                                                    <input 
                                                        type="checkbox"
                                                        checked={rolePerms.includes('READ')}
                                                        onChange={() => handleTogglePermission(role, 'READ')}
                                                        className="w-4 h-4 text-cu-primary border-cu-border rounded focus:ring-cu-primary/30"
                                                    />
                                                </div>
                                                <div className="text-center">
                                                    <input 
                                                        type="checkbox"
                                                        checked={rolePerms.includes('WRITE')}
                                                        onChange={() => handleTogglePermission(role, 'WRITE')}
                                                        className="w-4 h-4 text-cu-primary border-cu-border rounded focus:ring-cu-primary/30"
                                                    />
                                                </div>
                                                <div className="text-center">
                                                    <input 
                                                        type="checkbox"
                                                        checked={rolePerms.includes('MANAGE')}
                                                        onChange={() => handleTogglePermission(role, 'MANAGE')}
                                                        className="w-4 h-4 text-cu-primary border-cu-border rounded focus:ring-cu-primary/30"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 flex items-start gap-2">
                                    <Shield size={16} className="shrink-0 mt-0.5" />
                                    <p>
                                        <strong className="font-semibold block mb-0.5">Permission hierarchy active:</strong>
                                        MANAGE permission implies WRITE access, which implicitly grants READ access. Modifying higher-tier values automatically adjusts lower tiers.
                                    </p>
                                </div>
                            </>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-cu-border">
                            <button
                                onClick={onCloseFolderPermissions}
                                className="px-4 py-2 text-xs font-semibold border border-cu-border text-cu-text-secondary rounded-lg hover:bg-cu-hover transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => void handleSavePermissions()}
                                disabled={savingPerms || loadingPerms}
                                className="px-4 py-2 text-xs font-semibold bg-cu-primary text-white rounded-lg hover:bg-cu-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {savingPerms ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. SLEEK FILE PREVIEWER MODAL */}
            {previewDoc !== null && (
                <div className="w-full max-w-4xl rounded-xl border border-cu-border bg-cu-bg shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-cu-border px-5 py-4 bg-cu-bg-secondary">
                        <div className="inline-flex items-center gap-2 text-cu-text-primary">
                            <Eye size={16} className="text-cu-primary" />
                            <h3 className="text-sm font-semibold truncate max-w-md md:max-w-xl">Preview: {previewDoc.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {previewDoc.downloadUrl && (
                                <a
                                    href={previewDoc.downloadUrl}
                                    download={previewDoc.name}
                                    className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-cu-border text-xs font-semibold text-cu-text-secondary hover:bg-cu-hover transition-colors"
                                >
                                    <Download size={13} />
                                    Download
                                </a>
                            )}
                            <button
                                onClick={() => setPreviewDoc(null)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-cu-border text-cu-text-secondary hover:bg-cu-hover transition-colors"
                                title="Close"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-5 bg-cu-bg-tertiary/20">
                        {loadingPreview ? (
                            <div className="flex flex-col items-center justify-center py-32 gap-3 text-cu-text-secondary">
                                <Loader2 className="animate-spin text-cu-primary h-8 w-8" />
                                <p className="text-sm">Retrieving secure file segments...</p>
                            </div>
                        ) : (
                            <div className="w-full bg-cu-bg rounded-lg border border-cu-border overflow-hidden">
                                {(() => {
                                    const cType = previewDoc.contentType.toLowerCase();
                                    const isImg = cType.startsWith('image/') || 
                                                  ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => previewDoc.name.toLowerCase().endsWith(ext));
                                    const isPdf = cType === 'application/pdf' || previewDoc.name.toLowerCase().endsWith('.pdf');
                                    const isText = cType === 'text/plain' || previewDoc.name.toLowerCase().endsWith('.txt');
                                    const isMarkdown = cType === 'text/markdown' || previewDoc.name.toLowerCase().endsWith('.md');

                                    if (isImg && previewDoc.downloadUrl) {
                                        return (
                                            <div className="flex items-center justify-center p-6 bg-cu-bg-secondary/40 min-h-[300px] max-h-[500px]">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img 
                                                    src={previewDoc.downloadUrl} 
                                                    alt={previewDoc.name}
                                                    className="max-w-full max-h-[440px] rounded-lg shadow-md object-contain border border-cu-border"
                                                />
                                            </div>
                                        );
                                    }

                                    if (isPdf && previewDoc.downloadUrl) {
                                        return (
                                            <iframe 
                                                src={previewDoc.downloadUrl} 
                                                title={previewDoc.name}
                                                className="w-full h-[550px] rounded-lg border border-cu-border shadow-inner bg-white"
                                            />
                                        );
                                    }

                                    if (isText && previewContent) {
                                        return (
                                            <pre className="whitespace-pre-wrap font-mono p-5 text-xs text-cu-text-secondary bg-cu-bg border-0 max-h-[500px] overflow-y-auto leading-relaxed">
                                                {previewContent}
                                            </pre>
                                        );
                                    }

                                    if (isMarkdown && previewContent) {
                                        return (
                                            <div className="p-6 max-h-[500px] overflow-y-auto bg-cu-bg border-0 text-cu-text-secondary max-w-none">
                                                {renderMarkdownContent(previewContent)}
                                            </div>
                                        );
                                    }

                                    // Fallback when preview is unsupported
                                    return (
                                        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                                            <FileText size={48} className="text-cu-text-muted mb-4" />
                                            <h4 className="text-sm font-semibold text-cu-text-primary mb-1">Preview Unavailable</h4>
                                            <p className="text-xs text-cu-text-secondary max-w-sm mb-4 leading-relaxed">
                                                We do not support inline previewing for this format ({previewDoc.contentType}). Please download the document to view its contents.
                                            </p>
                                            {previewDoc.downloadUrl && (
                                                <a
                                                    href={previewDoc.downloadUrl}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-cu-primary px-4 py-2 text-xs font-semibold text-white hover:bg-cu-primary-hover transition-colors"
                                                >
                                                    <Download size={13} />
                                                    Download File
                                                </a>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 5. VERSION CONTROL & HISTORY COMPARISON PANEL */}
            {selectedVersionsDocId !== null && selectedVersionsDoc && (
                <div className="w-full max-w-3xl rounded-xl border border-cu-border bg-cu-bg shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-cu-border px-5 py-4 bg-cu-bg-secondary">
                        <div className="inline-flex items-center gap-2 text-cu-text-primary">
                            <Clock size={16} className="text-cu-primary" />
                            <h3 className="text-sm font-semibold">Document version control</h3>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedVersionsDocId(null);
                                setIsComparing(false);
                                setCompareLeftVersion(null);
                                setCompareRightVersion(null);
                            }}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-cu-border text-cu-text-secondary hover:bg-cu-hover transition-colors"
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    
                    <div className="px-5 py-4 space-y-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-cu-text-tertiary uppercase tracking-wider font-bold">Document</span>
                            <span className="text-sm font-medium text-cu-text-primary truncate">{selectedVersionsDoc.name}</span>
                        </div>

                        {isComparing ? (
                            // Render Diff/Comparison view
                            <div className="space-y-4 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between border-b border-cu-border/50 pb-2">
                                    <h4 className="text-xs font-bold text-cu-text-primary flex items-center gap-1">
                                        <ArrowLeftRight size={14} className="text-cu-primary" />
                                        Visual Version Comparison
                                    </h4>
                                    <button
                                        onClick={() => setIsComparing(false)}
                                        className="text-xs text-cu-primary hover:text-cu-primary-hover font-semibold transition-colors"
                                    >
                                        Back to versions list
                                    </button>
                                </div>

                                {isBinaryCompare() ? (
                                    // Binary/Image comparison layout
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="border border-cu-border rounded-lg p-4 bg-cu-bg-secondary/40 flex flex-col gap-2">
                                            <h5 className="font-semibold text-xs text-cu-text-primary border-b border-cu-border pb-1">
                                                Version #{compareLeftVersion?.versionNumber}
                                            </h5>
                                            <p className="text-xs text-cu-text-secondary"><span className="font-medium">Uploaded By:</span> {compareLeftVersion?.uploadedByName}</p>
                                            <p className="text-xs text-cu-text-secondary"><span className="font-medium">Date:</span> {compareLeftVersion ? toDateLabel(compareLeftVersion.uploadedAt) : ''}</p>
                                            <p className="text-xs text-cu-text-secondary"><span className="font-medium">Size:</span> {compareLeftVersion ? formatBytes(compareLeftVersion.fileSize) : ''}</p>
                                            <p className="text-xs text-cu-text-secondary"><span className="font-medium">Mime:</span> {compareLeftVersion?.contentType}</p>
                                            {compareLeftVersion?.contentType.startsWith('image/') && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={compareLeftVersion.downloadUrl} alt="L" className="w-full h-36 rounded-md object-contain border border-cu-border bg-white mt-2" />
                                            )}
                                        </div>
                                        <div className="border border-cu-border rounded-lg p-4 bg-cu-bg-secondary/40 flex flex-col gap-2">
                                            <h5 className="font-semibold text-xs text-cu-text-primary border-b border-cu-border pb-1">
                                                Version #{compareRightVersion?.versionNumber}
                                            </h5>
                                            <p className="text-xs text-cu-text-secondary"><span className="font-medium">Uploaded By:</span> {compareRightVersion?.uploadedByName}</p>
                                            <p className="text-xs text-cu-text-secondary"><span className="font-medium">Date:</span> {compareRightVersion ? toDateLabel(compareRightVersion.uploadedAt) : ''}</p>
                                            <p className="text-xs text-cu-text-secondary"><span className="font-medium">Size:</span> {compareRightVersion ? formatBytes(compareRightVersion.fileSize) : ''}</p>
                                            <p className="text-xs text-cu-text-secondary"><span className="font-medium">Mime:</span> {compareRightVersion?.contentType}</p>
                                            {compareRightVersion?.contentType.startsWith('image/') && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={compareRightVersion.downloadUrl} alt="R" className="w-full h-36 rounded-md object-contain border border-cu-border bg-white mt-2" />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // Text comparison layout
                                    renderTextDiff()
                                )}
                            </div>
                        ) : (
                            // List of Versions with selection checkboxes for compare
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-cu-text-tertiary uppercase tracking-wider font-bold">Historical Audited Timeline</span>
                                    {compareLeftVersion && compareRightVersion && (
                                        <button
                                            onClick={() => setIsComparing(true)}
                                            className="px-3 py-1.5 text-xs bg-cu-primary text-white rounded-lg hover:bg-cu-primary-hover font-semibold transition-colors flex items-center gap-1 shadow-sm"
                                        >
                                            <ArrowLeftRight size={12} />
                                            Compare Selected
                                        </button>
                                    )}
                                </div>

                                <div className="max-h-[280px] overflow-y-auto space-y-2 border border-cu-border rounded-lg p-2 bg-cu-bg-tertiary/20">
                                    {(versions[selectedVersionsDocId] || []).map((version) => {
                                        const isLeft = compareLeftVersion?.id === version.id;
                                        const isRight = compareRightVersion?.id === version.id;
                                        const isSelected = isLeft || isRight;

                                        const handleSelectForCompare = () => {
                                            if (isLeft) {
                                                setCompareLeftVersion(null);
                                            } else if (isRight) {
                                                setCompareRightVersion(null);
                                            } else {
                                                if (!compareLeftVersion) {
                                                    setCompareLeftVersion(version);
                                                } else if (!compareRightVersion) {
                                                    setCompareRightVersion(version);
                                                } else {
                                                    // Swap out the older one
                                                    setCompareLeftVersion(compareRightVersion);
                                                    setCompareRightVersion(version);
                                                }
                                            }
                                        };

                                        return (
                                            <div 
                                                key={version.id} 
                                                onClick={handleSelectForCompare}
                                                className={`text-xs flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-all duration-200 ${
                                                    isSelected 
                                                        ? 'bg-cu-primary-light border-cu-primary text-cu-primary font-medium' 
                                                        : 'bg-cu-bg border-cu-border text-cu-text-secondary hover:bg-cu-hover'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-5 h-5 flex items-center justify-center rounded border border-cu-border bg-cu-bg">
                                                        {isLeft && <span className="font-bold text-[10px] text-cu-primary">A</span>}
                                                        {isRight && <span className="font-bold text-[10px] text-cu-primary">B</span>}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold block text-cu-text-primary mb-0.5">Version #{version.versionNumber}</span>
                                                        <span>{formatBytes(version.fileSize)} • {version.contentType}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-cu-text-primary font-semibold mb-0.5">{version.uploadedByName}</span>
                                                    <span>{toDateLabel(version.uploadedAt)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="rounded-lg bg-cu-bg-secondary p-3 text-xs text-cu-text-secondary flex items-start gap-2 border border-cu-border">
                                    <Clock size={16} className="text-cu-primary mt-0.5 shrink-0" />
                                    <p>
                                        To compare two versions side-by-side or perform a detailed delta audit, select two entries above. Label **A** and **B** will denote the left and right comparison panels.
                                    </p>
                                </div>
                            </>
                        )}
                        
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-cu-border">
                            <button
                                onClick={() => {
                                    setSelectedVersionsDocId(null);
                                    setIsComparing(false);
                                    setCompareLeftVersion(null);
                                    setCompareRightVersion(null);
                                }}
                                className="px-4 py-2 text-xs font-semibold border border-cu-border text-cu-text-secondary rounded-lg hover:bg-cu-hover transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. DOCUMENT INFO PANEL */}
            {selectedInfoDoc !== null && (
                <div className="w-full max-w-md rounded-xl border border-cu-border bg-cu-bg shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-cu-border px-5 py-4 bg-cu-bg-secondary">
                        <div className="inline-flex items-center gap-2 text-cu-text-primary">
                            <Info size={16} className="text-cu-primary" />
                            <h3 className="text-sm font-semibold">Document information</h3>
                        </div>
                        <button
                            onClick={() => setSelectedInfoDoc(null)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-cu-border text-cu-text-secondary hover:bg-cu-hover transition-colors"
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="px-5 py-4 space-y-3.5 text-xs text-cu-text-secondary">
                        <div className="grid grid-cols-3 border-b border-cu-border/50 pb-2">
                            <span className="font-semibold text-cu-text-primary">Document ID</span>
                            <span className="col-span-2 font-mono">{selectedInfoDoc.id}</span>
                        </div>
                        <div className="grid grid-cols-3 border-b border-cu-border/50 pb-2">
                            <span className="font-semibold text-cu-text-primary">Name</span>
                            <span className="col-span-2 text-cu-text-primary truncate font-medium">{selectedInfoDoc.name}</span>
                        </div>
                        <div className="grid grid-cols-3 border-b border-cu-border/50 pb-2">
                            <span className="font-semibold text-cu-text-primary">Content Type</span>
                            <span className="col-span-2 truncate">{selectedInfoDoc.contentType}</span>
                        </div>
                        <div className="grid grid-cols-3 border-b border-cu-border/50 pb-2">
                            <span className="font-semibold text-cu-text-primary">File Size</span>
                            <span className="col-span-2">{selectedInfoDoc.humanReadableSize ?? formatBytes(selectedInfoDoc.fileSize)}</span>
                        </div>
                        <div className="grid grid-cols-3 border-b border-cu-border/50 pb-2">
                            <span className="font-semibold text-cu-text-primary">Directory</span>
                            <span className="col-span-2 truncate">{selectedInfoDoc.folderName ?? getFolderName(selectedInfoDoc.folderId)}</span>
                        </div>
                        <div className="grid grid-cols-3 border-b border-cu-border/50 pb-2">
                            <span className="font-semibold text-cu-text-primary">Creator</span>
                            <span className="col-span-2 font-medium text-cu-text-primary">{selectedInfoDoc.uploadedByName}</span>
                        </div>
                        <div className="grid grid-cols-3 border-b border-cu-border/50 pb-2">
                            <span className="font-semibold text-cu-text-primary">Audit Version</span>
                            <span className="col-span-2 font-bold text-cu-primary">v{selectedInfoDoc.latestVersionNumber}</span>
                        </div>
                        <div className="grid grid-cols-3 pb-2">
                            <span className="font-semibold text-cu-text-primary">Last Updated</span>
                            <span className="col-span-2">{toDateLabel(selectedInfoDoc.updatedAt || selectedInfoDoc.createdAt)}</span>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </OverlayPortal>
    );
}
