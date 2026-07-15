package com.planora.backend.service;

import com.planora.backend.dto.*;
import com.planora.backend.exception.DocumentUploadException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.exception.StorageQuotaExceededException;
import com.planora.backend.model.*;
import com.planora.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DocumentBatchUploadService {
    private static final long PROJECT_QUOTA_BYTES = 5L * 1024 * 1024 * 1024;
    private static final Duration UPLOAD_DURATION = Duration.ofMinutes(15);

    private final DocumentUploadReservationRepository reservationRepository;
    private final DocumentRepository documentRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final DocumentService documentService;
    private final DocumentFileTypeRegistry registry;
    private final S3StorageService storage;
    private final DocumentContentValidationService contentValidation;
    private final VirusScanService virusScanService;

    @Value("${aws.s3.dms-bucket}")
    private String dmsBucket;

    @Value("${app.dms.multi-upload.enabled:true}")
    private boolean enabled;

    @Transactional
    public DocumentBatchUploadInitResponseDTO init(Long projectId, Long userId, DocumentBatchUploadInitRequestDTO request) {
        requireEnabled();
        if (request.getFiles().size() > DocumentFileTypeRegistry.MAX_BATCH_FILES) {
            return rejectedBatch(request, "BATCH_FILE_LIMIT_EXCEEDED", "A selection can contain at most 25 files.");
        }

        Project project = projectRepository.findByIdWithLock(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        DocumentFolder folder = documentService.requireWritableUploadFolder(projectId, userId, request.getFolderId());
        String batchId = UUID.randomUUID().toString();
        LocalDateTime expiresAt = LocalDateTime.now().plus(UPLOAD_DURATION);
        List<DocumentBatchUploadInitResponseDTO.FileResult> results = new ArrayList<>();
        List<PreparedFile> accepted = new ArrayList<>();
        long selectedBytes = request.getFiles().stream().mapToLong(item -> item.getFileSize() == null ? 0 : item.getFileSize()).sum();

        if (selectedBytes > DocumentFileTypeRegistry.MAX_BATCH_SIZE_BYTES) {
            return rejectedBatch(request, "BATCH_SIZE_LIMIT_EXCEEDED", "A selection can contain at most 500 MB.");
        }

        Set<String> clientIds = new HashSet<>();
        for (DocumentBatchUploadInitRequestDTO.FileItem item : request.getFiles()) {
            DocumentBatchUploadInitResponseDTO.FileResult error = validate(item, clientIds);
            if (error != null) results.add(error);
            else accepted.add(new PreparedFile(item, registry.normalizeContentType(item.getFileName(), item.getContentType())));
        }

        long acceptedBytes = accepted.stream().mapToLong(file -> file.item().getFileSize()).sum();
        long used = documentRepository.sumFileSizeByProjectId(projectId);
        long reserved = reservationRepository.sumActiveReservedBytes(projectId,
                List.of(DocumentUploadStatus.RESERVED, DocumentUploadStatus.FINALIZING), LocalDateTime.now());
        if (acceptedBytes > 0 && used + reserved + acceptedBytes > PROJECT_QUOTA_BYTES) {
            throw new StorageQuotaExceededException("Project storage quota exceeded by this upload selection.");
        }

        for (PreparedFile file : accepted) {
            String uploadId = UUID.randomUUID().toString();
            String objectKey = buildObjectKey(projectId, folder, file.item().getFileName());
            DocumentUploadReservation reservation = new DocumentUploadReservation();
            reservation.setUploadId(uploadId); reservation.setBatchId(batchId); reservation.setClientId(file.item().getClientId());
            reservation.setProject(project); reservation.setUser(user); reservation.setFolder(folder);
            reservation.setFileName(safeFileName(file.item().getFileName())); reservation.setContentType(file.contentType());
            reservation.setFileSize(file.item().getFileSize()); reservation.setObjectKey(objectKey);
            reservation.setStatus(DocumentUploadStatus.RESERVED); reservation.setExpiresAt(expiresAt);
            reservationRepository.save(reservation);
            String url = storage.generatePresignedUploadUrl(dmsBucket, objectKey, file.contentType(), UPLOAD_DURATION);
            results.add(DocumentBatchUploadInitResponseDTO.FileResult.builder()
                    .clientId(file.item().getClientId()).accepted(true).uploadId(uploadId).uploadUrl(url)
                    .objectKey(objectKey).contentType(file.contentType()).expiresInSeconds(UPLOAD_DURATION.getSeconds()).build());
        }

        results.sort(Comparator.comparingInt(result -> indexOf(request, result.getClientId())));
        return DocumentBatchUploadInitResponseDTO.builder().batchId(batchId).expiresAt(expiresAt).files(results).build();
    }

    @Transactional(noRollbackFor = DocumentUploadException.class)
    public DocumentResponseDTO finalizeUpload(Long projectId, Long userId, String uploadId) {
        requireEnabled();
        DocumentUploadReservation reservation = reservationRepository.findByUploadIdWithLock(uploadId)
                .orElseThrow(() -> new DocumentUploadException("UPLOAD_EXPIRED", "Upload reservation was not found.", HttpStatus.GONE));
        if (!reservation.getProject().getId().equals(projectId) || !reservation.getUser().getUserId().equals(userId)) {
            throw new DocumentUploadException("FOLDER_WRITE_DENIED", "This upload does not belong to the current user and project.", HttpStatus.FORBIDDEN);
        }
        if (reservation.getStatus() == DocumentUploadStatus.FINALIZED && reservation.getDocument() != null) {
            return documentService.getDocumentById(projectId, reservation.getDocument().getId(), userId);
        }
        if (reservation.getStatus() != DocumentUploadStatus.RESERVED || reservation.getExpiresAt().isBefore(LocalDateTime.now())) {
            reject(reservation, "UPLOAD_EXPIRED", true);
            throw new DocumentUploadException("UPLOAD_EXPIRED", "The upload URL has expired. Retry the file.", HttpStatus.GONE);
        }

        reservation.setStatus(DocumentUploadStatus.FINALIZING);
        reservationRepository.save(reservation);
        try {
            HeadObjectResponse head = storage.headObject(dmsBucket, reservation.getObjectKey());
            if (!Objects.equals(head.contentLength(), reservation.getFileSize())) {
                throw new DocumentUploadException("CONTENT_TYPE_MISMATCH", "Uploaded file size does not match the reservation.", HttpStatus.UNPROCESSABLE_ENTITY);
            }
            if (head.contentType() != null && !head.contentType().equalsIgnoreCase(reservation.getContentType())) {
                throw new DocumentUploadException("CONTENT_TYPE_MISMATCH", "Uploaded content type does not match the reservation.", HttpStatus.UNPROCESSABLE_ENTITY);
            }
            contentValidation.validate(dmsBucket, reservation.getObjectKey(), reservation.getFileName());
            DocumentUploadFinalizeRequestDTO request = new DocumentUploadFinalizeRequestDTO();
            request.setFileName(reservation.getFileName()); request.setContentType(reservation.getContentType());
            request.setFileSize(reservation.getFileSize()); request.setObjectKey(reservation.getObjectKey());
            request.setFolderId(reservation.getFolder() == null ? null : reservation.getFolder().getId());
            DocumentResponseDTO document = documentService.finalizeUpload(projectId, userId, request);
            reservation.setDocument(documentRepository.getReferenceById(document.getId()));
            reservation.setStatus(DocumentUploadStatus.FINALIZED); reservation.setFinalizedAt(LocalDateTime.now());
            reservationRepository.save(reservation);
            return document;
        } catch (DocumentUploadException ex) {
            reject(reservation, ex.getErrorCode(), true);
            throw ex;
        } catch (Exception ex) {
            reject(reservation, "STORAGE_UPLOAD_FAILED", false);
            throw new DocumentUploadException("STORAGE_UPLOAD_FAILED", "The uploaded file could not be finalized.", HttpStatus.BAD_GATEWAY);
        }
    }

    @Transactional(noRollbackFor = DocumentUploadException.class)
    public DocumentResponseDTO uploadViaBackend(Long projectId, Long userId, String uploadId, MultipartFile file) {
        requireEnabled();
        DocumentUploadReservation reservation = reservationRepository.findById(uploadId)
                .orElseThrow(() -> new DocumentUploadException("UPLOAD_EXPIRED", "Upload reservation was not found.", HttpStatus.GONE));
        if (!reservation.getProject().getId().equals(projectId) || !reservation.getUser().getUserId().equals(userId)) {
            throw new DocumentUploadException("FOLDER_WRITE_DENIED", "This upload does not belong to the current user and project.", HttpStatus.FORBIDDEN);
        }
        if (file == null || file.isEmpty() || file.getSize() != reservation.getFileSize()) {
            throw new DocumentUploadException("CONTENT_TYPE_MISMATCH", "Fallback upload does not match the reserved file.", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        try {
            storage.putObject(dmsBucket, reservation.getObjectKey(), reservation.getContentType(), file.getInputStream(), file.getSize());
        } catch (Exception ex) {
            throw new DocumentUploadException("STORAGE_UPLOAD_FAILED", "Backend fallback upload failed.", HttpStatus.BAD_GATEWAY);
        }
        return finalizeUpload(projectId, userId, uploadId);
    }

    public DocumentUploadCapabilitiesResponseDTO capabilities() {
        return DocumentUploadCapabilitiesResponseDTO.builder().multiUploadEnabled(enabled).acceptedExtensions(registry.extensions())
                .mimeTypesByExtension(registry.mimeTypes()).maxFileSizeBytes(DocumentFileTypeRegistry.MAX_FILE_SIZE_BYTES)
                .maxBatchFiles(DocumentFileTypeRegistry.MAX_BATCH_FILES).maxBatchSizeBytes(DocumentFileTypeRegistry.MAX_BATCH_SIZE_BYTES)
                .recommendedConcurrency(DocumentFileTypeRegistry.RECOMMENDED_CONCURRENCY).build();
    }

    private DocumentBatchUploadInitResponseDTO.FileResult validate(DocumentBatchUploadInitRequestDTO.FileItem item, Set<String> clientIds) {
        if (!clientIds.add(item.getClientId())) return error(item, "CONTENT_TYPE_MISMATCH", "clientId must be unique within a batch.");
        if (!registry.supports(item.getFileName())) return error(item, "UNSUPPORTED_EXTENSION", "This file extension is not supported.");
        if (item.getFileSize() == null || item.getFileSize() <= 0 || item.getFileSize() > DocumentFileTypeRegistry.MAX_FILE_SIZE_BYTES)
            return error(item, "FILE_TOO_LARGE", "Files must be between 1 byte and 100 MB.");
        if (registry.normalizeContentType(item.getFileName(), item.getContentType()) == null)
            return error(item, "CONTENT_TYPE_MISMATCH", "The declared content type does not match the extension.");
        return null;
    }

    private DocumentBatchUploadInitResponseDTO.FileResult error(DocumentBatchUploadInitRequestDTO.FileItem item, String code, String message) {
        return DocumentBatchUploadInitResponseDTO.FileResult.builder().clientId(item.getClientId()).accepted(false).errorCode(code).message(message).build();
    }

    private DocumentBatchUploadInitResponseDTO rejectedBatch(DocumentBatchUploadInitRequestDTO request, String code, String message) {
        return DocumentBatchUploadInitResponseDTO.builder().batchId(UUID.randomUUID().toString()).expiresAt(LocalDateTime.now())
                .files(request.getFiles().stream().map(item -> error(item, code, message)).toList()).build();
    }

    private void reject(DocumentUploadReservation reservation, String code, boolean deleteObject) {
        reservation.setStatus(DocumentUploadStatus.REJECTED); reservation.setErrorCode(code); reservationRepository.save(reservation);
        if (deleteObject) {
            try { storage.deleteObject(dmsBucket, reservation.getObjectKey()); } catch (Exception ignored) { }
        }
    }

    private String buildObjectKey(Long projectId, DocumentFolder folder, String fileName) {
        return "project-" + projectId + "/quarantine/" + (folder == null ? "root" : "folder-" + folder.getId()) + "/" + UUID.randomUUID() + "-" + safeFileName(fileName).replace(" ", "_");
    }

    private String safeFileName(String fileName) {
        String value = fileName.trim().replace('\\', '/');
        value = value.substring(value.lastIndexOf('/') + 1);
        if (value.isBlank()) throw new DocumentUploadException("UNSUPPORTED_EXTENSION", "Invalid file name.", HttpStatus.BAD_REQUEST);
        return value;
    }

    private int indexOf(DocumentBatchUploadInitRequestDTO request, String clientId) {
        for (int i = 0; i < request.getFiles().size(); i++) if (request.getFiles().get(i).getClientId().equals(clientId)) return i;
        return Integer.MAX_VALUE;
    }

    private record PreparedFile(DocumentBatchUploadInitRequestDTO.FileItem item, String contentType) { }

    private void requireEnabled() {
        if (!enabled) throw new DocumentUploadException("MULTI_UPLOAD_DISABLED", "Multi-file uploads are not enabled.", HttpStatus.NOT_FOUND);
    }
}
