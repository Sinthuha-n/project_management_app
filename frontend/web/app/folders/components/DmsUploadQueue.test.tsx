import { fireEvent, render, screen } from '@testing-library/react';
import DmsUploadQueue from './DmsUploadQueue';
import { UploadQueueItem } from './types';

function item(id: string, status: UploadQueueItem['status'], progress: number, errorMessage?: string): UploadQueueItem {
    return { id, status, progress, errorMessage, file: new File(['data'], `${id}.pdf`, { type: 'application/pdf' }), folderName: 'Root' };
}

describe('DmsUploadQueue', () => {
    it('shows partial success and retries only the selected failed item', () => {
        const retry = jest.fn();
        render(<DmsUploadQueue
            items={[item('done', 'completed', 100), item('bad', 'failed', 20, 'Scan failed')]}
            initializing={false} onCancel={jest.fn()} onCancelRemaining={jest.fn()}
            onRetry={retry} onClearFinished={jest.fn()}
        />);

        expect(screen.getByText('1 completed · 2 total')).toBeInTheDocument();
        expect(screen.getByText('Scan failed')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Retry bad.pdf'));
        expect(retry).toHaveBeenCalledWith(['bad']);
    });

    it('allows cancellation while uploads remain active', () => {
        const cancelRemaining = jest.fn();
        render(<DmsUploadQueue
            items={[item('uploading', 'uploading', 50)]}
            initializing={false} onCancel={jest.fn()} onCancelRemaining={cancelRemaining}
            onRetry={jest.fn()} onClearFinished={jest.fn()}
        />);
        fireEvent.click(screen.getByText('Cancel remaining'));
        expect(cancelRemaining).toHaveBeenCalled();
    });
});
