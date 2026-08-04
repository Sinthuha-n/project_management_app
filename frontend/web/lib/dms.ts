import api from '@/lib/axios';
import axios, { type AxiosError } from 'axios';
import { getApiErrorStatus, normalizeApiError } from '@/lib/api-error';
import type { components } from '@api-contracts/types';

type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
type DocumentFolderDto = components['schemas']['DocumentFolderResponseDTO'];
type DocumentDto = components['schemas']['DocumentResponseDTO'];
type DocumentVersionDto = components['schemas']['DocumentVersionResponseDTO'];
type ProjectStorageQuotaDto = components['schemas']['ProjectStorageQuotaResponseDTO'];

export type DocumentStatus = NonNullable<components['schemas']['DocumentResponseDTO']['status']>;
export type DocumentFolder = Omit<
    RequireKeys<DocumentFolderDto, 'id' | 'name' | 'projectId' | 'createdById' | 'createdAt' | 'updatedAt'>,
    'parentFolderId'
> & {
    parentFolderId: number | null;
};
export type DocumentItem = Omit<
    RequireKeys<
        DocumentDto,
        'id' | 'name' | 'contentType' | 'fileSize' | 'status' | 'projectId' | 'latestVersionNumber' | 'uploadedById' | 'uploadedByName' | 'createdAt' | 'updatedAt'
    >,
    'folderId' | 'folderName' | 'downloadUrl' | 'deletedAt'
> & {
    folderId: number | null;
    folderName?: string | null;
    downloadUrl: string | null;
    deletedAt: string | null;
};
export type DocumentVersionItem = RequireKeys<
    DocumentVersionDto,
    'id' | 'versionNumber' | 'contentType' | 'fileSize' | 'uploadedById' | 'uploadedByName' | 'uploadedAt' | 'downloadUrl'
>;
type UploadInitRequest = components['schemas']['DocumentUploadInitRequestDTO'];
type UploadInitResponse = components['schemas']['DocumentUploadInitResponseDTO'];
type UploadFinalizeRequest = components['schemas']['DocumentUploadFinalizeRequestDTO'];

export type DmsErrorKind = 'PERMISSION_DENIED' | 'QUOTA_EXCEEDED' | 'UPLOAD_FAILED';

export class DmsError extends Error {
    constructor(
        public readonly kind: DmsErrorKind,
        message: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'DmsError';
    }
}

const EXTENSION_MIME_MAP: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
};

function inferContentType(file: File): string {
    if (file.type && file.type.trim().length > 0) {
        return file.type;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return EXTENSION_MIME_MAP[extension] || 'application/octet-stream';
}

function toDmsError(error: unknown, fallback: string): DmsError {
    const status = getApiErrorStatus(error);
    const data = (error as { response?: { data?: { errorCode?: string } }; data?: { errorCode?: string } })?.response?.data
        ?? (error as { data?: { errorCode?: string } })?.data;
    const errorCode = typeof data === 'object' && data !== null ? data.errorCode : undefined;
    const message = normalizeApiError(error, fallback);

    if (status === 403 || errorCode === 'FORBIDDEN') {
        return new DmsError('PERMISSION_DENIED', message || 'You do not have permission to perform this document action.', status);
    }

    if (status === 413 || errorCode === 'STORAGE_QUOTA_EXCEEDED') {
        return new DmsError('QUOTA_EXCEEDED', message || 'Project storage quota exceeded.', status);
    }

    return new DmsError('UPLOAD_FAILED', message, status);
}

function shouldFallbackToBackend(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
        return false;
    }

    const axiosError = error as AxiosError;
    if (!axiosError.response) {
        return true;
    }

    return [408, 429, 500, 502, 503, 504].includes(axiosError.response.status);
}

function requireUploadInitResponse(response: UploadInitResponse): asserts response is UploadInitResponse & { uploadUrl: string; objectKey: string } {
    if (!response.uploadUrl || !response.objectKey) {
        throw new DmsError('UPLOAD_FAILED', 'Upload initialization response was missing storage details.');
    }
}

export type FolderPermissionRequest = components['schemas']['FolderPermissionRequest'];
export type ProjectStorageQuotaResponse = RequireKeys<
    ProjectStorageQuotaDto,
    'usedBytes' | 'quotaBytes' | 'maxFileSizeBytes' | 'documentCount' | 'humanReadableUsed' | 'humanReadableQuota'
>;

export interface DocumentUploadCapabilities {
    multiUploadEnabled: boolean;
    acceptedExtensions: string[];
    mimeTypesByExtension: Record<string, string[]>;
    maxFileSizeBytes: number;
    maxBatchFiles: number;
    maxBatchSizeBytes: number;
    recommendedConcurrency: number;
}

export interface DocumentBatchUploadFileRequest {
    clientId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
}

export interface DocumentBatchUploadInitResult {
    clientId: string;
    accepted: boolean;
    uploadId?: string;
    uploadUrl?: string;
    objectKey?: string;
    contentType?: string;
    expiresInSeconds?: number;
    errorCode?: string;
    message?: string;
}

export interface DocumentBatchUploadInitResponse {
    batchId: string;
    expiresAt: string;
    files: DocumentBatchUploadInitResult[];
}

export async function getDocumentUploadCapabilities(projectId: number): Promise<DocumentUploadCapabilities> {
    const response = await api.get<DocumentUploadCapabilities>(`/api/projects/${projectId}/documents/upload-capabilities`);
    return response.data;
}

export async function initDocumentUploadBatch(
    projectId: number,
    folderId: number | undefined,
    files: DocumentBatchUploadFileRequest[]
): Promise<DocumentBatchUploadInitResponse> {
    const response = await api.post<DocumentBatchUploadInitResponse>(`/api/projects/${projectId}/documents/uploads/init`, {
        folderId,
        files,
    });
    return response.data;
}

export async function finalizeReservedDocument(projectId: number, uploadId: string, signal?: AbortSignal): Promise<DocumentItem> {
    const response = await api.post<DocumentItem>(`/api/projects/${projectId}/documents/uploads/${uploadId}/finalize`, undefined, { signal });
    return response.data;
}

export async function uploadReservedDocument(
    projectId: number,
    file: File,
    reservation: DocumentBatchUploadInitResult,
    onProgress?: (percent: number) => void,
    onScanning?: () => void,
    signal?: AbortSignal
): Promise<DocumentItem> {
    if (!reservation.uploadId || !reservation.uploadUrl || !reservation.contentType) {
        throw new DmsError('UPLOAD_FAILED', 'Upload reservation was incomplete.');
    }

    try {
        await axios.put(reservation.uploadUrl, file, {
            headers: { 'Content-Type': reservation.contentType },
            signal,
            onUploadProgress: (event) => {
                if (event.total) onProgress?.(Math.round((event.loaded * 100) / event.total));
            },
        });
    } catch (error) {
        if (signal?.aborted || axios.isCancel(error)) throw error;
        if (!shouldFallbackToBackend(error)) throw toDmsError(error, 'Storage upload failed.');
        onScanning?.();
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<DocumentItem>(
            `/api/projects/${projectId}/documents/uploads/${reservation.uploadId}`,
            formData,
            { signal }
        );
        return response.data;
    }

    onScanning?.();
    return finalizeReservedDocument(projectId, reservation.uploadId, signal);
}

export async function getFolderPermissions(projectId: number, folderId: number): Promise<FolderPermissionRequest[]> {
    const response = await api.get<FolderPermissionRequest[]>(`/api/projects/${projectId}/folders/${folderId}/permissions`);
    return response.data;
}

export async function updateFolderPermissions(projectId: number, folderId: number, permissions: FolderPermissionRequest[]): Promise<void> {
    await api.put(`/api/projects/${projectId}/folders/${folderId}/permissions`, permissions);
}

export async function getProjectStorageQuota(projectId: number): Promise<ProjectStorageQuotaResponse> {
    const response = await api.get<ProjectStorageQuotaResponse>(`/api/projects/${projectId}/storage-quota`);
    return response.data;
}

export async function listFolders(projectId: number): Promise<DocumentFolder[]> {
    const response = await api.get<DocumentFolder[]>(`/api/projects/${projectId}/folders`);
    return response.data;
}

export async function createFolder(projectId: number, name: string, parentFolderId?: number): Promise<DocumentFolder> {
    const response = await api.post<DocumentFolder>(`/api/projects/${projectId}/folders`, {
        name,
        parentFolderId,
    });
    return response.data;
}

export async function deleteFolder(projectId: number, folderId: number): Promise<void> {
    await api.delete(`/api/projects/${projectId}/folders/${folderId}`);
}

export async function listDocuments(projectId: number, folderId?: number, includeDeleted = false): Promise<DocumentItem[]> {
    const params = new URLSearchParams();
    params.set('includeDeleted', String(includeDeleted));
    if (folderId) params.set('folderId', String(folderId));

    const response = await api.get<DocumentItem[]>(`/api/projects/${projectId}/documents?${params.toString()}`);
    return response.data;
}

export async function getDocumentVersions(projectId: number, documentId: number): Promise<DocumentVersionItem[]> {
    const response = await api.get<DocumentVersionItem[]>(`/api/projects/${projectId}/documents/${documentId}/versions`);
    return response.data;
}

export async function updateDocumentMetadata(projectId: number, documentId: number, payload: components['schemas']['DocumentMetadataUpdateRequestDTO']): Promise<DocumentItem> {
    const response = await api.patch<DocumentItem>(`/api/projects/${projectId}/documents/${documentId}`, payload);
    return response.data;
}

export async function softDeleteDocument(projectId: number, documentId: number): Promise<void> {
    await api.delete(`/api/projects/${projectId}/documents/${documentId}`);
}

export async function restoreDocument(projectId: number, documentId: number): Promise<DocumentItem> {
    const response = await api.patch<DocumentItem>(`/api/projects/${projectId}/documents/${documentId}/restore`);
    return response.data;
}

export async function permanentDeleteDocument(projectId: number, documentId: number): Promise<void> {
    await api.delete(`/api/projects/${projectId}/documents/${documentId}/permanent`);
}

export async function getDocumentDownloadUrl(projectId: number, documentId: number): Promise<string> {
    const response = await api.get<{ downloadUrl: string }>(`/api/projects/${projectId}/documents/${documentId}/download-url`);
    return response.data.downloadUrl;
}

export interface UserProject {
    id: number;
    name: string;
}

export async function listUserProjects(): Promise<UserProject[]> {
    const response = await api.get<UserProject[]>('/api/projects');
    return response.data;
}

async function initUpload(projectId: number, request: UploadInitRequest): Promise<UploadInitResponse> {
    try {
        const response = await api.post<UploadInitResponse>(`/api/projects/${projectId}/documents/upload/init`, request);
        return response.data;
    } catch (error) {
        throw toDmsError(error, 'Failed to initialize upload.');
    }
}

async function finalizeUpload(projectId: number, request: UploadFinalizeRequest): Promise<DocumentItem> {
    try {
        const response = await api.post<DocumentItem>(`/api/projects/${projectId}/documents/upload/finalize`, request);
        return response.data;
    } catch (error) {
        throw toDmsError(error, 'Upload was sent to storage, but finalize failed.');
    }
}

async function uploadViaBackend(projectId: number, file: File, folderId?: number): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (typeof folderId === 'number') {
        formData.append('folderId', String(folderId));
    }

    try {
        const response = await api.post<DocumentItem>(
            `/api/projects/${projectId}/documents/upload`,
            formData,
        );

        return response.data;
    } catch (error) {
        throw toDmsError(error, 'Backend upload fallback failed.');
    }
}

export async function uploadDocument(
    projectId: number,
    file: File,
    folderId?: number,
    onProgress?: (percent: number) => void
): Promise<DocumentItem> {
    const contentType = inferContentType(file);

    const initResponse = await initUpload(projectId, {
        fileName: file.name,
        contentType,
        fileSize: file.size,
        folderId,
    });
    requireUploadInitResponse(initResponse);

    try {
        await axios.put(initResponse.uploadUrl, file, {
            headers: { 'Content-Type': contentType },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                }
            },
        });
    } catch (error) {
        if (shouldFallbackToBackend(error)) {
            return uploadViaBackend(projectId, file, folderId);
        }
        throw toDmsError(error, 'Presigned upload failed.');
    }

    return finalizeUpload(projectId, {
        fileName: file.name,
        contentType,
        fileSize: file.size,
        objectKey: initResponse.objectKey,
        folderId,
    });
}
