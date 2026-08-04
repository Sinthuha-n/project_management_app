import api from '@/lib/axios';
import axios from 'axios';
import {
    createFolder,
    deleteFolder,
    DmsError,
    getDocumentVersions,
    getFolderPermissions,
    getProjectStorageQuota,
    listDocuments,
    listFolders,
    updateFolderPermissions,
    uploadDocument,
    getDocumentUploadCapabilities,
    initDocumentUploadBatch,
    uploadReservedDocument,
} from './dms';

jest.mock('@/lib/axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
    },
}));

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        put: jest.fn(),
        isAxiosError: jest.fn((error) => Boolean(error?.isAxiosError)),
    },
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DMS API contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('uses canonical folder, permission, quota, and document routes', async () => {
        mockedApi.get.mockResolvedValue({ data: [] });
        mockedApi.post.mockResolvedValue({ data: { id: 9 } });
        mockedApi.put.mockResolvedValue({});
        mockedApi.delete.mockResolvedValue({});

        await getFolderPermissions(12, 34);
        await updateFolderPermissions(12, 34, [{ teamRole: 'MEMBER', permissions: ['READ'] }]);
        await getProjectStorageQuota(12);
        await listFolders(12);
        await createFolder(12, 'Specs');
        await deleteFolder(12, 34);
        await listDocuments(12, 34, true);
        await getDocumentVersions(12, 56);

        expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12/folders/34/permissions');
        expect(mockedApi.put).toHaveBeenCalledWith('/api/projects/12/folders/34/permissions', [{ teamRole: 'MEMBER', permissions: ['READ'] }]);
        expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12/storage-quota');
        expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12/folders');
        expect(mockedApi.post).toHaveBeenCalledWith('/api/projects/12/folders', { name: 'Specs', parentFolderId: undefined });
        expect(mockedApi.delete).toHaveBeenCalledWith('/api/projects/12/folders/34');
        expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12/documents?includeDeleted=true&folderId=34');
        expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12/documents/56/versions');
    });

    it('uses presigned upload init and finalize routes when S3 upload succeeds', async () => {
        const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
        mockedApi.post
            .mockResolvedValueOnce({ data: { uploadUrl: 'https://s3.example/upload', objectKey: 'project-12/root/key', expiresInSeconds: 900 } })
            .mockResolvedValueOnce({ data: { id: 88, name: 'notes.txt' } });
        mockedAxios.put.mockResolvedValueOnce({});

        await uploadDocument(12, file, undefined);

        expect(mockedApi.post).toHaveBeenNthCalledWith(1, '/api/projects/12/documents/upload/init', {
            fileName: 'notes.txt',
            contentType: 'text/plain',
            fileSize: file.size,
            folderId: undefined,
        });
        expect(mockedAxios.put).toHaveBeenCalledWith('https://s3.example/upload', file, expect.objectContaining({
            headers: { 'Content-Type': 'text/plain' },
        }));
        expect(mockedApi.post).toHaveBeenNthCalledWith(2, '/api/projects/12/documents/upload/finalize', {
            fileName: 'notes.txt',
            contentType: 'text/plain',
            fileSize: file.size,
            objectKey: 'project-12/root/key',
            folderId: undefined,
        });
    });

    it('falls back to backend upload only for expected presigned transport failures', async () => {
        const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
        mockedApi.post
            .mockResolvedValueOnce({ data: { uploadUrl: 'https://s3.example/upload', objectKey: 'project-12/root/key', expiresInSeconds: 900 } })
            .mockResolvedValueOnce({ data: { id: 88, name: 'notes.txt' } });
        mockedAxios.put.mockRejectedValueOnce({ isAxiosError: true, request: {} });

        await uploadDocument(12, file, 34);

        expect(mockedApi.post).toHaveBeenNthCalledWith(
            2,
            '/api/projects/12/documents/upload',
            expect.any(FormData),
        );
    });

    it('does not use backend fallback for permission or quota failures', async () => {
        const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
        mockedApi.post.mockResolvedValueOnce({
            data: { uploadUrl: 'https://s3.example/upload', objectKey: 'project-12/root/key', expiresInSeconds: 900 },
        });
        mockedAxios.put.mockRejectedValueOnce({
            isAxiosError: true,
            response: { status: 403, data: { errorCode: 'FORBIDDEN', message: 'Permission denied' } },
        });

        await expect(uploadDocument(12, file)).rejects.toMatchObject({
            name: 'DmsError',
            kind: 'PERMISSION_DENIED',
        } satisfies Partial<DmsError>);

        expect(mockedApi.post).toHaveBeenCalledTimes(1);
    });

    it('surfaces quota exceeded from upload init as a typed error', async () => {
        const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
        mockedApi.post.mockRejectedValueOnce({
            response: {
                status: 413,
                data: { errorCode: 'STORAGE_QUOTA_EXCEEDED', message: 'Project storage quota exceeded.' },
            },
        });

        await expect(uploadDocument(12, file)).rejects.toMatchObject({
            name: 'DmsError',
            kind: 'QUOTA_EXCEEDED',
            message: 'Project storage quota exceeded.',
        } satisfies Partial<DmsError>);
    });

    it('uses capabilities and batch reservation endpoints for multi-file uploads', async () => {
        mockedApi.get.mockResolvedValueOnce({ data: { acceptedExtensions: ['pdf'], maxBatchFiles: 25 } });
        mockedApi.post.mockResolvedValueOnce({ data: { batchId: 'batch', files: [] } });

        await getDocumentUploadCapabilities(12);
        await initDocumentUploadBatch(12, 34, [{ clientId: 'one', fileName: 'spec.pdf', contentType: 'application/pdf', fileSize: 5 }]);

        expect(mockedApi.get).toHaveBeenCalledWith('/api/projects/12/documents/upload-capabilities');
        expect(mockedApi.post).toHaveBeenCalledWith('/api/projects/12/documents/uploads/init', {
            folderId: 34,
            files: [{ clientId: 'one', fileName: 'spec.pdf', contentType: 'application/pdf', fileSize: 5 }],
        });
    });

    it('uploads a reserved file and finalizes the same reservation', async () => {
        const file = new File(['hello'], 'spec.pdf', { type: 'application/pdf' });
        mockedAxios.put.mockResolvedValueOnce({});
        mockedApi.post.mockResolvedValueOnce({ data: { id: 77, name: 'spec.pdf' } });

        await uploadReservedDocument(12, file, {
            clientId: 'one', accepted: true, uploadId: 'upload-1', uploadUrl: 'https://storage/upload', contentType: 'application/pdf',
        });

        expect(mockedAxios.put).toHaveBeenCalledWith('https://storage/upload', file, expect.objectContaining({ headers: { 'Content-Type': 'application/pdf' } }));
        expect(mockedApi.post).toHaveBeenCalledWith('/api/projects/12/documents/uploads/upload-1/finalize', undefined, { signal: undefined });
    });
});
