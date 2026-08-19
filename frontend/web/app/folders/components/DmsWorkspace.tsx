'use client';

import { useRef, useState } from 'react';
import { FileSearch, Loader2, RefreshCw, UploadCloud } from 'lucide-react';
import DmsHeader from '@/app/folders/components/DmsHeader';
import DmsSidebar from '@/app/folders/components/DmsSidebar';
import DmsDocumentsTable from '@/app/folders/components/DmsDocumentsTable';
import DmsPagination from '@/app/folders/components/DmsPagination';
import DmsModals from '@/app/folders/components/DmsModals';
import DmsDocumentToolbar from '@/app/folders/components/DmsDocumentToolbar';
import { ViewMode } from '@/app/folders/components/types';
import { useDmsWorkspace } from '@/app/folders/hooks/useDmsWorkspace';
import EmptyState from '@/components/shared/EmptyState';
import DmsUploadQueue from '@/app/folders/components/DmsUploadQueue';

interface DmsWorkspaceProps {
    mode: ViewMode;
}

export default function DmsWorkspace({ mode }: DmsWorkspaceProps) {
    const {
        loading, error, projectId, currentProjectName, isTrashMode, title, busy,
        folders, selectedFolderId, setSelectedFolderId,
        newFolderName, setNewFolderName, folderCount,
        filteredDocuments, favoriteIds,
        currentPage, pageSize, totalPages, startIndex, endIndex, paginatedDocuments, totalFilteredCount,
        setPage, setPageSize,
        setSearchQuery,
        documentFilters, updateDocumentFilters, clearDocumentFilters,
        sortKey, setSortKey, sortDirection, setSortDirection,
        totalDocumentCount, activeFilterCount, hasActiveFilters,
        uploaderOptions, getDocumentFolderName,
        selectedVersionsDocId, setSelectedVersionsDocId,
        selectedVersionsDoc, selectedInfoDoc, setSelectedInfoDoc,
        renameDoc, renameName, setRenameName,
        deleteDoc, onConfirmSoftDelete, onCancelSoftDelete,
        permanentDeleteDoc, onConfirmPermanentDelete, onCancelPermanentDelete,
        restoreDoc, onConfirmRestore, onCancelRestore,
        versions,
        withProjectId, getFolderName,
        onCreateFolder, onDeleteFolder, onUpload, onDrop,
        onToggleFavorite, onView, onDownload, onRename, onConfirmRename, onCancelRename,
        onSoftDelete, onToggleVersions, onOpenInfo, onRestore, onPermanentDelete,
        refresh,
        quota, selectedPermsFolder, folderPermissions, loadingPerms, savingPerms,
        onOpenFolderPermissions, onSaveFolderPermissions, onCloseFolderPermissions,
        previewDoc, setPreviewDoc,
        uploadQueue, uploadCapabilities, isInitializingUploads,
        cancelUpload, cancelRemainingUploads, retryUploads, clearFinishedUploads,
    } = useDmsWorkspace(mode);

    const dragCounter = useRef(0);
    const [isDragOver, setIsDragOver] = useState(false);

    const onSortChange = (key: typeof sortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortKey(key);
        setSortDirection(key === 'name' || key === 'uploadedByName' || key === 'folderName' ? 'asc' : 'desc');
    };

    const emptyTitle = (() => {
        if (hasActiveFilters) return 'No documents match your filters';
        if (isTrashMode) return 'Trash is empty';
        if (mode === 'favorites') return 'No favorite documents yet';
        if (mode === 'recent') return 'No recent documents yet';
        return 'No documents yet';
    })();

    const emptySubtitle = (() => {
        if (hasActiveFilters) return 'Adjust or clear the filters to widen the results.';
        if (isTrashMode) return 'Deleted documents will appear here before they are permanently removed.';
        if (mode === 'favorites') return 'Star important files to keep them close at hand.';
        if (mode === 'recent') return 'Recently updated files will appear here after your team starts uploading.';
        return 'Upload a file or create a folder to build this project library.';
    })();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-cu-bg-secondary">
                <Loader2 className="h-6 w-6 animate-spin text-cu-primary" />
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center px-4">
                <EmptyState
                    title="No project selected"
                    subtitle="Open a project first, then navigate to Documents. Folders and files always belong to a specific project."
                    action={
                        <a
                            href="/dashboard"
                            className="inline-flex items-center gap-2 rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-cu-primary-hover transition-colors"
                        >
                            Open dashboard
                        </a>
                    }
                />
            </div>
        );
    }

    return (
        <>
            <div
                className="w-full max-w-[1400px] mx-auto min-h-[calc(100vh-160px)] rounded-xl border border-cu-border bg-cu-bg-secondary shadow-sm overflow-hidden relative"
                onDragEnter={(e) => {
                    e.preventDefault();
                    dragCounter.current++;
                    if (dragCounter.current === 1) setIsDragOver(true);
                }}
                onDragLeave={() => {
                    dragCounter.current--;
                    if (dragCounter.current === 0) setIsDragOver(false);
                }}
                onDragOver={(e) => { e.preventDefault(); }} // keep for drop permission
                onDrop={(e) => {
                    e.preventDefault();
                    dragCounter.current = 0;
                    setIsDragOver(false);
                    onDrop(e);
                }}
            >
                {/* pointer-events-none on the overlay so underlying drag events still fire on the container */}
                {isDragOver && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-cu-primary-light/90 backdrop-blur-sm pointer-events-none">
                        <div className="rounded-cu-lg border-2 border-dashed border-cu-primary bg-cu-bg px-8 py-7 text-center shadow-cu-lg">
                            <UploadCloud size={34} className="mx-auto text-cu-primary" />
                            <p className="mt-3 text-lg font-bold text-cu-text-primary">Drop files to upload</p>
                            <p className="mt-1 text-sm text-cu-text-secondary">Up to 25 files will be added to the selected folder.</p>
                        </div>
                    </div>
                )}

                <DmsHeader
                    title={title} isTrashMode={isTrashMode} onUpload={onUpload}
                    accept={uploadCapabilities?.acceptedExtensions.map((extension) => `.${extension}`).join(',')}
                    initializing={isInitializingUploads}
                    uploadEnabled={uploadCapabilities?.multiUploadEnabled !== false}
                />

                <div className="grid grid-cols-12 min-h-[70vh]">
                    <DmsSidebar
                        mode={mode} isTrashMode={isTrashMode} projectId={projectId}
                        projectName={currentProjectName}
                        folders={folders} selectedFolderId={selectedFolderId}
                        setSelectedFolderId={setSelectedFolderId}
                        onDeleteFolder={onDeleteFolder} newFolderName={newFolderName}
                        setNewFolderName={setNewFolderName} onCreateFolder={onCreateFolder}
                        busy={busy} folderCount={folderCount}
                        filteredDocumentCount={filteredDocuments.length}
                        withProjectId={withProjectId}
                        quota={quota}
                        onOpenFolderPermissions={onOpenFolderPermissions}
                    />

                    <section className="col-span-12 lg:col-span-9 xl:col-span-10 bg-cu-bg">
                        <DmsDocumentToolbar
                            filters={documentFilters}
                            sortKey={sortKey}
                            sortDirection={sortDirection}
                            folders={folders}
                            uploaderOptions={uploaderOptions}
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            visibleCount={paginatedDocuments.length}
                            totalCount={totalDocumentCount}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            totalFilteredCount={totalFilteredCount}
                            busy={busy}
                            onFiltersChange={updateDocumentFilters}
                            onSearchChange={setSearchQuery}
                            onClearFilters={clearDocumentFilters}
                            onSortKeyChange={setSortKey}
                            onSortDirectionChange={setSortDirection}
                            onRefresh={() => void refresh()}
                        />

                        {error && (
                            <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-3 flex-wrap">
                                <span>{error}</span>
                                <button
                                    type="button"
                                    onClick={() => void refresh()}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                                >
                                    <RefreshCw size={13} />
                                    Retry
                                </button>
                            </div>
                        )}
                        {filteredDocuments.length === 0 ? (
                            <div className="px-6 py-10">
                                <EmptyState
                                    icon={<FileSearch size={34} />}
                                    title={emptyTitle}
                                    subtitle={emptySubtitle}
                                    action={
                                        hasActiveFilters ? (
                                            <button
                                                type="button"
                                                onClick={clearDocumentFilters}
                                                className="inline-flex items-center gap-2 rounded-cu-md bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cu-primary-hover"
                                            >
                                                Clear filters
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => void refresh()}
                                                className="inline-flex items-center gap-2 rounded-cu-md bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cu-primary-hover"
                                            >
                                                <RefreshCw size={14} />
                                                Refresh
                                            </button>
                                        )
                                    }
                                />
                            </div>
                        ) : (
                            <>
                                <DmsDocumentsTable
                                    filteredDocuments={paginatedDocuments} favoriteIds={favoriteIds}
                                    isTrashMode={isTrashMode} mode={mode} busy={busy}
                                    sortKey={sortKey} sortDirection={sortDirection}
                                    getDocumentFolderName={getDocumentFolderName}
                                    onSortChange={onSortChange}
                                    onToggleFavorite={onToggleFavorite} onView={onView} onDownload={onDownload}
                                    onRename={onRename} onSoftDelete={onSoftDelete}
                                    onToggleVersions={onToggleVersions} onOpenInfo={onOpenInfo}
                                    onRestore={onRestore} onPermanentDelete={onPermanentDelete}
                                />
                                <DmsPagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    pageSize={pageSize}
                                    totalItems={totalFilteredCount}
                                    startIndex={startIndex}
                                    endIndex={endIndex}
                                    onPageChange={setPage}
                                    onPageSizeChange={setPageSize}
                                    disabled={busy}
                                />
                            </>
                        )}
                    </section>
                </div>
            </div>

            <DmsModals
                selectedVersionsDocId={selectedVersionsDocId} selectedVersionsDoc={selectedVersionsDoc}
                versions={versions} setSelectedVersionsDocId={setSelectedVersionsDocId}
                selectedInfoDoc={selectedInfoDoc} setSelectedInfoDoc={setSelectedInfoDoc}
                getFolderName={getFolderName}
                renameDoc={renameDoc} renameName={renameName} setRenameName={setRenameName}
                onConfirmRename={onConfirmRename} onCancelRename={onCancelRename}
                deleteDoc={deleteDoc} onConfirmSoftDelete={onConfirmSoftDelete} onCancelSoftDelete={onCancelSoftDelete}
                permanentDeleteDoc={permanentDeleteDoc} onConfirmPermanentDelete={onConfirmPermanentDelete} onCancelPermanentDelete={onCancelPermanentDelete}
                restoreDoc={restoreDoc} onConfirmRestore={onConfirmRestore} onCancelRestore={onCancelRestore}
                busy={busy}
                selectedPermsFolder={selectedPermsFolder} folderPermissions={folderPermissions}
                loadingPerms={loadingPerms} savingPerms={savingPerms}
                onSaveFolderPermissions={onSaveFolderPermissions} onCloseFolderPermissions={onCloseFolderPermissions}
                projectId={projectId}
                previewDoc={previewDoc} setPreviewDoc={setPreviewDoc}
            />
            <DmsUploadQueue
                items={uploadQueue} initializing={isInitializingUploads}
                onCancel={cancelUpload} onCancelRemaining={cancelRemainingUploads}
                onRetry={(ids) => void retryUploads(ids)} onClearFinished={clearFinishedUploads}
            />
        </>
    );
}
