import { act, renderHook, waitFor } from '@testing-library/react';
import { useDmsWorkspace } from './useDmsWorkspace';
import * as dmsLib from '@/lib/dms';

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: (key: string) => (key === 'projectId' ? '16' : null),
    }),
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
}));

jest.mock('@/lib/dms', () => ({
    ...jest.requireActual('@/lib/dms'),
    listFolders: jest.fn(),
    listDocuments: jest.fn(),
    listUserProjects: jest.fn(),
    getProjectStorageQuota: jest.fn(),
    getDocumentUploadCapabilities: jest.fn(),
}));

const mockedDmsLib = dmsLib as jest.Mocked<typeof dmsLib>;

describe('useDmsWorkspace hook pagination', () => {
    const mockDocuments = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `Document ${i + 1}.pdf`,
        contentType: 'application/pdf',
        fileSize: 1024 * (i + 1),
        status: 'ACTIVE' as const,
        projectId: 16,
        latestVersionNumber: 1,
        uploadedById: 1,
        uploadedByName: 'Test User',
        createdAt: new Date(2026, 0, 30 - i).toISOString(),
        updatedAt: new Date(2026, 0, 30 - i).toISOString(),
        folderId: null,
        downloadUrl: null,
        deletedAt: null,
    }));

    beforeEach(() => {
        jest.clearAllMocks();
        mockedDmsLib.listFolders.mockResolvedValue([]);
        mockedDmsLib.listDocuments.mockResolvedValue(mockDocuments);
        mockedDmsLib.listUserProjects.mockResolvedValue([{ id: 16, name: 'Project 16' }]);
        mockedDmsLib.getProjectStorageQuota.mockResolvedValue({
            usedBytes: 1000,
            quotaBytes: 10000,
            maxFileSizeBytes: 5000,
            documentCount: 25,
            humanReadableUsed: '1 KB',
            humanReadableQuota: '10 KB',
        });
        mockedDmsLib.getDocumentUploadCapabilities.mockResolvedValue({
            multiUploadEnabled: true,
            acceptedExtensions: ['pdf'],
            mimeTypesByExtension: {},
            maxFileSizeBytes: 5000,
            maxBatchFiles: 10,
            maxBatchSizeBytes: 50000,
            recommendedConcurrency: 3,
        });
    });

    it('initializes pagination and splits documents into pages', async () => {
        const { result } = renderHook(() => useDmsWorkspace('view-all'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.totalFilteredCount).toBe(25);
        expect(result.current.pageSize).toBe(10);
        expect(result.current.totalPages).toBe(3);
        expect(result.current.currentPage).toBe(1);
        expect(result.current.startIndex).toBe(0);
        expect(result.current.endIndex).toBe(10);
        expect(result.current.paginatedDocuments).toHaveLength(10);
        expect(result.current.paginatedDocuments[0].id).toBe(1);
        expect(result.current.paginatedDocuments[9].id).toBe(10);
    });

    it('navigates between pages and updates paginated documents', async () => {
        const { result } = renderHook(() => useDmsWorkspace('view-all'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        act(() => {
            result.current.setPage(2);
        });

        expect(result.current.currentPage).toBe(2);
        expect(result.current.startIndex).toBe(10);
        expect(result.current.endIndex).toBe(20);
        expect(result.current.paginatedDocuments).toHaveLength(10);
        expect(result.current.paginatedDocuments[0].id).toBe(11);

        act(() => {
            result.current.setPage(3);
        });

        expect(result.current.currentPage).toBe(3);
        expect(result.current.startIndex).toBe(20);
        expect(result.current.endIndex).toBe(25);
        expect(result.current.paginatedDocuments).toHaveLength(5);
        expect(result.current.paginatedDocuments[0].id).toBe(21);
    });

    it('updates page size and resets page to 1', async () => {
        const { result } = renderHook(() => useDmsWorkspace('view-all'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        act(() => {
            result.current.setPage(2);
        });
        expect(result.current.currentPage).toBe(2);

        act(() => {
            result.current.setPageSize(25);
        });

        expect(result.current.pageSize).toBe(25);
        expect(result.current.currentPage).toBe(1);
        expect(result.current.totalPages).toBe(1);
        expect(result.current.paginatedDocuments).toHaveLength(25);
    });

    it('resets page to 1 when search or filters change', async () => {
        const { result } = renderHook(() => useDmsWorkspace('view-all'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        act(() => {
            result.current.setPage(2);
        });
        expect(result.current.currentPage).toBe(2);

        act(() => {
            result.current.setSearchQuery('Document 1');
        });

        expect(result.current.currentPage).toBe(1);
    });
});
