'use client';

import { DocumentItem } from '@/lib/dms';
import {
    ArrowDown,
    ArrowUp,
    Download,
    Eye,
    FileClock,
    FileText,
    Info,
    Pencil,
    RotateCcw,
    Star,
    Trash2,
} from 'lucide-react';
import {
    DOCUMENT_SORT_LABELS,
    formatBytes,
    getDocumentTypeLabel,
    getDocumentTypeTone,
    timeAgo,
    toDateLabel,
} from '@/app/folders/components/dmsUtils';
import { DocumentSortDirection, DocumentSortKey, ViewMode } from '@/app/folders/components/types';

interface DmsDocumentsTableProps {
    filteredDocuments: DocumentItem[];
    favoriteIds: number[];
    isTrashMode: boolean;
    mode: ViewMode;
    loading?: boolean;
    busy?: boolean;
    sortKey: DocumentSortKey;
    sortDirection: DocumentSortDirection;
    getDocumentFolderName: (document: DocumentItem) => string;
    onSortChange: (key: DocumentSortKey) => void;
    onToggleFavorite: (documentId: number) => void;
    onView: (documentId: number) => void;
    onDownload: (documentId: number) => void;
    onRename: (document: DocumentItem) => void;
    onSoftDelete: (document: DocumentItem) => void;
    onToggleVersions: (documentId: number) => void;
    onOpenInfo: (document: DocumentItem) => void;
    onRestore: (documentId: number) => void;
    onPermanentDelete: (document: DocumentItem) => void;
}

const columns: Array<{ key: DocumentSortKey; label: string; className?: string }> = [
    { key: 'name', label: DOCUMENT_SORT_LABELS.name, className: 'min-w-[280px]' },
    { key: 'folderName', label: DOCUMENT_SORT_LABELS.folderName },
    { key: 'uploadedByName', label: DOCUMENT_SORT_LABELS.uploadedByName },
    { key: 'fileSize', label: DOCUMENT_SORT_LABELS.fileSize },
    { key: 'updatedAt', label: DOCUMENT_SORT_LABELS.updatedAt },
    { key: 'latestVersionNumber', label: DOCUMENT_SORT_LABELS.latestVersionNumber },
];

function SortIcon({ active, direction }: { active: boolean; direction: DocumentSortDirection }) {
    if (!active) return <ArrowUp size={12} className="opacity-25" />;
    return direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

function ActionButton({
    label,
    danger = false,
    children,
    onClick,
    disabled,
}: {
    label: string;
    danger?: boolean;
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-cu-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                danger
                    ? 'border-cu-danger/35 text-cu-danger hover:bg-cu-danger-light'
                    : 'border-cu-border text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
            }`}
            title={label}
            aria-label={label}
        >
            {children}
        </button>
    );
}

function DocumentActions({
    doc,
    isTrashMode,
    busy,
    onView,
    onDownload,
    onRename,
    onSoftDelete,
    onToggleVersions,
    onOpenInfo,
    onRestore,
    onPermanentDelete,
}: Pick<
    DmsDocumentsTableProps,
    'isTrashMode' | 'busy' | 'onView' | 'onDownload' | 'onRename' | 'onSoftDelete' | 'onToggleVersions' | 'onOpenInfo' | 'onRestore' | 'onPermanentDelete'
> & { doc: DocumentItem }) {
    if (isTrashMode) {
        return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
                <ActionButton label="Restore" disabled={busy} onClick={() => onRestore(doc.id)}>
                    <RotateCcw size={14} />
                </ActionButton>
                <ActionButton label="Delete forever" danger disabled={busy} onClick={() => onPermanentDelete(doc)}>
                    <Trash2 size={14} />
                </ActionButton>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
            <ActionButton label="View" disabled={busy} onClick={() => onView(doc.id)}>
                <Eye size={14} />
            </ActionButton>
            <ActionButton label="Download" disabled={busy} onClick={() => onDownload(doc.id)}>
                <Download size={14} />
            </ActionButton>
            <ActionButton label="Rename" disabled={busy} onClick={() => onRename(doc)}>
                <Pencil size={14} />
            </ActionButton>
            <ActionButton label="Versions" disabled={busy} onClick={() => onToggleVersions(doc.id)}>
                <FileClock size={14} />
            </ActionButton>
            <ActionButton label="Info" disabled={busy} onClick={() => onOpenInfo(doc)}>
                <Info size={14} />
            </ActionButton>
            <ActionButton label="Delete" danger disabled={busy} onClick={() => onSoftDelete(doc)}>
                <Trash2 size={14} />
            </ActionButton>
        </div>
    );
}

export default function DmsDocumentsTable({
    filteredDocuments,
    favoriteIds,
    isTrashMode,
    mode,
    loading = false,
    busy = false,
    sortKey,
    sortDirection,
    getDocumentFolderName,
    onSortChange,
    onToggleFavorite,
    onView,
    onDownload,
    onRename,
    onSoftDelete,
    onToggleVersions,
    onOpenInfo,
    onRestore,
    onPermanentDelete,
}: DmsDocumentsTableProps) {
    if (loading && filteredDocuments.length === 0) {
        return (
            <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-16 animate-pulse rounded-cu-lg border border-cu-border bg-cu-bg-secondary" />
                ))}
            </div>
        );
    }

    return (
        <>
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1040px]">
                    <thead>
                        <tr className="border-b border-cu-border bg-cu-bg-secondary text-left text-xs uppercase text-cu-text-secondary">
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={`px-4 py-3 font-semibold ${column.className ?? ''}`}
                                    aria-sort={sortKey === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSortChange(column.key)}
                                        className="inline-flex items-center gap-1.5 rounded-cu-sm text-left transition-colors hover:text-cu-text-primary focus:outline-none focus:ring-2 focus:ring-cu-primary/20"
                                    >
                                        {column.label}
                                        <SortIcon active={sortKey === column.key} direction={sortDirection} />
                                    </button>
                                </th>
                            ))}
                            <th className="px-4 py-3 font-semibold">Type</th>
                            <th className="px-4 py-3 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDocuments.map((doc) => {
                            const isFavorite = favoriteIds.includes(doc.id);
                            const folderName = getDocumentFolderName(doc);

                            return (
                                <tr key={doc.id} className="border-b border-cu-border-light align-middle transition-colors hover:bg-cu-hover">
                                    <td className="px-4 py-4">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-cu-md border border-cu-border bg-cu-bg-secondary text-cu-text-secondary">
                                                <FileText size={17} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <p className="truncate text-sm font-semibold text-cu-text-primary">{doc.name}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => onToggleFavorite(doc.id)}
                                                        disabled={busy}
                                                        className="shrink-0 text-cu-text-tertiary transition-colors hover:text-cu-warning disabled:opacity-50"
                                                        title={isFavorite ? 'Remove favorite' : 'Add favorite'}
                                                        aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
                                                    >
                                                        <Star
                                                            size={15}
                                                            fill={isFavorite ? 'var(--cu-warning)' : 'none'}
                                                            color={isFavorite ? 'var(--cu-warning)' : 'currentColor'}
                                                        />
                                                    </button>
                                                </div>
                                                <p className="mt-1 truncate text-xs text-cu-text-secondary">{doc.contentType}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-cu-text-secondary">{folderName}</td>
                                    <td className="px-4 py-4 text-sm text-cu-text-secondary">{doc.uploadedByName}</td>
                                    <td className="px-4 py-4 text-sm text-cu-text-secondary whitespace-nowrap">{doc.humanReadableSize ?? formatBytes(doc.fileSize)}</td>
                                    <td className="px-4 py-4 text-sm text-cu-text-secondary whitespace-nowrap" title={toDateLabel(doc.updatedAt)}>
                                        {timeAgo(doc.updatedAt)}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="inline-flex rounded-full border border-cu-border bg-cu-bg-secondary px-2 py-1 text-[11px] font-bold text-cu-text-secondary">
                                            v{doc.latestVersionNumber}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span
                                            className={`inline-flex h-8 w-8 items-center justify-center rounded-cu-md border ${getDocumentTypeTone(doc.contentType)}`}
                                            title={getDocumentTypeLabel(doc.contentType)}
                                            aria-label={getDocumentTypeLabel(doc.contentType)}
                                        >
                                            <FileText size={15} />
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <DocumentActions
                                            doc={doc}
                                            isTrashMode={isTrashMode}
                                            busy={busy}
                                            onView={onView}
                                            onDownload={onDownload}
                                            onRename={onRename}
                                            onSoftDelete={onSoftDelete}
                                            onToggleVersions={onToggleVersions}
                                            onOpenInfo={onOpenInfo}
                                            onRestore={onRestore}
                                            onPermanentDelete={onPermanentDelete}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
                {filteredDocuments.map((doc) => {
                    const isFavorite = favoriteIds.includes(doc.id);
                    const folderName = getDocumentFolderName(doc);

                    return (
                        <article key={`${mode}-${doc.id}`} className="rounded-cu-lg border border-cu-border bg-cu-bg p-4 shadow-cu-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-cu-md border border-cu-border bg-cu-bg-secondary text-cu-text-secondary">
                                        <FileText size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-cu-text-primary">{doc.name}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span
                                                className={`inline-flex h-8 w-8 items-center justify-center rounded-cu-md border ${getDocumentTypeTone(doc.contentType)}`}
                                                title={getDocumentTypeLabel(doc.contentType)}
                                                aria-label={getDocumentTypeLabel(doc.contentType)}
                                            >
                                                <FileText size={15} />
                                            </span>
                                            <span className="rounded-full border border-cu-border bg-cu-bg-secondary px-2 py-1 text-[11px] font-bold text-cu-text-secondary">
                                                v{doc.latestVersionNumber}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onToggleFavorite(doc.id)}
                                    disabled={busy}
                                    className="text-cu-text-tertiary transition-colors hover:text-cu-warning disabled:opacity-50"
                                    title={isFavorite ? 'Remove favorite' : 'Add favorite'}
                                    aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
                                >
                                    <Star
                                        size={17}
                                        fill={isFavorite ? 'var(--cu-warning)' : 'none'}
                                        color={isFavorite ? 'var(--cu-warning)' : 'currentColor'}
                                    />
                                </button>
                            </div>

                            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <dt className="font-semibold uppercase text-cu-text-tertiary">Folder</dt>
                                    <dd className="mt-0.5 truncate text-cu-text-primary">{folderName}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold uppercase text-cu-text-tertiary">Owner</dt>
                                    <dd className="mt-0.5 truncate text-cu-text-primary">{doc.uploadedByName}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold uppercase text-cu-text-tertiary">Size</dt>
                                    <dd className="mt-0.5 text-cu-text-primary">{doc.humanReadableSize ?? formatBytes(doc.fileSize)}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold uppercase text-cu-text-tertiary">Updated</dt>
                                    <dd className="mt-0.5 text-cu-text-primary">{timeAgo(doc.updatedAt)}</dd>
                                </div>
                            </dl>

                            <div className="mt-4 border-t border-cu-border pt-3">
                                <DocumentActions
                                    doc={doc}
                                    isTrashMode={isTrashMode}
                                    busy={busy}
                                    onView={onView}
                                    onDownload={onDownload}
                                    onRename={onRename}
                                    onSoftDelete={onSoftDelete}
                                    onToggleVersions={onToggleVersions}
                                    onOpenInfo={onOpenInfo}
                                    onRestore={onRestore}
                                    onPermanentDelete={onPermanentDelete}
                                />
                            </div>
                        </article>
                    );
                })}
            </div>
        </>
    );
}
