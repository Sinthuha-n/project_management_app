import { useState, useEffect, useCallback } from 'react';
import {
    TaskAttachment,
    listTaskAttachments,
    uploadTaskAttachment,
    deleteTaskAttachment,
} from '@/services/task-attachments-service';
import { reportClientFailure, toApiFailure } from '@/lib/api-failure';
import type { UploadState } from '@/lib/upload-state';

interface UseTaskAttachmentsReturn {
    attachments: TaskAttachment[];
    isLoading: boolean;
    isUploading: boolean;
    uploadState: UploadState | null;
    error: string | null;
    uploadFile: (file: File) => Promise<void>;
    removeFile: (attachmentId: number) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useTaskAttachments(taskId: number | undefined): UseTaskAttachmentsReturn {
    const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadState, setUploadState] = useState<UploadState | null>(null);

    const refresh = useCallback(async () => {
        if (!taskId) return;
        try {
            setIsLoading(true);
            setError(null);
            const data = await listTaskAttachments(taskId);
            setAttachments(data);
        } catch (err) {
            setError((err as Error).message || 'Failed to load attachments');
        } finally {
            setIsLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const uploadFile = useCallback(async (file: File) => {
        if (!taskId) return;
        try {
            setIsUploading(true);
            setError(null);
            const newAttachment = await uploadTaskAttachment(taskId, file, setUploadState);
            setUploadState('visible');
            setAttachments(prev => [newAttachment, ...prev]);
        } catch (err) {
            const failure = toApiFailure(err, 'Upload failed');
            setUploadState('failed');
            setError(failure.message);
            reportClientFailure({ route: `/tasks/${taskId}/attachments`, operation: 'upload', status: failure.status, errorCode: failure.code, requestId: failure.requestId, retryAfterSeconds: failure.retryAfterSeconds });
        } finally {
            setIsUploading(false);
        }
    }, [taskId]);

    const removeFile = useCallback(async (attachmentId: number) => {
        if (!taskId) return;
        try {
            setError(null);
            await deleteTaskAttachment(taskId, attachmentId);
            setAttachments(prev => prev.filter(a => a.id !== attachmentId));
        } catch (err) {
            setError((err as Error).message || 'Delete failed');
        }
    }, [taskId]);

    return { attachments, isLoading, isUploading, uploadState, error, uploadFile, removeFile, refresh };
}
