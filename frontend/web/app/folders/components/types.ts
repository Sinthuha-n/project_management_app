export type ViewMode = 'view-all' | 'recent' | 'favorites' | 'trash';

export type DocumentTypeFilter = 'all' | 'pdf' | 'document' | 'spreadsheet' | 'image' | 'text' | 'other';

export type DocumentDateFilter = 'all' | 'today' | 'week' | 'month' | 'older';

export type DocumentSortKey = 'name' | 'updatedAt' | 'createdAt' | 'fileSize' | 'uploadedByName' | 'folderName' | 'latestVersionNumber';

export type DocumentSortDirection = 'asc' | 'desc';

export interface DocumentFilters {
    search: string;
    type: DocumentTypeFilter;
    folderId: number | 'all' | 'root';
    uploader: string;
    favoriteOnly: boolean;
    dateRange: DocumentDateFilter;
}
