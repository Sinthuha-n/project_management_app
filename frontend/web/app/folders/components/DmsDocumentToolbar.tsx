'use client';

import { ArrowDownAZ, ArrowUpAZ, Filter, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { DocumentFolder } from '@/lib/dms';
import {
    DOCUMENT_DATE_LABELS,
    DOCUMENT_SORT_LABELS,
    DOCUMENT_TYPE_LABELS,
} from '@/app/folders/components/dmsUtils';
import {
    DocumentDateFilter,
    DocumentFilters,
    DocumentSortDirection,
    DocumentSortKey,
    DocumentTypeFilter,
} from '@/app/folders/components/types';
import Button from '@/components/shared/Button';

interface DmsDocumentToolbarProps {
    filters: DocumentFilters;
    sortKey: DocumentSortKey;
    sortDirection: DocumentSortDirection;
    folders: DocumentFolder[];
    uploaderOptions: string[];
    activeFilterCount: number;
    hasActiveFilters: boolean;
    visibleCount: number;
    totalCount: number;
    startIndex?: number;
    endIndex?: number;
    totalFilteredCount?: number;
    busy: boolean;
    onFiltersChange: (next: Partial<DocumentFilters>) => void;
    onSearchChange: (value: string) => void;
    onClearFilters: () => void;
    onSortKeyChange: (key: DocumentSortKey) => void;
    onSortDirectionChange: (direction: DocumentSortDirection) => void;
    onRefresh: () => void;
}

const typeOptions: DocumentTypeFilter[] = ['all', 'pdf', 'document', 'spreadsheet', 'image', 'text', 'other'];
const dateOptions: DocumentDateFilter[] = ['all', 'today', 'week', 'month', 'older'];
const sortOptions: DocumentSortKey[] = ['updatedAt', 'name', 'createdAt', 'fileSize', 'uploadedByName', 'folderName', 'latestVersionNumber'];

const selectClass = 'h-9 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-[12px] font-semibold text-cu-text-primary shadow-cu-sm outline-none transition-colors focus:border-cu-primary/40 focus:ring-2 focus:ring-cu-primary/15';
const chipClass = 'inline-flex min-h-8 items-center gap-1.5 rounded-cu-md border border-cu-border bg-cu-bg px-2.5 text-[12px] font-semibold text-cu-text-secondary shadow-cu-sm transition-colors hover:bg-cu-hover';

export default function DmsDocumentToolbar({
    filters,
    sortKey,
    sortDirection,
    folders,
    uploaderOptions,
    activeFilterCount,
    hasActiveFilters,
    visibleCount,
    totalCount,
    startIndex,
    endIndex,
    totalFilteredCount,
    busy,
    onFiltersChange,
    onSearchChange,
    onClearFilters,
    onSortKeyChange,
    onSortDirectionChange,
    onRefresh,
}: DmsDocumentToolbarProps) {
    const folderLabel = filters.folderId === 'root'
        ? 'Root'
        : typeof filters.folderId === 'number'
        ? folders.find((folder) => folder.id === filters.folderId)?.name ?? 'Unknown folder'
        : '';

    const chips = [
        filters.search.trim() ? { label: `Search: ${filters.search.trim()}`, clear: () => onSearchChange('') } : null,
        filters.type !== 'all' ? { label: DOCUMENT_TYPE_LABELS[filters.type], clear: () => onFiltersChange({ type: 'all' }) } : null,
        filters.folderId !== 'all' ? { label: `Folder: ${folderLabel}`, clear: () => onFiltersChange({ folderId: 'all' }) } : null,
        filters.uploader ? { label: `Owner: ${filters.uploader}`, clear: () => onFiltersChange({ uploader: '' }) } : null,
        filters.favoriteOnly ? { label: 'Favorites only', clear: () => onFiltersChange({ favoriteOnly: false }) } : null,
        filters.dateRange !== 'all' ? { label: DOCUMENT_DATE_LABELS[filters.dateRange], clear: () => onFiltersChange({ dateRange: 'all' }) } : null,
    ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

    return (
        <div className="border-b border-cu-border bg-cu-bg px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative min-w-0 flex-1 xl:max-w-[520px]">
                        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cu-text-tertiary" />
                        <input
                            value={filters.search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder="Search documents, owners, folders, types, status, or version"
                            className="h-11 w-full rounded-cu-md border border-cu-border bg-cu-bg-secondary pl-10 pr-10 text-sm text-cu-text-primary outline-none transition-all placeholder:text-cu-text-muted focus:border-cu-primary focus:bg-cu-bg focus:ring-2 focus:ring-cu-primary/15"
                        />
                        {filters.search && (
                            <button
                                type="button"
                                onClick={() => onSearchChange('')}
                                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-cu-md text-cu-text-tertiary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
                                aria-label="Clear document search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-9 items-center gap-1.5 rounded-cu-md border border-cu-border bg-cu-bg-secondary px-3 text-[12px] font-bold text-cu-text-secondary">
                            <Filter size={13} />
                            {activeFilterCount} filters
                        </span>
                        <label className="sr-only" htmlFor="dms-type-filter">Type</label>
                        <select
                            id="dms-type-filter"
                            value={filters.type}
                            onChange={(event) => onFiltersChange({ type: event.target.value as DocumentTypeFilter })}
                            className={selectClass}
                        >
                            {typeOptions.map((type) => (
                                <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>
                            ))}
                        </select>

                        <label className="sr-only" htmlFor="dms-folder-filter">Folder</label>
                        <select
                            id="dms-folder-filter"
                            value={filters.folderId}
                            onChange={(event) => {
                                const value = event.target.value;
                                onFiltersChange({ folderId: value === 'all' || value === 'root' ? value : Number(value) });
                            }}
                            className={selectClass}
                        >
                            <option value="all">All folders</option>
                            <option value="root">Root</option>
                            {folders.map((folder) => (
                                <option key={folder.id} value={folder.id}>{folder.name}</option>
                            ))}
                        </select>

                        <label className="sr-only" htmlFor="dms-uploader-filter">Owner</label>
                        <select
                            id="dms-uploader-filter"
                            value={filters.uploader}
                            onChange={(event) => onFiltersChange({ uploader: event.target.value })}
                            className={selectClass}
                        >
                            <option value="">All owners</option>
                            {uploaderOptions.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>

                        <label className="sr-only" htmlFor="dms-date-filter">Updated date</label>
                        <select
                            id="dms-date-filter"
                            value={filters.dateRange}
                            onChange={(event) => onFiltersChange({ dateRange: event.target.value as DocumentDateFilter })}
                            className={selectClass}
                        >
                            {dateOptions.map((range) => (
                                <option key={range} value={range}>{DOCUMENT_DATE_LABELS[range]}</option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={() => onFiltersChange({ favoriteOnly: !filters.favoriteOnly })}
                            className={`inline-flex h-9 items-center gap-1.5 rounded-cu-md border px-3 text-[12px] font-bold shadow-cu-sm transition-colors ${
                                filters.favoriteOnly
                                    ? 'border-cu-warning/40 bg-cu-warning-light text-cu-text-primary'
                                    : 'border-cu-border bg-cu-bg text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
                            }`}
                            aria-pressed={filters.favoriteOnly}
                        >
                            Favorites
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[12px] font-semibold text-cu-text-secondary">
                        {startIndex !== undefined && endIndex !== undefined && totalFilteredCount !== undefined ? (
                            totalFilteredCount === 0 ? (
                                <>Showing <span className="text-cu-text-primary">0</span> documents</>
                            ) : (
                                <>
                                    Showing <span className="text-cu-text-primary">{startIndex + 1}{startIndex + 1 !== endIndex ? `–${endIndex}` : ''}</span> of{' '}
                                    <span className="text-cu-text-primary">{totalFilteredCount}</span>
                                    {hasActiveFilters || totalFilteredCount !== totalCount ? (
                                        <> filtered documents <span className="text-cu-text-tertiary">({totalCount} total)</span></>
                                    ) : (
                                        <> documents</>
                                    )}
                                </>
                            )
                        ) : (
                            <>
                                Showing <span className="text-cu-text-primary">{visibleCount}</span> of <span className="text-cu-text-primary">{totalCount}</span> documents
                            </>
                        )}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-9 items-center gap-1.5 rounded-cu-md border border-cu-border bg-cu-bg-secondary px-3 text-[12px] font-bold text-cu-text-secondary">
                            <SlidersHorizontal size={13} />
                            Sort
                        </span>
                        <label className="sr-only" htmlFor="dms-sort-key">Sort by</label>
                        <select
                            id="dms-sort-key"
                            value={sortKey}
                            onChange={(event) => onSortKeyChange(event.target.value as DocumentSortKey)}
                            className={selectClass}
                        >
                            {sortOptions.map((key) => (
                                <option key={key} value={key}>{DOCUMENT_SORT_LABELS[key]}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
                            className="inline-flex h-9 items-center gap-1.5 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-[12px] font-bold text-cu-text-secondary shadow-cu-sm transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
                            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                        >
                            {sortDirection === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                            {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                        </button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            leftIcon={<RefreshCw size={14} />}
                            isLoading={busy}
                            onClick={onRefresh}
                        >
                            Refresh
                        </Button>
                    </div>
                </div>

                {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-cu-border pt-3">
                        {chips.map((chip) => (
                            <button key={chip.label} type="button" onClick={chip.clear} className={chipClass}>
                                {chip.label}
                                <X size={12} />
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={onClearFilters}
                            className="inline-flex min-h-8 items-center rounded-cu-md px-2.5 text-[12px] font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
                        >
                            Clear filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
