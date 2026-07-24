import { tasksApi } from './api-contract';
import type { TaskAttachment, UploadInitRequest, UploadInitResponse, UploadFinalizeRequest } from './api-contract';
import { normalizeApiError } from '@/lib/api-error';
import type { UploadState } from '@/lib/upload-state';

export type { TaskAttachment };

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
    if (file.type && file.type.trim().length > 0) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
}

async function initUpload(taskId: number, request: UploadInitRequest): Promise<UploadInitResponse> {
    try {
        return await tasksApi.initAttachmentUpload(taskId, request);
    } catch (error) {
        // Preserve response status/headers for shared conflict, cooldown, and diagnostic UX.
        if (error instanceof Error && !('response' in error)) throw new Error(normalizeApiError(error, 'Failed to initialize upload.'));
        throw error;
    }
}

async function finalizeUpload(taskId: number, request: UploadFinalizeRequest): Promise<TaskAttachment> {
    try {
        return await tasksApi.finalizeAttachmentUpload(taskId, request);
    } catch (error) {
        if (error instanceof Error && !('response' in error)) throw new Error(normalizeApiError(error, 'Upload was sent to storage, but finalize failed.'));
        throw error;
    }
}

async function uploadViaBackend(taskId: number, file: File): Promise<TaskAttachment> {
    const formData = new FormData();
    formData.append('file', file);

    try {
        return await tasksApi.uploadAttachmentFallback(taskId, formData);
    } catch (error) {
        if (error instanceof Error && !('response' in error)) throw new Error(normalizeApiError(error, 'Backend upload fallback failed.'));
        throw error;
    }
}

/** Upload a file to a task using presigned URL with backend fallback. */
export async function uploadTaskAttachment(taskId: number, file: File, onState?: (state: UploadState) => void): Promise<TaskAttachment> {
    onState?.('validating');
    const contentType = inferContentType(file);

    onState?.('reserved');
    const initResponse = await initUpload(taskId, {
        fileName: file.name,
        contentType,
        fileSize: file.size,
    });

    let putResponse: Response;
    try {
        onState?.('uploading');
        putResponse = await fetch(initResponse.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': contentType },
        });
    } catch {
        onState?.('finalizing');
        return uploadViaBackend(taskId, file);
    }

    if (!putResponse.ok) {
        onState?.('finalizing');
        return uploadViaBackend(taskId, file);
    }

    onState?.('finalizing');
    return finalizeUpload(taskId, {
        fileName: file.name,
        contentType,
        fileSize: file.size,
        objectKey: initResponse.objectKey,
    });
}

/** List all attachments for a task. */
export async function listTaskAttachments(taskId: number): Promise<TaskAttachment[]> {
    return tasksApi.getAttachments(taskId);
}

/** Delete a task attachment. */
export async function deleteTaskAttachment(taskId: number, attachmentId: number): Promise<void> {
    return tasksApi.deleteAttachment(taskId, attachmentId);
}
