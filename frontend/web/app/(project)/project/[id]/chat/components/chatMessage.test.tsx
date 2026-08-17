import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessages } from './chatMessage';
import type { ChatMessage, ChatReactionSummary } from './chat';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

// Mock TanStack virtualizer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 60,
        size: 60,
        key: `virtual-item-${index}`,
      })),
    getTotalSize: () => count * 60,
    measureElement: jest.fn(),
    scrollToIndex: jest.fn(),
  }),
}));

// Mock OverlayPortal
jest.mock('@/components/ui/OverlayPortal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ChatMessages component', () => {
  const sampleMessages: ChatMessage[] = [
    {
      id: 101,
      sender: 'alice',
      content: 'Initial message from alice',
      timestamp: '2026-08-17T10:00:00Z',
      type: 'CHAT',
    },
    {
      id: 102,
      sender: 'alice',
      content: 'Edited message from alice',
      timestamp: '2026-08-17T10:05:00Z',
      editedAt: '2026-08-17T10:06:00Z',
      type: 'CHAT',
    },
    {
      id: 103,
      sender: 'bob',
      content: 'Message from bob',
      timestamp: '2026-08-17T10:10:00Z',
      type: 'CHAT',
    },
  ];

  const defaultProps = {
    projectId: '42',
    messages: sampleMessages,
    currentUser: 'alice',
    currentUserAliases: ['alice'],
    isPrivateChat: false,
    userProfilePics: {},
    reactionsByMessageId: {} as Record<number, ChatReactionSummary[]>,
    onOpenThread: jest.fn(),
    onEditMessage: jest.fn(),
    onDeleteMessage: jest.fn(),
    onToggleReaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders messages and displays the (edited) indicator cleanly on edited messages', () => {
    render(<ChatMessages {...defaultProps} />);

    expect(screen.getByText('Initial message from alice')).toBeInTheDocument();
    expect(screen.getByText('Edited message from alice')).toBeInTheDocument();
    expect(screen.getByText('edited')).toBeInTheDocument();
    expect(screen.getByText('Message from bob')).toBeInTheDocument();
  });

  it('opens custom UI ConfirmDeleteModal and deletes message without invoking browser confirm', () => {
    const windowConfirmSpy = jest.spyOn(window, 'confirm');
    const onDeleteMessage = jest.fn();

    render(<ChatMessages {...defaultProps} onDeleteMessage={onDeleteMessage} />);

    // Find delete buttons (for alice's messages)
    const deleteButtons = screen.getAllByTitle('Delete message');
    expect(deleteButtons.length).toBeGreaterThan(0);

    // Click delete on first message
    fireEvent.click(deleteButtons[0]);

    // Verify UI modal appears
    expect(screen.getByText('Delete Message')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete this message\? This action is permanent/i),
    ).toBeInTheDocument();

    // Confirm deletion inside the custom UI modal
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    // Ensure onDeleteMessage was called and native window.confirm was NOT called
    expect(onDeleteMessage).toHaveBeenCalledWith(101);
    expect(windowConfirmSpy).not.toHaveBeenCalled();

    windowConfirmSpy.mockRestore();
  });

  it('opens EditMessageModal when edit button is clicked and saves changes', () => {
    const onEditMessage = jest.fn();

    render(<ChatMessages {...defaultProps} onEditMessage={onEditMessage} />);

    const editButtons = screen.getAllByTitle('Edit');
    expect(editButtons.length).toBeGreaterThan(0);

    // Click edit on first message
    fireEvent.click(editButtons[0]);

    // Modal opens
    expect(screen.getByText('Edit Message')).toBeInTheDocument();
    const textarea = screen.getByDisplayValue('Initial message from alice');
    fireEvent.change(textarea, { target: { value: 'Updated message content' } });

    // Click save
    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    expect(onEditMessage).toHaveBeenCalledWith(101, 'Updated message content');
  });
});
