'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    createFolder,
    deleteFolder,
    DocumentFolder,
    DocumentItem,
    DocumentVersionItem,
    getDocumentDownloadUrl,
    getDocumentVersions,
    listDocuments,
    listFolders,
    listUserProjects,
    permanentDeleteDocument,
    restoreDocument,
    softDeleteDocument,
    updateDocumentMetadata,
    uploadDocument,
    getFolderPermissions,
    updateFolderPermissions,
    getProjectStorageQuota,
    ProjectStorageQuotaResponse,
    FolderPermissionRequest,
    DmsError,
} from '@/lib/dms';
import { filterDocuments, getFolderLabel, sortDocuments } from '@/app/folders/components/dmsUtils';
import {
    DocumentFilters,
    DocumentSortDirection,
    DocumentSortKey,
    ViewMode,
} from '@/app/folders/components/types';

const FAVORITES_KEY = 'dmsFavoriteDocumentIds';
const DEFAULT_FILTERS: DocumentFilters = {
    search: '',
    type: 'all',
    folderId: 'all',
    uploader: '',
    favoriteOnly: false,
    dateRange: 'all',
};

function getDmsErrorMessage(error: unknown, fallback: string): string {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const data = (error as { response?: { data?: { message?: string; errorCode?: string } | string } })?.response?.data;
    const errorCode = typeof data === 'object' && data !== null ? data.errorCode : undefined;
    const responseMessage = typeof data === 'string' ? data : data?.message;

    if (error instanceof DmsError) {
        if (error.kind === 'PERMISSION_DENIED') {
            return 'Permission denied. You do not have access to perform this document action.';
        }
        if (error.kind === 'QUOTA_EXCEEDED') {
            return error.message || 'Project storage quota exceeded. Delete files or contact an admin before uploading more documents.';
        }
        return error.message || fallback;
    }

    if (status === 403 || errorCode === 'FORBIDDEN') {
        return 'Permission denied. You do not have access to perform this document action.';
    }

    if (status === 413 || errorCode === 'STORAGE_QUOTA_EXCEEDED') {
        return responseMessage || 'Project storage quota exceeded. Delete files or contact an admin before uploading more documents.';
    }

    const message = (error as { message?: string })?.message;
    return responseMessage?.trim() || message?.trim() || fallback;
}

export function useDmsWorkspace(mode: ViewMode) {
    const searchParams = useSearchParams();
    const [projectId] = useState<number | null>(() => {
        const qp = searchParams.get('projectId');
        const stored = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
        const id = Number(qp || stored);
        return Number.isFinite(id) && id > 0 ? id : null;
    });
    const [folders, setFolders] = useState<DocumentFolder[]>([]);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<number | undefined>(undefined);
    const [newFolderName, setNewFolderName] = useState('');
    const [selectedVersionsDocId, setSelectedVersionsDocId] = useState<number | null>(null);
    const [selectedInfoDoc, setSelectedInfoDoc] = useState<DocumentItem | null>(null);
    const [versions, setVersions] = useState<Record<number, DocumentVersionItem[]>>({});
    const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
    const [documentFilters, setDocumentFilters] = useState<DocumentFilters>(DEFAULT_FILTERS);
    const [sortKey, setSortKey] = useState<DocumentSortKey>('updatedAt');
    const [sortDirection, setSortDirection] = useState<DocumentSortDirection>('desc');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);
    const [renameDoc, setRenameDoc] = useState<DocumentItem | null>(null);
    const [renameName, setRenameName] = useState('');

    const [quota, setQuota] = useState<ProjectStorageQuotaResponse | null>(null);
    const [selectedPermsFolder, setSelectedPermsFolder] = useState<DocumentFolder | null>(null);
    const [folderPermissions, setFolderPermissions] = useState<FolderPermissionRequest[]>([]);
    const [loadingPerms, setLoadingPerms] = useState(false);
    const [savingPerms, setSavingPerms] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

    const isTrashMode = mode === 'trash';

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = localStorage.getItem(FAVORITES_KEY);
        if (!raw) { setFavoriteIds([]); return; }
        try {
            const parsed = JSON.parse(raw) as number[];
            setFavoriteIds(Array.isArray(parsed) ? parsed : []);
        } catch { setFavoriteIds([]); }
    }, []);

    useEffect(() => {
        if (!projectId) { setLoading(false); return; }
        const load = async () => {
            try {
                setLoading(true); setError(null);
                const [folderData, documentData, allProjects, quotaData] = await Promise.all([
                    listFolders(projectId),
                    listDocuments(projectId, undefined, isTrashMode),
                    listUserProjects(),
                    getProjectStorageQuota(projectId),
                ]);
                setFolders(folderData);
                setDocuments(documentData);
                setQuota(quotaData);
                const match = allProjects.find((p) => p.id === projectId);
                setCurrentProjectName(match?.name ?? null);
            } catch { setError('Failed to load folder and document data.'); }
            finally { setLoading(false); }
        };
        void load();
    }, [projectId, isTrashMode]);

    const folderNameMap = useMemo(() => {
        return folders.reduce<Record<number, string>>((acc, folder) => {
            acc[folder.id] = folder.name;
            return acc;
        }, {});
    }, [folders]);

    const uploaderOptions = useMemo(() => {
        return Array.from(new Set(documents.map((doc) => doc.uploadedByName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [documents]);

    const setSelectedFolder = (folderId: number | undefined) => {
        setSelectedFolderId(folderId);
        setDocumentFilters((prev) => ({ ...prev, folderId: folderId ?? 'all' }));
    };

    const setSearchQuery = (search: string) => {
        setDocumentFilters((prev) => ({ ...prev, search }));
    };

    const updateDocumentFilters = (next: Partial<DocumentFilters>) => {
        if ('folderId' in next) {
            setSelectedFolderId(typeof next.folderId === 'number' ? next.folderId : undefined);
        }
        setDocumentFilters((prev) => ({ ...prev, ...next }));
    };

    const clearDocumentFilters = () => {
        setSelectedFolderId(undefined);
        setDocumentFilters(DEFAULT_FILTERS);
    };

    const baseDocuments = useMemo(() => {
        return documents.filter((doc) => {
            if (isTrashMode && doc.status !== 'SOFT_DELETED') return false;
            if (!isTrashMode && doc.status !== 'ACTIVE') return false;
            if (mode === 'favorites' && !favoriteIds.includes(doc.id)) return false;
            return true;
        });
    }, [documents, favoriteIds, isTrashMode, mode]);

    const filteredDocuments = useMemo(() => {
        let result = filterDocuments(baseDocuments, documentFilters, favoriteIds, folderNameMap);
        if (mode === 'recent') {
            result = sortDocuments(result, 'updatedAt', 'desc', folderNameMap).slice(0, 20);
        }
        return sortDocuments(result, sortKey, sortDirection, folderNameMap);
    }, [baseDocuments, documentFilters, favoriteIds, folderNameMap, mode, sortDirection, sortKey]);

    const activeFilterCount = useMemo(() => {
        return Number(documentFilters.search.trim().length > 0)
            + Number(documentFilters.type !== 'all')
            + Number(documentFilters.folderId !== 'all')
            + Number(Boolean(documentFilters.uploader))
            + Number(documentFilters.favoriteOnly)
            + Number(documentFilters.dateRange !== 'all');
    }, [documentFilters]);

    const hasActiveFilters = activeFilterCount > 0;
    const totalDocumentCount = baseDocuments.length;
    const getDocumentFolderName = (doc: DocumentItem) => getFolderLabel(doc, folderNameMap);

    const title = useMemo(() => {
        const map: Record<string, string> = { recent: 'Recent', favorites: 'Favorites', trash: 'Trash' };
        return map[mode] ?? 'All Documents';
    }, [mode]);

    const refresh = async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            setError(null);
            const [folderData, documentData, allProjects, quotaData] = await Promise.all([
                listFolders(projectId),
                listDocuments(projectId, undefined, isTrashMode),
                listUserProjects(),
                getProjectStorageQuota(projectId),
            ]);
            setFolders(folderData);
            setDocuments(documentData);
            setQuota(quotaData);
            const match = allProjects.find((p) => p.id === projectId);
            setCurrentProjectName(match?.name ?? null);
        } catch {
            setError('Failed to load folder and document data.');
        } finally {
            setLoading(false);
        }
    };

    const withProjectId = (basePath: string) =>
        projectId ? `${basePath}?projectId=${projectId}` : basePath;

    const getFolderName = (folderId: number | null) =>
        folderId ? folders.find((f) => f.id === folderId)?.name ?? 'Root' : 'Root';

    const onCreateFolder = async () => {
        if (!projectId || !newFolderName.trim()) return;
        try {
            setBusy(true);
            const created = await createFolder(projectId, newFolderName.trim());
            setFolders((prev) => [...prev, created]);
            setNewFolderName('');
        } catch (err) { setError(getDmsErrorMessage(err, 'Failed to create folder.')); }
        finally { setBusy(false); }
    };

    const onDeleteFolder = async (folder: DocumentFolder) => {
        if (!projectId || isTrashMode) return;
        const activeCount = documents.filter((d) => d.folderId === folder.id && d.status === 'ACTIVE').length;
        const msg = activeCount > 0
            ? `Delete folder "${folder.name}"?\n\nThis folder contains ${activeCount} document(s). Deleting this folder will also move all documents inside it to Trash.`
            : `Are you sure you want to delete folder "${folder.name}"?`;
        if (!window.confirm(msg)) return;
        try {
            setBusy(true);
            await deleteFolder(projectId, folder.id);
            setFolders((prev) => prev.filter((f) => f.id !== folder.id));
            if (selectedFolderId === folder.id) setSelectedFolder(undefined);
            await refresh();
        } catch (err) { setError(getDmsErrorMessage(err, 'Failed to delete folder. You may need Owner/Admin permission.')); }
        finally { setBusy(false); }
    };

    const handleUploadFile = async (file: File) => {
        if (!projectId) return;
        try {
            setBusy(true); setIsUploading(true); setUploadProgress(0);
            await uploadDocument(projectId, file, selectedFolderId, (p) => setUploadProgress(p));
            await refresh();
        } catch (err) {
            setError(getDmsErrorMessage(err, 'Upload failed.'));
        } finally { setBusy(false); setIsUploading(false); setUploadProgress(0); }
    };

    const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) { await handleUploadFile(file); event.target.value = ''; }
    };

    const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) await handleUploadFile(file);
    };

    const onDownload = async (documentId: number) => {
        if (!projectId) return;
        try { window.open(await getDocumentDownloadUrl(projectId, documentId), '_blank', 'noopener,noreferrer'); }
        catch (err) { setError(getDmsErrorMessage(err, 'Failed to generate download URL.')); }
    };

    const onView = async (documentId: number) => {
        if (!projectId) return;
        try {
            setBusy(true);
            const doc = documents.find(d => d.id === documentId) || filteredDocuments.find(d => d.id === documentId);
            if (!doc) return;
            const downloadUrl = await getDocumentDownloadUrl(projectId, documentId);
            setPreviewDoc({ ...doc, downloadUrl });
        } catch (err) {
            setError(getDmsErrorMessage(err, 'Failed to open document preview.'));
        } finally {
            setBusy(false);
        }
    };

    const onRename = (document: DocumentItem) => {
        setRenameDoc(document);
        setRenameName(document.name);
    };

    const onConfirmRename = async () => {
        if (!projectId || !renameDoc || !renameName.trim() || renameName.trim() === renameDoc.name) {
            setRenameDoc(null);
            setRenameName('');
            return;
        }
        try {
            setBusy(true);
            await updateDocumentMetadata(projectId, renameDoc.id, { name: renameName.trim() });
            await refresh();
        } catch (err) { setError(getDmsErrorMessage(err, 'Failed to rename document.')); }
        finally { setBusy(false); setRenameDoc(null); setRenameName(''); }
    };

    const onCancelRename = () => { setRenameDoc(null); setRenameName(''); };

    const onSoftDelete = async (documentId: number) => {
        if (!projectId) return;
        try { setBusy(true); await softDeleteDocument(projectId, documentId); await refresh(); }
        catch (err) { setError(getDmsErrorMessage(err, 'Failed to delete document. You may need Owner/Admin permission.')); }
        finally { setBusy(false); }
    };

    const onRestore = async (documentId: number) => {
        if (!projectId) return;
        const msg = "Restore Document?\n\nThis will recover the document from the Trash and place it back into its original folder as an active asset.";
        if (!window.confirm(msg)) return;
        try { setBusy(true); await restoreDocument(projectId, documentId); await refresh(); }
        catch (err) { setError(getDmsErrorMessage(err, 'Failed to restore document.')); }
        finally { setBusy(false); }
    };

    const onPermanentDelete = async (documentId: number) => {
        if (!projectId) return;
        const msg = "WARNING: Permanent Deletion!\n\nThis action cannot be undone. Restoring the document will be impossible, all version histories will be wiped, and the file bytes will be permanently deleted from S3 storage.\n\nAre you sure you want to proceed?";
        if (!window.confirm(msg)) return;
        try { setBusy(true); await permanentDeleteDocument(projectId, documentId); await refresh(); }
        catch (err) { setError(getDmsErrorMessage(err, 'Failed to permanently delete document.')); }
        finally { setBusy(false); }
    };

    const onToggleFavorite = (documentId: number) => {
        const next = favoriteIds.includes(documentId)
            ? favoriteIds.filter((id) => id !== documentId)
            : [...favoriteIds, documentId];
        setFavoriteIds(next);
        if (typeof window !== 'undefined') localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    };

    const onToggleVersions = async (documentId: number) => {
        if (!projectId) return;
        if (selectedVersionsDocId === documentId) { setSelectedVersionsDocId(null); return; }
        setSelectedVersionsDocId(documentId);
        if (versions[documentId]) return;
        try {
            setVersions((prev) => ({ ...prev, [documentId]: [] }));
            const data = await getDocumentVersions(projectId, documentId);
            setVersions((prev) => ({ ...prev, [documentId]: data }));
        } catch (err) { setError(getDmsErrorMessage(err, 'Failed to load version history.')); }
    };

    const onOpenInfo = (document: DocumentItem) => setSelectedInfoDoc(document);

    const onOpenFolderPermissions = async (folder: DocumentFolder) => {
        if (!projectId) return;
        try {
            setLoadingPerms(true);
            setSelectedPermsFolder(folder);
            const data = await getFolderPermissions(projectId, folder.id);
            setFolderPermissions(data);
        } catch (err) {
            setError(getDmsErrorMessage(err, 'Failed to load folder permissions.'));
        } finally {
            setLoadingPerms(false);
        }
    };

    const onSaveFolderPermissions = async (permissions: FolderPermissionRequest[]) => {
        if (!projectId || !selectedPermsFolder) return;
        try {
            setSavingPerms(true);
            await updateFolderPermissions(projectId, selectedPermsFolder.id, permissions);
            setSelectedPermsFolder(null);
            setFolderPermissions([]);
        } catch (err) {
            setError(getDmsErrorMessage(err, 'Failed to update folder permissions. You may need Owner/Admin permission.'));
        } finally {
            setSavingPerms(false);
        }
    };

    const onCloseFolderPermissions = () => {
        setSelectedPermsFolder(null);
        setFolderPermissions([]);
    };

    const selectedVersionsDoc = selectedVersionsDocId
        ? filteredDocuments.find((d) => d.id === selectedVersionsDocId)
            ?? documents.find((d) => d.id === selectedVersionsDocId)
            ?? null
        : null;

    return {
        projectId, currentProjectName, folders, documents, loading, busy, error, isTrashMode,
        selectedFolderId, setSelectedFolderId: setSelectedFolder,
        newFolderName, setNewFolderName,
        selectedVersionsDocId, setSelectedVersionsDocId, selectedVersionsDoc,
        selectedInfoDoc, setSelectedInfoDoc,
        renameDoc, renameName, setRenameName,
        versions, favoriteIds,
        searchQuery: documentFilters.search, setSearchQuery,
        documentFilters, updateDocumentFilters, clearDocumentFilters,
        sortKey, setSortKey, sortDirection, setSortDirection,
        filteredDocuments, baseDocuments, totalDocumentCount, activeFilterCount, hasActiveFilters,
        uploaderOptions, getDocumentFolderName, title,
        folderCount: folders.length,
        withProjectId, getFolderName,
        onCreateFolder, onDeleteFolder, onUpload, onDrop,
        onDownload, onView, onRename, onConfirmRename, onCancelRename, onSoftDelete, onRestore,
        onPermanentDelete, onToggleFavorite, onToggleVersions, onOpenInfo,
        isDragOver, setIsDragOver, isUploading, uploadProgress, refresh,
        quota, selectedPermsFolder, folderPermissions, loadingPerms, savingPerms,
        onOpenFolderPermissions, onSaveFolderPermissions, onCloseFolderPermissions,
        previewDoc, setPreviewDoc,
    };
}
