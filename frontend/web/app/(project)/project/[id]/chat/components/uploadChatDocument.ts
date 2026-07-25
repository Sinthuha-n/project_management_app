import { getApiErrorStatus, normalizeApiError } from '@/lib/api-error';
import {
  chatApi,
  type ChatAttachmentCapabilities,
  type ChatAttachmentUploadInitResponse,
} from '@/services/collaboration-contract';

export const CHAT_ATTACHMENT_ACCEPT = [
  '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
].join(',');

const FALLBACK_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};
const DEFAULT_CAPABILITIES: ChatAttachmentCapabilities = {
  allowedExtensions: Object.keys(FALLBACK_MIME_BY_EXTENSION),
  directUploadEnabled: false,
  maxFileSizeBytes: 25 * 1024 * 1024,
  mimeTypesByExtension: Object.fromEntries(
    Object.entries(FALLBACK_MIME_BY_EXTENSION).map(([extension, mime]) => [
      extension,
      [mime, 'application/octet-stream'],
    ]),
  ),
};

function fileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function normalizedContentType(file: File): string {
  return file.type.trim() || FALLBACK_MIME_BY_EXTENSION[fileExtension(file.name)] || 'application/octet-stream';
}

function validateFile(file: File, capabilities: ChatAttachmentCapabilities): string {
  const extension = fileExtension(file.name);
  const allowedExtensions = capabilities.allowedExtensions ?? Object.keys(FALLBACK_MIME_BY_EXTENSION);
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error(`Unsupported file type. Choose: ${allowedExtensions.join(', ')}.`);
  }
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (capabilities.maxFileSizeBytes && file.size > capabilities.maxFileSizeBytes) {
    throw new Error(`Files must be ${Math.floor(capabilities.maxFileSizeBytes / 1024 / 1024)} MB or smaller.`);
  }

  const declaredType = normalizedContentType(file);
  const aliases = capabilities.mimeTypesByExtension?.[extension] ?? [];
  const genericType = declaredType === 'application/octet-stream';
  if (aliases.length > 0 && !genericType && !aliases.includes(declaredType)) {
    throw new Error('The file extension and content type do not match.');
  }
  return genericType ? FALLBACK_MIME_BY_EXTENSION[extension] : declaredType;
}

async function uploadViaBackend(projectId: string | number, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    return await chatApi.uploadAttachmentFallback(projectId, formData);
  } catch (error) {
    throw new Error(normalizeApiError(error, 'The file could not be uploaded.'));
  }
}

function shouldUseFallback(error: unknown): boolean {
  const status = getApiErrorStatus(error);
  return status == null || status >= 500;
}

function assertInitialized(response: ChatAttachmentUploadInitResponse): asserts response is Required<ChatAttachmentUploadInitResponse> {
  if (!response.uploadUrl || !response.objectKey || !response.contentType) {
    throw new Error('The upload service returned an incomplete reservation.');
  }
}

export async function uploadChatDocument(projectId: string | number, file: File): Promise<string> {
  let capabilities: ChatAttachmentCapabilities;
  try {
    capabilities = await chatApi.getAttachmentUploadCapabilities(projectId);
  } catch {
    // An older additive backend can still accept the preserved multipart contract.
    validateFile(file, DEFAULT_CAPABILITIES);
    return uploadViaBackend(projectId, file);
  }

  const contentType = validateFile(file, capabilities);
  if (!capabilities.directUploadEnabled) return uploadViaBackend(projectId, file);

  let initialized: ChatAttachmentUploadInitResponse;
  try {
    initialized = await chatApi.initAttachmentUpload(projectId, {
      fileName: file.name,
      contentType,
      fileSize: file.size,
    });
    assertInitialized(initialized);
  } catch (error) {
    if (shouldUseFallback(error)) return uploadViaBackend(projectId, file);
    throw new Error(normalizeApiError(error, 'Failed to initialize the upload.'));
  }

  try {
    const response = await fetch(initialized.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': initialized.contentType },
    });
    if (!response.ok) return uploadViaBackend(projectId, file);
  } catch {
    return uploadViaBackend(projectId, file);
  }

  try {
    return await chatApi.finalizeAttachmentUpload(projectId, {
      objectKey: initialized.objectKey,
      fileName: file.name,
      contentType,
      fileSize: file.size,
    });
  } catch (error) {
    throw new Error(normalizeApiError(
      error,
      'The file reached storage, but the upload could not be finalized.',
    ));
  }
}
