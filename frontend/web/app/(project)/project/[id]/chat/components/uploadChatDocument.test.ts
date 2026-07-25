import { chatApi } from '@/services/collaboration-contract';
import { uploadChatDocument } from './uploadChatDocument';

jest.mock('@/services/collaboration-contract', () => ({
  chatApi: {
    getAttachmentUploadCapabilities: jest.fn(),
    initAttachmentUpload: jest.fn(),
    finalizeAttachmentUpload: jest.fn(),
    uploadAttachmentFallback: jest.fn(),
  },
}));

const mockedChatApi = chatApi as jest.Mocked<typeof chatApi>;
const mockedFetch = jest.fn<Promise<Pick<Response, 'ok'>>, Parameters<typeof fetch>>();
const capabilities = {
  allowedExtensions: ['pdf', 'xlsx', 'png'],
  directUploadEnabled: true,
  maxFileSizeBytes: 25 * 1024 * 1024,
  mimeTypesByExtension: {
    pdf: ['application/pdf', 'application/octet-stream'],
    xlsx: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ],
    png: ['image/png'],
  },
};

describe('uploadChatDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: mockedFetch,
      writable: true,
    });
    mockedChatApi.getAttachmentUploadCapabilities.mockResolvedValue(capabilities);
  });

  it('validates, uploads directly, and finalizes with the same metadata', async () => {
    const file = new File(['content'], 'Quarterly Report.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    mockedChatApi.initAttachmentUpload.mockResolvedValue({
      uploadUrl: 'https://storage.example/upload',
      objectKey: 'project-3/user-9/id-Quarterly_Report.xlsx',
      contentType: file.type,
      expiresInSeconds: 600,
    });
    mockedChatApi.finalizeAttachmentUpload.mockResolvedValue('https://storage.example/download');
    mockedFetch.mockResolvedValue({ ok: true });

    await expect(uploadChatDocument(3, file)).resolves.toBe('https://storage.example/download');
    expect(mockedChatApi.initAttachmentUpload).toHaveBeenCalledWith(3, {
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://storage.example/upload',
      expect.objectContaining({
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      }),
    );
    expect(mockedChatApi.finalizeAttachmentUpload).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        fileName: file.name,
        objectKey: 'project-3/user-9/id-Quarterly_Report.xlsx',
      }),
    );
  });

  it('uses multipart fallback when direct upload is disabled', async () => {
    mockedChatApi.getAttachmentUploadCapabilities.mockResolvedValue({
      ...capabilities,
      directUploadEnabled: false,
    });
    mockedChatApi.uploadAttachmentFallback.mockResolvedValue('https://storage.example/fallback');
    const file = new File(['pdf'], 'report.pdf', { type: 'application/pdf' });

    await expect(uploadChatDocument('3', file)).resolves.toBe('https://storage.example/fallback');

    expect(mockedChatApi.initAttachmentUpload).not.toHaveBeenCalled();
    expect(mockedChatApi.uploadAttachmentFallback).toHaveBeenCalledWith('3', expect.any(FormData));
  });

  it('falls back after a CORS or storage PUT failure', async () => {
    const file = new File(['pdf'], 'report.pdf', { type: 'application/pdf' });
    mockedChatApi.initAttachmentUpload.mockResolvedValue({
      uploadUrl: 'https://storage.example/upload',
      objectKey: 'project-3/user-9/id-report.pdf',
      contentType: 'application/pdf',
    });
    mockedChatApi.uploadAttachmentFallback.mockResolvedValue('https://storage.example/fallback');
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(uploadChatDocument(3, file)).resolves.toBe('https://storage.example/fallback');
    expect(mockedChatApi.finalizeAttachmentUpload).not.toHaveBeenCalled();
  });

  it('rejects unsupported, mismatched, empty, and oversized files before transfer', async () => {
    const executable = new File(['x'], 'installer.exe', { type: 'application/octet-stream' });
    const mismatch = new File(['x'], 'report.pdf', { type: 'image/png' });
    const empty = new File([], 'report.pdf', { type: 'application/pdf' });
    const oversized = new File(
      [new Uint8Array(26 * 1024 * 1024)],
      'report.pdf',
      { type: 'application/pdf' },
    );

    await expect(uploadChatDocument(3, executable)).rejects.toThrow('Unsupported file type');
    await expect(uploadChatDocument(3, mismatch)).rejects.toThrow('do not match');
    await expect(uploadChatDocument(3, empty)).rejects.toThrow('empty');
    await expect(uploadChatDocument(3, oversized)).rejects.toThrow('25 MB');
    expect(mockedChatApi.initAttachmentUpload).not.toHaveBeenCalled();
    expect(mockedChatApi.uploadAttachmentFallback).not.toHaveBeenCalled();
  });
});
