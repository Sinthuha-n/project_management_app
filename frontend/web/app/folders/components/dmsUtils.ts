import { DocumentItem } from '@/lib/dms';
import {
    DocumentDateFilter,
    DocumentFilters,
    DocumentSortDirection,
    DocumentSortKey,
    DocumentTypeFilter,
} from '@/app/folders/components/types';
import { formatDateTime, formatRelativeTime, parseInstant } from '@/lib/date-time';

// toLocaleString() without a locale argument uses the browser's locale for date formatting,
// matching whatever regional format the user's OS is set to rather than hard-coding one.
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function toDateLabel(iso: string): string {
    return formatDateTime(iso);
}

export function timeAgo(iso: string): string {
    return formatRelativeTime(iso);
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentTypeFilter, string> = {
    all: 'All types',
    pdf: 'PDF',
    document: 'Document',
    spreadsheet: 'Spreadsheet',
    image: 'Image',
    text: 'Text',
    other: 'Other',
};

export const DOCUMENT_DATE_LABELS: Record<DocumentDateFilter, string> = {
    all: 'Any time',
    today: 'Today',
    week: 'Last 7 days',
    month: 'Last 30 days',
    older: 'Older than 30 days',
};

export const DOCUMENT_SORT_LABELS: Record<DocumentSortKey, string> = {
    name: 'Name',
    updatedAt: 'Updated',
    createdAt: 'Created',
    fileSize: 'Size',
    uploadedByName: 'Owner',
    folderName: 'Folder',
    latestVersionNumber: 'Version',
};

const MS_PER_DAY = 86_400_000;

function safeTime(iso?: string | null): number {
    if (!iso) return 0;
    const time = parseInstant(iso)?.getTime() ?? NaN;
    return Number.isFinite(time) ? time : 0;
}

function normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

export function getDocumentTypeFilter(contentType: string): DocumentTypeFilter {
    const type = normalize(contentType);
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('word') || type.includes('document')) return 'document';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'spreadsheet';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('text/')) return 'text';
    return 'other';
}

export function getDocumentTypeLabel(contentType: string): string {
    return DOCUMENT_TYPE_LABELS[getDocumentTypeFilter(contentType)];
}

export function getDocumentTypeTone(contentType: string): string {
    const type = getDocumentTypeFilter(contentType);
    const tones: Record<DocumentTypeFilter, string> = {
        all: 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary',
        pdf: 'border-red-200 bg-red-50 text-red-700',
        document: 'border-blue-200 bg-blue-50 text-blue-700',
        spreadsheet: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        image: 'border-violet-200 bg-violet-50 text-violet-700',
        text: 'border-slate-200 bg-slate-50 text-slate-700',
        other: 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary',
    };
    return tones[type];
}

export function getFolderLabel(doc: DocumentItem, folderNames: Record<number, string>): string {
    if (doc.folderName) return doc.folderName;
    return doc.folderId ? folderNames[doc.folderId] ?? 'Unknown folder' : 'Root';
}

export function documentMatchesDateFilter(doc: DocumentItem, dateRange: DocumentDateFilter, now = Date.now()): boolean {
    if (dateRange === 'all') return true;
    const updatedTime = safeTime(doc.updatedAt);
    if (!updatedTime) return false;
    const ageDays = Math.floor((now - updatedTime) / MS_PER_DAY);

    if (dateRange === 'today') return ageDays < 1;
    if (dateRange === 'week') return ageDays < 7;
    if (dateRange === 'month') return ageDays < 30;
    return ageDays >= 30;
}

export function documentMatchesSearch(doc: DocumentItem, query: string, folderNames: Record<number, string>): boolean {
    const term = normalize(query);
    if (!term) return true;
    const folderLabel = getFolderLabel(doc, folderNames);
    const haystack = [
        doc.name,
        doc.uploadedByName,
        doc.contentType,
        getDocumentTypeLabel(doc.contentType),
        folderLabel,
        doc.status,
        `v${doc.latestVersionNumber}`,
        `version ${doc.latestVersionNumber}`,
    ].map(normalize).join(' ');

    return haystack.includes(term);
}

export function filterDocuments(
    documents: DocumentItem[],
    filters: DocumentFilters,
    favoriteIds: number[],
    folderNames: Record<number, string>,
    now = Date.now()
): DocumentItem[] {
    return documents.filter((doc) => {
        if (!documentMatchesSearch(doc, filters.search, folderNames)) return false;
        if (filters.type !== 'all' && getDocumentTypeFilter(doc.contentType) !== filters.type) return false;
        if (filters.folderId === 'root' && doc.folderId !== null) return false;
        if (typeof filters.folderId === 'number' && doc.folderId !== filters.folderId) return false;
        if (filters.uploader && doc.uploadedByName !== filters.uploader) return false;
        if (filters.favoriteOnly && !favoriteIds.includes(doc.id)) return false;
        if (!documentMatchesDateFilter(doc, filters.dateRange, now)) return false;
        return true;
    });
}

export function sortDocuments(
    documents: DocumentItem[],
    sortKey: DocumentSortKey,
    sortDirection: DocumentSortDirection,
    folderNames: Record<number, string>
): DocumentItem[] {
    const direction = sortDirection === 'asc' ? 1 : -1;

    return [...documents].sort((left, right) => {
        let comparison = 0;
        if (sortKey === 'updatedAt' || sortKey === 'createdAt') {
            comparison = safeTime(left[sortKey]) - safeTime(right[sortKey]);
        } else if (sortKey === 'fileSize' || sortKey === 'latestVersionNumber') {
            comparison = (left[sortKey] ?? 0) - (right[sortKey] ?? 0);
        } else if (sortKey === 'folderName') {
            comparison = getFolderLabel(left, folderNames).localeCompare(getFolderLabel(right, folderNames));
        } else {
            comparison = normalize(left[sortKey]).localeCompare(normalize(right[sortKey]));
        }

        if (comparison === 0) {
            comparison = normalize(left.name).localeCompare(normalize(right.name));
        }

        return comparison * direction;
    });
}
