package com.planora.backend.service;

import com.planora.backend.dto.*;
import com.planora.backend.exception.BadRequestException;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.DocumentUploadException;
import com.planora.backend.model.*;
import com.planora.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import jakarta.persistence.EntityNotFoundException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

@Service
@RequiredArgsConstructor
public class TaskAttachmentService {

    private static final Logger logger = LoggerFactory.getLogger(TaskAttachmentService.class);

    // Presigned URLs expire quickly to minimize the attack window if a link is leaked.
    private static final Duration URL_DURATION = Duration.ofMinutes(15);

    private final TaskAttachmentRepository taskAttachmentRepository;
    private final TaskRepository taskRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final S3StorageService s3StorageService;
    private final WorkAttachmentPolicy attachmentPolicy;

    // Distinct from the DMS bucket. Keeping task attachments in their own bucket
    // makes setting up AWS lifecycle rules (like auto-deleting after 1 year) much easier.
    @Value("${aws.s3.task-bucket}")
    private String taskBucket;

    // Generates the cryptographic ticket allowing the frontend to push bytes directly to AWS.
    @Transactional(readOnly = true)
    public TaskAttachmentUploadInitResponseDTO initUpload(Long taskId, Long userId, TaskAttachmentUploadInitRequestDTO request) {
        // Step 1: Validate the task exists and the user is authorized to see it.
        Task task = getTask(taskId);
        validateTeamMember(task, userId);

        // Step 2: Ensure the file isn't too big or a dangerous format.
        WorkAttachmentPolicy.ValidatedAttachment validated =
                attachmentPolicy.validate(request.getFileName(), request.getContentType(), request.getFileSize());

        // Step 3: Construct the isolated S3 path.
        String objectKey = buildObjectKey(taskId, validated.safeFileName());

        // Step 4: Ask our S3 adapter to mint the temporary upload URL.
        String uploadUrl = s3StorageService.generatePresignedUploadUrl(
                taskBucket, objectKey, validated.contentType(), validated.fileSize(), URL_DURATION);

        return TaskAttachmentUploadInitResponseDTO.builder()
                .uploadUrl(uploadUrl)
                .objectKey(objectKey)
                .expiresInSeconds(URL_DURATION.getSeconds())
                .build();
    }

    @Transactional
    public TaskAttachmentResponseDTO finalizeUpload(Long taskId, Long userId, TaskAttachmentUploadFinalizeRequestDTO request) {
        // Step 1: Standard security validations.
        Task task = getTask(taskId);
        validateTeamMember(task, userId);
        WorkAttachmentPolicy.ValidatedAttachment validated =
                attachmentPolicy.validate(request.getFileName(), request.getContentType(), request.getFileSize());

        // Step 2: Ensure they aren't trying to attach a file from Task B into Task A.
        validateObjectKeyOwnership(taskId, request.getObjectKey());

        // Step 3: Trust the signed S3 object's metadata, never the metadata sent
        // back by the client. This prevents a client from finalizing an oversized
        // or differently typed object after it has received an upload URL.
        HeadObjectResponse object = s3StorageService.headObject(taskBucket, request.getObjectKey());
        String storedContentType = attachmentPolicy.normalizeStoredContentType(request.getFileName(), object.contentType());
        long storedSize = object.contentLength() == null ? -1L : object.contentLength();
        if (storedContentType == null
                || !storedContentType.equals(validated.contentType())
                || storedSize != validated.fileSize()) {
            throw new DocumentUploadException(
                    "UPLOAD_METADATA_MISMATCH",
                    "Uploaded object metadata does not match the upload request",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        // Step 4: Idempotency. If the frontend had a network retry and sent this twice,
        // just return the existing record instead of crashing or creating duplicates.
        TaskAttachment existing = taskAttachmentRepository.findByObjectKey(request.getObjectKey()).orElse(null);
        if (existing != null) {
            return mapToDTO(existing);
        }

        User uploader = getUser(userId);

        // Step 5: Save the definitive database record.
        TaskAttachment attachment = new TaskAttachment();
        attachment.setTask(task);
        attachment.setFileName(validated.safeFileName());
        attachment.setContentType(storedContentType);
        attachment.setFileSize(storedSize);
        attachment.setObjectKey(request.getObjectKey());
        attachment.setUploadedBy(uploader);

        TaskAttachment saved = taskAttachmentRepository.save(attachment);
        return mapToDTO(saved);
    }

    @Transactional
    public TaskAttachmentResponseDTO uploadViaBackend(Long taskId, Long userId, MultipartFile file) {

        // Step 1: Security checks.
        Task task = getTask(taskId);
        validateTeamMember(task, userId);

        if (file == null || file.isEmpty()) {
            throw new DocumentUploadException(
                    "INVALID_FILE_SIZE",
                    "The file is empty.",
                    HttpStatus.BAD_REQUEST);
        }

        // Step 2: Validate and sanitize the incoming file.
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.bin";
        WorkAttachmentPolicy.ValidatedAttachment validated =
                attachmentPolicy.validate(fileName, file.getContentType(), file.getSize());

        String objectKey = buildObjectKey(taskId, validated.safeFileName());

        // Step 3: Stream the bytes from Spring Boot to AWS S3.
        try {
            s3StorageService.putObject(taskBucket, objectKey, validated.contentType(),
                    file.getInputStream(), file.getSize());
        } catch (Exception e) {
            throw new DocumentUploadException(
                    "STORAGE_UPLOAD_FAILED",
                    "Could not upload file to storage",
                    HttpStatus.BAD_GATEWAY);
        }

        // Step 4: Code Reuse trick. We build a fake request and pass it to Phase 2
        // so we don't have to duplicate the database save logic.
        TaskAttachmentUploadFinalizeRequestDTO finalizeRequest = new TaskAttachmentUploadFinalizeRequestDTO();
        finalizeRequest.setFileName(fileName);
        finalizeRequest.setContentType(validated.contentType());
        finalizeRequest.setFileSize(file.getSize());
        finalizeRequest.setObjectKey(objectKey);

        return finalizeUpload(taskId, userId, finalizeRequest);
    }

    @Transactional(readOnly = true)
    public List<TaskAttachmentResponseDTO> listAttachments(Long taskId, Long userId) {
        Task task = getTask(taskId);
        validateTeamMember(task, userId);

        return taskAttachmentRepository.findByTaskIdOrderByCreatedAtDesc(taskId)
                .stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Transactional
    public void deleteAttachment(Long taskId, Long attachmentId, Long userId) {
        Task task = getTask(taskId);
        validateTeamMember(task, userId);

        TaskAttachment attachment = taskAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new EntityNotFoundException("Attachment not found"));

        // Security: Ensure the attachment actually belongs to the specified task context.
        if (!attachment.getTask().getId().equals(taskId)) {
            throw new BadRequestException("Attachment does not belong to this task");
        }

        // Step 1: Delete physical bytes from AWS.
        try {
            s3StorageService.deleteObject(taskBucket, attachment.getObjectKey());
        } catch (Exception e) {
            // If AWS fails, log it but continue. We still want to remove it from the UI.
            logger.warn("Failed to delete object from S3 for key {}: {}", attachment.getObjectKey(), e.getMessage());
        }

        // Step 2: Delete logical record from database.
        taskAttachmentRepository.delete(attachment);
    }

    // ── Task-specific helpers ──

    private Task getTask(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found"));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
    }

    // Ensure the user is a member of the project team before letting them view/upload attachments.
    private void validateTeamMember(Task task, Long userId) {
        Long teamId = task.getProject().getTeam().getId();
        teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new ForbiddenException("User is not a member of this project team"));
    }

    // Scopes the S3 key specifically to the Task ID to prevent cross-contamination.
    private String buildObjectKey(Long taskId, String safeFileName) {
        return "task-" + taskId + "/" + UUID.randomUUID() + "-" + safeFileName;
    }

    // Task-specific: ensures the objectKey belongs to this task's S3 prefix.
    private void validateObjectKeyOwnership(Long taskId, String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new DocumentUploadException(
                    "INVALID_OBJECT_KEY",
                    "objectKey is required",
                    HttpStatus.BAD_REQUEST);
        }
        String expectedPrefix = "task-" + taskId + "/";
        if (!objectKey.startsWith(expectedPrefix)) {
            throw new DocumentUploadException(
                    "INVALID_OBJECT_KEY",
                    "Invalid object key for this task",
                    HttpStatus.FORBIDDEN);
        }
    }

    private TaskAttachmentResponseDTO mapToDTO(TaskAttachment attachment) {
        return TaskAttachmentResponseDTO.builder()
                .id(attachment.getId())
                .fileName(attachment.getFileName())
                .contentType(attachment.getContentType())
                .fileSize(attachment.getFileSize())
                .downloadUrl(s3StorageService.generatePresignedDownloadUrl(
                        taskBucket, attachment.getObjectKey(), URL_DURATION))
                .uploadedByName(attachment.getUploadedBy().getUsername())
                .createdAt(attachment.getCreatedAt())
                .build();
    }
}
