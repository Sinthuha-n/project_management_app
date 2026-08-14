import api from '@/src/api/axios';
import {
  postTelemetry as postTelemetryBuilder,
  createRoom as createRoomBuilder,
  createChatMessage as createChatMessageBuilder,
} from '@planora/contracts';
import {
  ChatMessage,
  ChatReactionSummary,
  ChatRoom,
  ChatFeatureFlags,
  ChatSearchResult,
  DirectChatSummary,
  RoomChatSummary,
  TeamChatSummary,
  UnreadBadgeSummary,
  PresenceResponse,
} from '../types/chat';
import type { components } from '@planora/contracts';
import { apiErrorMessage } from '../utils/apiError';

type ChatAttachmentCapabilities =
  components['schemas']['ChatAttachmentUploadCapabilitiesDTO'];
type ChatAttachmentUploadInitResponse =
  components['schemas']['ChatAttachmentUploadInitResponseDTO'];

export const CHAT_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MIME_BY_EXTENSION: Record<string, string> = {
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
const DEFAULT_ATTACHMENT_CAPABILITIES: ChatAttachmentCapabilities = {
  allowedExtensions: Object.keys(MIME_BY_EXTENSION),
  directUploadEnabled: false,
  maxFileSizeBytes: 25 * 1024 * 1024,
  mimeTypesByExtension: Object.fromEntries(
    Object.entries(MIME_BY_EXTENSION).map(([extension, mime]) => [
      extension,
      [mime, 'application/octet-stream'],
    ]),
  ),
};

export type ChatUploadFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number;
  file?: File;
};

export async function fetchCurrentUser(): Promise<{ username: string; email: string; aliases?: string[] }> {
  const { data } = await api.get('/api/user/me');
  return data;
}

export async function fetchProjectUsers(projectId: string): Promise<string[]> {
  const { data } = await api.get(`/api/projects/${projectId}/chat/members`);
  return data;
}

export async function fetchUserProfilePics(projectId: string): Promise<Record<string, string>> {
  try {
    const { data } = await api.get<any[]>(`/api/projects/${projectId}/members`);
    const mapping: Record<string, string> = {};
    if (Array.isArray(data)) {
      data.forEach((member) => {
        const username = member?.user?.username;
        const pic = member?.user?.profilePicUrl;
        if (username && pic) {
          mapping[username] = pic;
        }
      });
    }
    return mapping;
  } catch (error) {
    console.error('Failed to fetch user profile pics', error);
    return {};
  }
}

export async function fetchTeamMessages(projectId: string): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(`/api/projects/${projectId}/chat/messages`);
  return data;
}

export async function fetchPrivateHistory(projectId: string, partner: string): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(`/api/projects/${projectId}/chat/messages`, {
    params: { with: partner },
  });
  return data;
}

export async function fetchRoomHistory(projectId: string, roomId: number): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(`/api/projects/${projectId}/chat/messages`, {
    params: { roomId },
  });
  return data;
}

export async function fetchRooms(projectId: string): Promise<ChatRoom[]> {
  const { data } = await api.get<ChatRoom[]>(`/api/projects/${projectId}/chat/rooms`);
  return data;
}

export async function fetchFeatureFlags(projectId: string): Promise<ChatFeatureFlags> {
  const { data } = await api.get<ChatFeatureFlags>(`/api/projects/${projectId}/chat/features`);
  return data;
}

export async function fetchChatSummaries(projectId: string): Promise<{
  directSummaries: DirectChatSummary[];
  roomSummaries: RoomChatSummary[];
  teamSummary: TeamChatSummary | null;
}> {
  const { data } = await api.get(`/api/projects/${projectId}/chat/summaries`);
  return {
    directSummaries: data.directSummaries || [],
    roomSummaries: data.roomSummaries || [],
    teamSummary: data.teamSummary || null,
  };
}

export async function fetchUnreadBadge(projectId: string): Promise<UnreadBadgeSummary> {
  const { data } = await api.get<UnreadBadgeSummary>(`/api/projects/${projectId}/chat/unread-badge`);
  return data;
}

export async function fetchPresence(projectId: string): Promise<PresenceResponse> {
  const { data } = await api.get<PresenceResponse>(`/api/projects/${projectId}/chat/presence`);
  return data;
}

export async function fetchReactions(messageIds: number[]): Promise<Record<number, ChatReactionSummary[]>> {
  // Batch fetching reactions if supported, else individual
  // For simplicity and matching web pattern:
  const reactions: Record<number, ChatReactionSummary[]> = {};
  // This might be inefficient if many messages, but following the service contract
  return reactions;
}

export async function fetchThreadMessages(parentMessageId: number, projectId: string): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(`/api/projects/${projectId}/chat/messages/${parentMessageId}/thread`);
  return data;
}

export async function searchMessages(projectId: string, query: string): Promise<ChatSearchResult[]> {
  const { data } = await api.get<{ messages: ChatSearchResult[] }>(`/api/search`, {
    params: { q: query, projectId },
  });
  return data.messages || [];
}

export async function sendRestMessage(
  projectId: string,
  content: string,
  recipient?: string,
  localId?: string,
): Promise<ChatMessage> {
  const { data } = await createChatMessageBuilder(api, projectId, {
    content,
    recipient,
    localId,
    formatType: 'PLAIN',
  });
  return data;
}

export async function sendRoomRestMessage(
  projectId: string,
  roomId: number,
  content: string,
  localId?: string,
): Promise<ChatMessage> {
  const { data } = await createChatMessageBuilder(api, projectId, {
    content,
    roomId,
    localId,
    formatType: 'PLAIN',
  });
  return data;
}

export async function editMessageRest(
  projectId: string,
  messageId: number,
  content: string,
): Promise<ChatMessage> {
  const { data } = await api.patch<ChatMessage>(
    `/api/projects/${projectId}/chat/messages/${messageId}`,
    { content, formatType: 'PLAIN' },
  );
  return data;
}

export async function deleteMessageRest(
  projectId: string,
  messageId: number,
): Promise<ChatMessage> {
  const { data } = await api.delete<ChatMessage>(
    `/api/projects/${projectId}/chat/messages/${messageId}`,
  );
  return data;
}

export async function postThreadReply(
  projectId: string,
  parentMessageId: number,
  content: string,
): Promise<ChatMessage> {
  const { data } = await api.post<ChatMessage>(
    `/api/projects/${projectId}/chat/messages/${parentMessageId}/thread/replies`,
    { content, formatType: 'PLAIN' },
  );
  return data;
}

export async function createRoom(projectId: string, name: string, memberUsernames: string[]): Promise<ChatRoom> {
  const { data } = await createRoomBuilder(api, projectId, {
    name,
    members: memberUsernames,
  });
  return data;
}

export async function deleteRoom(projectId: string, roomId: number): Promise<void> {
  await api.delete(`/api/projects/${projectId}/chat/rooms/${roomId}`);
}

export async function updateRoomMeta(
  projectId: string,
  roomId: number,
  updates: { name?: string; topic?: string; description?: string }
): Promise<ChatRoom> {
  const { data } = await api.patch(`/api/projects/${projectId}/chat/rooms/${roomId}/meta`, updates);
  return data;
}

export async function pinRoomMessage(projectId: string, roomId: number, messageId: number | null): Promise<void> {
  await api.patch(`/api/projects/${projectId}/chat/rooms/${roomId}/pin`, { messageId });
}

export async function toggleReaction(messageId: number, emoji: string, projectId: string): Promise<ChatReactionSummary[]> {
  const { data } = await api.post<ChatReactionSummary[]>(
    `/api/projects/${projectId}/chat/messages/${messageId}/reactions/toggle`,
    { emoji },
  );
  return data;
}

export async function markTeamRead(projectId: string): Promise<void> {
  await api.post(`/api/projects/${projectId}/chat/team/read`);
}

export async function markRoomRead(projectId: string, roomId: number): Promise<void> {
  await api.post(`/api/projects/${projectId}/chat/rooms/${roomId}/read`);
}

export async function markPrivateRead(projectId: string, partner: string): Promise<void> {
  await api.post(`/api/projects/${projectId}/chat/direct/read`, null, {
    params: { with: partner },
  });
}

export async function uploadChatDocument(
  projectId: string,
  file: ChatUploadFile,
): Promise<string> {
  let capabilities = DEFAULT_ATTACHMENT_CAPABILITIES;
  let capabilitiesAvailable = false;
  try {
    const response = await api.get<ChatAttachmentCapabilities>(
      `/api/projects/${projectId}/chat/attachments/upload-capabilities`,
    );
    capabilities = response.data;
    capabilitiesAvailable = true;
  } catch {
    // Preserve compatibility with additive backends that only expose multipart upload.
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const allowedExtensions = capabilities.allowedExtensions ?? Object.keys(MIME_BY_EXTENSION);
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error(`Unsupported file type. Choose: ${allowedExtensions.join(', ')}.`);
  }
  const contentType = file.mimeType?.trim() || MIME_BY_EXTENSION[extension] || 'application/octet-stream';
  const aliases = capabilities.mimeTypesByExtension?.[extension] ?? [];
  if (contentType !== 'application/octet-stream' && aliases.length > 0 && !aliases.includes(contentType)) {
    throw new Error('The file extension and content type do not match.');
  }

  let body: File | Blob | undefined = file.file;
  let fileSize = file.size ?? file.file?.size;
  if (!fileSize || !body) {
    const localResponse = await fetch(file.uri);
    if (!localResponse.ok) throw new Error('The selected file could not be read.');
    const blob = await localResponse.blob();
    body ??= blob;
    fileSize ??= blob.size;
  }
  if (!fileSize || fileSize <= 0) throw new Error('The selected file is empty.');
  if (capabilities.maxFileSizeBytes && fileSize > capabilities.maxFileSizeBytes) {
    throw new Error(`Files must be ${Math.floor(capabilities.maxFileSizeBytes / 1024 / 1024)} MB or smaller.`);
  }

  if (capabilitiesAvailable && capabilities.directUploadEnabled) {
    let initialized: ChatAttachmentUploadInitResponse;
    try {
      const response = await api.post<ChatAttachmentUploadInitResponse>(
        `/api/projects/${projectId}/chat/attachments/upload/init`,
        { fileName: file.name, contentType, fileSize },
      );
      initialized = response.data;
      if (!initialized.uploadUrl || !initialized.objectKey || !initialized.contentType) {
        throw new Error('The upload service returned an incomplete reservation.');
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status != null && status < 500) {
        throw new Error(apiErrorMessage(error, 'Failed to initialize the upload.'));
      }
      return uploadChatDocumentViaBackend(projectId, file);
    }

    try {
      const putResponse = await fetch(initialized.uploadUrl, {
        method: 'PUT',
        body,
        headers: { 'Content-Type': initialized.contentType },
      });
      if (!putResponse.ok) return uploadChatDocumentViaBackend(projectId, file);
    } catch {
      return uploadChatDocumentViaBackend(projectId, file);
    }

    try {
      const response = await api.post<{ downloadUrl?: string }>(
        `/api/projects/${projectId}/chat/attachments/upload/finalize`,
        {
          objectKey: initialized.objectKey,
          fileName: file.name,
          contentType,
          fileSize,
        },
      );
      if (!response.data.downloadUrl) {
        throw new Error('The upload response did not include a download URL.');
      }
      return response.data.downloadUrl;
    } catch (error) {
      throw new Error(apiErrorMessage(
        error,
        'The file reached storage, but the upload could not be finalized.',
      ));
    }
  }

  return uploadChatDocumentViaBackend(projectId, file);
}

async function uploadChatDocumentViaBackend(
  projectId: string,
  file: ChatUploadFile,
): Promise<string> {
  const formData = new FormData();

  if (file.file) {
    formData.append('file', file.file);
  } else {
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as unknown as Blob);
  }

  try {
    const { data } = await api.post<string>(
      `/api/projects/${projectId}/chat/messages/upload-document`,
      formData,
    );
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'The file could not be uploaded.'));
  }
}

export async function postTelemetry(
  projectId: string,
  action: string,
  target: string,
  details?: string
): Promise<void> {
  await postTelemetryBuilder(api, projectId, { action, target, details });
}
projectId: string,
  action: string,
    target: string,
      details ?: string
): Promise < void> {
  await postTelemetryBuilder(api, projectId, { action, target, details });
}
