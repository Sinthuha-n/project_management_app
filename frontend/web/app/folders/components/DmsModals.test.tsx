import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DmsModals from './DmsModals';
import { DocumentItem } from '@/lib/dms';

describe('DmsModals deletion confirmation modals', () => {
    const mockDoc: DocumentItem = {
        id: 101,
        name: 'Architecture_Design_v2.pdf',
        contentType: 'application/pdf',
        fileSize: 4096,
        status: 'ACTIVE',
        projectId: 16,
        latestVersionNumber: 3,
        uploadedById: 5,
        uploadedByName: 'Alice Engineer',
        createdAt: '2026-02-01T10:00:00.000Z',
        updatedAt: '2026-02-02T12:00:00.000Z',
        folderId: 10,
        folderName: 'Architecture Docs',
        downloadUrl: null,
        deletedAt: null,
    };

    const defaultProps = {
        selectedVersionsDocId: null,
        selectedVersionsDoc: null,
        versions: {},
        setSelectedVersionsDocId: jest.fn(),
        selectedInfoDoc: null,
        setSelectedInfoDoc: jest.fn(),
        getFolderName: jest.fn((id: number | null) => (id === 10 ? 'Architecture Docs' : 'Root')),
        renameDoc: null,
        renameName: '',
        setRenameName: jest.fn(),
        onConfirmRename: jest.fn(),
        onCancelRename: jest.fn(),
        selectedPermsFolder: null,
        folderPermissions: [],
        loadingPerms: false,
        savingPerms: false,
        onSaveFolderPermissions: jest.fn(),
        onCloseFolderPermissions: jest.fn(),
        projectId: 16,
        previewDoc: null,
        setPreviewDoc: jest.fn(),
    };

    it('renders nothing when no modals are open', () => {
        const { container } = render(<DmsModals {...defaultProps} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders soft delete confirmation modal and handles cancel and confirm interactions', () => {
        const onConfirmSoftDelete = jest.fn().mockResolvedValue(undefined);
        const onCancelSoftDelete = jest.fn();

        render(
            <DmsModals
                {...defaultProps}
                deleteDoc={mockDoc}
                onConfirmSoftDelete={onConfirmSoftDelete}
                onCancelSoftDelete={onCancelSoftDelete}
            />
        );

        expect(screen.getByText('Move to Trash?')).toBeInTheDocument();
        expect(screen.getByText(/Architecture_Design_v2\.pdf/)).toBeInTheDocument();
        expect(screen.getByText('Architecture Docs')).toBeInTheDocument();
        expect(screen.getByText('v3')).toBeInTheDocument();

        // Cancel
        const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
        fireEvent.click(cancelBtn);
        expect(onCancelSoftDelete).toHaveBeenCalledTimes(1);

        // Confirm
        const moveBtn = screen.getByRole('button', { name: 'Move to Trash' });
        fireEvent.click(moveBtn);
        expect(onConfirmSoftDelete).toHaveBeenCalledTimes(1);
    });

    it('renders permanent delete confirmation modal and handles cancel and confirm interactions', () => {
        const onConfirmPermanentDelete = jest.fn().mockResolvedValue(undefined);
        const onCancelPermanentDelete = jest.fn();

        render(
            <DmsModals
                {...defaultProps}
                permanentDeleteDoc={mockDoc}
                onConfirmPermanentDelete={onConfirmPermanentDelete}
                onCancelPermanentDelete={onCancelPermanentDelete}
            />
        );

        expect(screen.getByText('Permanently Delete Document?')).toBeInTheDocument();
        expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument();
        expect(screen.getByText('101')).toBeInTheDocument();
        expect(screen.getByText('3 version(s)')).toBeInTheDocument();

        // Cancel
        const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
        fireEvent.click(cancelBtn);
        expect(onCancelPermanentDelete).toHaveBeenCalledTimes(1);

        // Confirm
        const deleteForeverBtn = screen.getByRole('button', { name: 'Delete Forever' });
        fireEvent.click(deleteForeverBtn);
        expect(onConfirmPermanentDelete).toHaveBeenCalledTimes(1);
    });

    it('renders restore confirmation modal and handles cancel and confirm interactions', () => {
        const onConfirmRestore = jest.fn().mockResolvedValue(undefined);
        const onCancelRestore = jest.fn();

        render(
            <DmsModals
                {...defaultProps}
                restoreDoc={mockDoc}
                onConfirmRestore={onConfirmRestore}
                onCancelRestore={onCancelRestore}
            />
        );

        expect(screen.getByText('Restore document')).toBeInTheDocument();
        expect(screen.getByText(/Architecture_Design_v2\.pdf/)).toBeInTheDocument();
        expect(screen.getByText('Architecture Docs')).toBeInTheDocument();
        expect(screen.getByText('v3')).toBeInTheDocument();

        // Cancel
        const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
        fireEvent.click(cancelBtn);
        expect(onCancelRestore).toHaveBeenCalledTimes(1);

        // Confirm
        const restoreBtn = screen.getByRole('button', { name: 'Restore Document' });
        fireEvent.click(restoreBtn);
        expect(onConfirmRestore).toHaveBeenCalledTimes(1);
    });
});
