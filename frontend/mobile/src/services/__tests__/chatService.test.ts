import api from '../../api/axios';
import { uploadChatDocument, refreshChatDocument, type ChatUploadFile } from '../chatService';

jest.mock('../../api/axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const capabilities = {
  allowedExtensions: ['pdf', 'png'],
  directUploadEnabled: true,
  maxFileSizeBytes: 25 * 1024 * 1024,
  mimeTypesByExtension: {
    pdf: ['application/pdf', 'application/octet-stream'],
    png: ['image/png', 'application/octet-stream'],
  },
};

const pdfFile = {
  uri: 'file:///documents/Release Plan.pdf',
  name: 'Release Plan.pdf',
  mimeType: 'application/pdf',
  size: 4,
  file: { size: 4 } as File,
} satisfies ChatUploadFile;

describe('mobile chat attachment upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test('uploads directly and finalizes with the same metadata', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: capabilities });
    (api.post as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          uploadUrl: 'https://storage.example/upload',
          objectKey: 'project-3/user-9/key-Release_Plan.pdf',
          contentType: 'application/pdf',
          expiresInSeconds: 600,
        },
      })
      .mockResolvedValueOnce({ data: { downloadUrl: 'https://storage.example/download' } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    await expect(uploadChatDocument('3', pdfFile))
      .resolves.toBe('https://storage.example/download');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://storage.example/upload',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
      }),
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/api/projects/3/chat/attachments/upload/finalize',
      expect.objectContaining({
        fileName: 'Release Plan.pdf',
        contentType: 'application/pdf',
        fileSize: 4,
      }),
    );
  });

  test('uses multipart fallback without forcing a multipart content-type header', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { ...capabilities, directUploadEnabled: false },
    });
    (api.post as jest.Mock).mockResolvedValueOnce({ data: 'https://storage.example/fallback' });

    await expect(uploadChatDocument('3', pdfFile))
      .resolves.toBe('https://storage.example/fallback');

    expect(api.post).toHaveBeenCalledWith(
      '/api/projects/3/chat/messages/upload-document',
      expect.any(FormData),
    );
    expect(api.post).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  test('falls back when the storage PUT is blocked by CORS', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: capabilities });
    (api.post as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          uploadUrl: 'https://storage.example/upload',
          objectKey: 'project-3/user-9/key-Release_Plan.pdf',
          contentType: 'application/pdf',
          expiresInSeconds: 600,
        },
      })
      .mockResolvedValueOnce({ data: 'https://storage.example/fallback' });
    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(uploadChatDocument('3', pdfFile))
      .resolves.toBe('https://storage.example/fallback');
  });

  test('rejects mismatched and oversized files before transfer', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: capabilities });

    await expect(uploadChatDocument('3', {
      ...pdfFile,
      mimeType: 'image/png',
    })).rejects.toThrow('extension and content type do not match');

    await expect(uploadChatDocument('3', {
      ...pdfFile,
      size: capabilities.maxFileSizeBytes + 1,
    })).rejects.toThrow('25 MB or smaller');

    expect(api.post).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('refreshes expired attachment url via backend', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: 'https://storage.example/fresh-presigned-url',
    });

    await expect(refreshChatDocument('3', 'https://storage.example/expired-url'))
      .resolves.toBe('https://storage.example/fresh-presigned-url');

    expect(api.get).toHaveBeenCalledWith(
      '/api/projects/3/chat/messages/refresh-document',
      { params: { url: 'https://storage.example/expired-url' } },
    );
  });
});
