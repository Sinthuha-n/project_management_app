package com.planora.backend.service;

import java.time.Duration;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.planora.backend.dto.ChatAttachmentUploadFinalizeRequestDTO;
import com.planora.backend.dto.ChatAttachmentUploadCapabilitiesDTO;
import com.planora.backend.dto.ChatAttachmentUploadInitRequestDTO;
import com.planora.backend.dto.ChatAttachmentUploadInitResponseDTO;
import com.planora.backend.dto.ChatAttachmentUploadResponseDTO;
import com.planora.backend.exception.DocumentUploadException;

import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

@Service
@RequiredArgsConstructor
public class ChatDocumentService {
    private final S3StorageService s3StorageService;
    private final WorkAttachmentPolicy attachmentPolicy;

    @Value("${aws.s3.chat-bucket}")
    private String chatBucket;

    // Short-lived URLs limit accidental long-term sharing while keeping UX smooth.
    private static final Duration URL_DURATION = Duration.ofMinutes(15);
    private static final Duration UPLOAD_URL_DURATION = Duration.ofMinutes(10);

    public ChatAttachmentUploadCapabilitiesDTO capabilities(boolean directUploadEnabled) {
        return new ChatAttachmentUploadCapabilitiesDTO(
                WorkAttachmentPolicy.MAX_FILE_SIZE_BYTES,
                attachmentPolicy.extensions(),
                attachmentPolicy.mimeTypes(),
                directUploadEnabled);
    }

    public ChatAttachmentUploadInitResponseDTO initUpload(Long projectId,
                                                          Long userId,
                                                          ChatAttachmentUploadInitRequestDTO request) {
        WorkAttachmentPolicy.ValidatedAttachment attachment =
                attachmentPolicy.validate(request.fileName(), request.contentType(), request.fileSize());
        String objectKey = buildObjectKey(projectId, userId, attachment.safeFileName());
        try {
            String uploadUrl = s3StorageService.generatePresignedUploadUrl(
                    chatBucket,
                    objectKey,
                    attachment.contentType(),
                    attachment.fileSize(),
                    UPLOAD_URL_DURATION);
            return new ChatAttachmentUploadInitResponseDTO(
                    uploadUrl,
                    objectKey,
                    attachment.contentType(),
                    UPLOAD_URL_DURATION.getSeconds());
        } catch (Exception exception) {
            throw storageFailure("The upload reservation could not be created.");
        }
    }

    public ChatAttachmentUploadResponseDTO finalizeUpload(Long projectId,
                                                          Long userId,
                                                          ChatAttachmentUploadFinalizeRequestDTO request) {
        WorkAttachmentPolicy.ValidatedAttachment attachment =
                attachmentPolicy.validate(request.fileName(), request.contentType(), request.fileSize());
        validateOwnedObjectKey(projectId, userId, request.objectKey());
        if (!request.objectKey().endsWith("-" + attachment.safeFileName())) {
            throw new DocumentUploadException(
                    "UPLOAD_METADATA_MISMATCH",
                    "The upload file name does not match the initialized upload.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        final HeadObjectResponse stored;
        try {
            stored = s3StorageService.headObject(chatBucket, request.objectKey());
        } catch (Exception exception) {
            throw storageFailure("The uploaded object could not be verified.");
        }
        long storedSize = stored.contentLength() == null ? -1L : stored.contentLength();
        String storedType = attachmentPolicy.normalizeStoredContentType(request.fileName(), stored.contentType());
        if (storedSize != attachment.fileSize()
                || storedType == null
                || !storedType.equals(attachment.contentType())) {
            throw new DocumentUploadException(
                    "UPLOAD_METADATA_MISMATCH",
                    "Uploaded file metadata does not match the upload request.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        try {
            return new ChatAttachmentUploadResponseDTO(
                    s3StorageService.generatePresignedDownloadUrl(chatBucket, request.objectKey(), URL_DURATION));
        } catch (Exception exception) {
            throw storageFailure("The attachment download URL could not be created.");
        }
    }

    public String uploadChatDocument(MultipartFile file, Long projectId, Long userId) {
        if (file == null || file.isEmpty()) {
            throw new DocumentUploadException("INVALID_FILE_SIZE", "The file is empty.", HttpStatus.BAD_REQUEST);
        }
        WorkAttachmentPolicy.ValidatedAttachment attachment =
                attachmentPolicy.validate(file.getOriginalFilename(), file.getContentType(), file.getSize());
        String objectKey = buildObjectKey(projectId, userId, attachment.safeFileName());
        try {
            s3StorageService.putObject(
                    chatBucket,
                    objectKey,
                    attachment.contentType(),
                    file.getInputStream(),
                    attachment.fileSize());
            return s3StorageService.generatePresignedDownloadUrl(chatBucket, objectKey, URL_DURATION);
        } catch (Exception e) {
            throw new DocumentUploadException(
                    "STORAGE_UPLOAD_FAILED",
                    "The chat attachment could not be uploaded.",
                    HttpStatus.BAD_GATEWAY);
        }
    }

    public String refreshPresignedUrl(String expiredUrl, Long projectId) {
        try {
            String key = extractObjectKey(expiredUrl);
            if (!belongsToProject(key, projectId)) {
                throw new DocumentUploadException(
                        "ATTACHMENT_ACCESS_DENIED",
                        "This attachment does not belong to the requested project.",
                        HttpStatus.FORBIDDEN);
            }
            return s3StorageService.generatePresignedDownloadUrl(chatBucket, key, URL_DURATION);
        } catch (DocumentUploadException exception) {
            throw exception;
        } catch (Exception e) {
            throw new DocumentUploadException(
                    "INVALID_ATTACHMENT_URL",
                    "The attachment URL is invalid.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    public void deleteChatDocument(String documentUrl) {
        try {
            s3StorageService.deleteObject(chatBucket, extractObjectKey(documentUrl));
        } catch (Exception e) {
            // Deletion failures should not block message lifecycle operations.
            System.err.println("Failed to delete chat document from S3 or Not a valid S3 URL: " + e.getMessage());
        }
    }

    private String buildObjectKey(Long projectId, Long userId, String safeFileName) {
        return "project-" + projectId
                + "/user-" + userId
                + "/" + UUID.randomUUID()
                + "-" + safeFileName;
    }

    private void validateOwnedObjectKey(Long projectId, Long userId, String objectKey) {
        String expectedPrefix = "project-" + projectId + "/user-" + userId + "/";
        if (objectKey == null
                || objectKey.length() > 600
                || objectKey.contains("..")
                || !objectKey.startsWith(expectedPrefix)) {
            throw new DocumentUploadException(
                    "INVALID_OBJECT_KEY",
                    "The upload key is invalid for this user and project.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private boolean belongsToProject(String objectKey, Long projectId) {
        return objectKey.startsWith("project-" + projectId + "/")
                || objectKey.startsWith(projectId + "/");
    }

    private DocumentUploadException storageFailure(String message) {
        return new DocumentUploadException(
                "STORAGE_UPLOAD_FAILED",
                message,
                HttpStatus.BAD_GATEWAY);
    }

    private String extractObjectKey(String documentUrl) throws Exception {
        URL url = new URL(documentUrl);
        String path = url.getPath();
        if (path.startsWith("/")) path = path.substring(1);
        String key = URLDecoder.decode(path, StandardCharsets.UTF_8.name());
        if (key.startsWith(chatBucket + "/")) key = key.substring(chatBucket.length() + 1);
        return key;
    }
}
