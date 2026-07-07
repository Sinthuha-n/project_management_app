import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from '@/components/ui';
import { ChatInput } from './chatInput';
import { uploadChatDocument } from './uploadChatDocument';

const mockUseParams = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

jest.mock('emoji-picker-react', () => ({
  __esModule: true,
  default: ({ onEmojiClick }: { onEmojiClick: (emojiData: { emoji: string }) => void }) => (
    <button onClick={() => onEmojiClick({ emoji: '😀' })}>Pick emoji</button>
  ),
  EmojiStyle: { NATIVE: 'native' },
  Theme: { DARK: 'dark', LIGHT: 'light' },
}));

jest.mock('./uploadChatDocument', () => ({
  uploadChatDocument: jest.fn(),
}));

jest.mock('@/components/ui', () => ({
  toast: jest.fn(),
}));

const mockedUploadChatDocument = uploadChatDocument as jest.Mock;
const mockedToast = toast as jest.MockedFunction<typeof toast>;

describe('ChatInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ id: '42' });
  });

  it('renders and sends a trimmed message on Enter', () => {
    const onSendMessage = jest.fn();

    render(<ChatInput onSendMessage={onSendMessage} placeholder="Message team..." />);

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: '  hello team  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSendMessage).toHaveBeenCalledWith('hello team');
    expect((input as HTMLTextAreaElement).value).toBe('');
  });

  it('does not send message when Enter is pressed with Shift', () => {
    const onSendMessage = jest.fn();

    render(<ChatInput onSendMessage={onSendMessage} />);

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: 'line one' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('supports mention insertion from mention dropdown', () => {
    const onSendMessage = jest.fn();

    render(
      <ChatInput
        onSendMessage={onSendMessage}
        enableMentions={true}
        mentionCandidates={['alice', 'alex', 'bob']}
      />
    );

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: '@al', selectionStart: 3 } });

    expect(screen.getByLabelText('Mention alice')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Mention alice'));

    expect((input as HTMLTextAreaElement).value).toBe('@alice ');
  });

  it('keeps send button disabled for whitespace-only input', () => {
    const onSendMessage = jest.fn();

    render(<ChatInput onSendMessage={onSendMessage} />);

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: '    ' } });

    const sendButton = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendButton);

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('closes the emoji picker when clicking outside it', async () => {
    const onSendMessage = jest.fn();

    render(<ChatInput onSendMessage={onSendMessage} />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle emoji picker' }));

    await waitFor(() => {
      expect(screen.getByText('Pick emoji')).toBeInTheDocument();
    });

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText('Pick emoji')).not.toBeInTheDocument();
  });

  it('sends the uploaded S3 URL through the renderer attachment contract', async () => {
    const onSendMessage = jest.fn();
    const attachmentUrl = 'https://chat-files.s3.amazonaws.com/42/user/123_report.pdf?X-Amz-Credential=credential&X-Amz-Signature=signature';
    mockedUploadChatDocument.mockResolvedValueOnce(attachmentUrl);

    render(<ChatInput onSendMessage={onSendMessage} />);

    const fileInput = screen.getByLabelText('Attach a file') as HTMLInputElement;
    const file = new File(['hello'], 'report.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedUploadChatDocument).toHaveBeenCalledWith('42', file);
      expect(onSendMessage).toHaveBeenCalledWith(attachmentUrl);
    });
  });

  it('notifies the user when file upload fails', async () => {
    const onSendMessage = jest.fn();
    mockedUploadChatDocument.mockRejectedValueOnce(new Error('upload failed'));

    render(<ChatInput onSendMessage={onSendMessage} />);

    const fileInput = screen.getByLabelText('Attach a file') as HTMLInputElement;
    const file = new File(['hello'], 'report.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedToast).toHaveBeenCalledWith("Couldn't upload file. Please try again.", 'error');
    });

    expect(onSendMessage).not.toHaveBeenCalled();
  });
});
