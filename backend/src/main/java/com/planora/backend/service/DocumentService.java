package com.planora.backend.service;

import com.planora.backend.dto.*;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.exception.StorageQuotaExceededException;
import com.planora.backend.model.*;
import com.planora.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * This service handles a highly scalable two-step upload process (Direct-to-S3),
 * hierarchical folder structures, document versioning, and strict role-based access control.
 */
@Service
@RequiredArgsConstructor
public class DocumentService {

    private static final Logger logger = LoggerFactory.getLogger(DocumentService.class);

    private static final long MAX_FILE_SIZE_BYTES = DocumentFileTypeRegistry.MAX_FILE_SIZE_BYTES;
    private static final long PROJECT_STORAGE_QUOTA_BYTES = 5L * 1024 * 1024 * 1024;
    private static final long VERSION_MIN_INTERVAL_MINUTES = 5;
    private static final long VERSION_MIN_SIZE_DELTA_BYTES = 512;

    // Security: Presigned URLs are only valid for a short window. If the client doesn't
    // complete the upload/download in 15 minutes, they have to request a new URL.
    private static final Duration URL_DURATION = Duration.ofMinutes(15);

    // Strict whitelist of acceptable file formats. Prevents users from uploading
    // malicious executables (.exe, .sh) or heavy video files.
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
    );

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository documentVersionRepository;
    private final DocumentFolderRepository documentFolderRepository;
    private final DocumentFolderPermissionRepository folderPermissionRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final S3StorageService s3StorageService;
    private final VirusScanService virusScanService;
    private final DocumentFileTypeRegistry fileTypeRegistry;

    @Value("${aws.s3.dms-bucket}")
    private String dmsBucket;

    /*
     * Instead of the frontend sending a 25MB file to our Spring Boot server (which eats up our bandwidth),
     * we give the frontend a cryptographic "ticket" (Presigned URL) so it can upload the file directly to AWS.
     */
    @Transactional(readOnly = true)
    public DocumentUploadInitResponseDTO initUpload(Long projectId, Long userId, DocumentUploadInitRequestDTO request) {
        // Step 1: Security check. Are they in the project? Are they allowed to upload?
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        // Step 2: Sanity check the file metadata before we authorize AWS to accept it.
        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());
        requireWithinProjectQuota(projectId, request.getFileSize());

        // Step 3: Validate the target folder exists and isn't deleted.
        Long folderId = request.getFolderId();
        if (folderId != null) {
            DocumentFolder folder = resolveFolder(projectId, folderId);
            requireFolderPermission(folder.getId(), member, "WRITE");
        }

        // Step 4: Generate a collision-free path in our S3 bucket.
        String objectKey = buildObjectKey(projectId, folderId, request.getFileName());

        // Step 5: Ask AWS for the temporary upload ticket.
        String uploadUrl = s3StorageService.generatePresignedUploadUrl(dmsBucket, objectKey, request.getContentType(), URL_DURATION);

        return DocumentUploadInitResponseDTO.builder()
                .uploadUrl(uploadUrl)
                .objectKey(objectKey)
                .expiresInSeconds(URL_DURATION.getSeconds())
                .build();
    }

    // After successfully uploading a file, we need to save the metadata to our database.
    @Transactional(noRollbackFor = com.planora.backend.exception.DocumentUploadException.class)
    public DocumentResponseDTO finalizeUpload(Long projectId, Long userId, DocumentUploadFinalizeRequestDTO request) {
        // Step 1: Re-verify permissions.
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        // Step 2: Validate the request and ensure the user isn't trying to hijack someone else's object key.
        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());
        validateObjectKeyOwnership(projectId, request.getObjectKey());

        // Virus scan verification
        virusScanService.scanFile(dmsBucket, request.getObjectKey(), request.getFileName());

        // Step 3: Crucial check — did the file actually make it to S3?
        // We don't want a database record pointing to a ghost file.
        verifyObjectExists(request.getObjectKey());

        // Step 4: Idempotency check. If the frontend had a network blip and sent this
        // request twice, we just return the existing document instead of crashing.
        DocumentVersion existingVersion = documentVersionRepository.findByObjectKey(request.getObjectKey()).orElse(null);
        if (existingVersion != null) {
            requireDocumentFolderPermission(existingVersion.getDocument(), member, "WRITE");
            return mapDocument(existingVersion.getDocument(), true);
        }

        // Step 5: Fetch relationships.
        Project project = getProject(projectId);
        User uploader = getUser(userId);
        DocumentFolder folder = resolveFolder(projectId, request.getFolderId());
        if (folder != null) {
            requireFolderPermission(folder.getId(), member, "WRITE");
        }

        // Step 6: Create the parent Document record.
        Document document = new Document();
        document.setProject(project);
        document.setUploadedBy(uploader);
        document.setFolder(folder);
        document.setName(normalizeFileName(request.getFileName()));
        document.setContentType(request.getContentType());
        document.setFileSize(request.getFileSize());
        document.setLatestVersionNumber(1);
        document.setLatestObjectKey(request.getObjectKey());
        document.setStatus(DocumentStatus.ACTIVE);

        Document savedDocument = documentRepository.save(document);

        // Step 7: Create the Version 1 record.
        DocumentVersion version = new DocumentVersion();
        version.setDocument(savedDocument);
        version.setVersionNumber(1);
        version.setObjectKey(request.getObjectKey());
        version.setContentType(request.getContentType());
        version.setFileSize(request.getFileSize());
        version.setUploadedBy(uploader);
        documentVersionRepository.save(version);

        return mapDocument(savedDocument, true);
    }


    /*
     * Fallback method for clients that cannot support Direct-to-S3 uploads.
     * This streams the file entirely through our backend server.
     */
    @Transactional
    public DocumentResponseDTO uploadDocumentViaBackend(Long projectId, Long userId, MultipartFile file, Long folderId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        if (file == null || file.isEmpty()) {
            throw new RuntimeException("file is required");
        }

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.bin";
        String resolvedContentType = fileTypeRegistry.normalizeContentType(fileName, file.getContentType());

        validateFileRequest(fileName, resolvedContentType, file.getSize());
        requireWithinProjectQuota(projectId, file.getSize());

        if (folderId != null) {
            DocumentFolder folder = resolveFolder(projectId, folderId);
            requireFolderPermission(folder.getId(), member, "WRITE");
        }

        String objectKey = buildObjectKey(projectId, folderId, fileName);

        try {
            // Stream the file bytes to S3
            s3StorageService.putObject(dmsBucket, objectKey, resolvedContentType, file.getInputStream(), file.getSize());
        } catch (Exception e) {
            throw new RuntimeException("Could not upload file to S3 from backend: " + e.getMessage());
        }

        virusScanService.scanFile(dmsBucket, objectKey, fileName);

        // Instead of rewriting the database logic, we just build a fake request
        // and pass it to our existing finalizeUpload method! Code reuse for the win.
        DocumentUploadFinalizeRequestDTO finalizeRequest = new DocumentUploadFinalizeRequestDTO();
        finalizeRequest.setFileName(fileName);
        finalizeRequest.setContentType(resolvedContentType);
        finalizeRequest.setFileSize(file.getSize());
        finalizeRequest.setObjectKey(objectKey);
        finalizeRequest.setFolderId(folderId);

        return finalizeUpload(projectId, userId, finalizeRequest);
    }

    // Generates a ticket for uploading a NEW version of an EXISTING document.
    @Transactional(readOnly = true)
    public DocumentUploadInitResponseDTO initNewVersionUpload(Long projectId, Long documentId, Long userId, DocumentUploadInitRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        // Make sure the document actually exists and isn't sitting in the trash.
        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            throw new RuntimeException("Cannot upload new version for a deleted document");
        }
        requireDocumentFolderPermission(document, member, "WRITE");

        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());

        String objectKey = buildObjectKey(projectId, document.getFolder() != null ? document.getFolder().getId() : null, request.getFileName());
        String uploadUrl = s3StorageService.generatePresignedUploadUrl(dmsBucket, objectKey, request.getContentType(), URL_DURATION);

        return DocumentUploadInitResponseDTO.builder()
                .uploadUrl(uploadUrl)
                .objectKey(objectKey)
                .expiresInSeconds(URL_DURATION.getSeconds())
                .build();
    }

    // Saves the metadata for a new document version and updates the parent document.
    @Transactional
    public DocumentResponseDTO finalizeNewVersionUpload(Long projectId, Long documentId, Long userId, DocumentUploadFinalizeRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            throw new RuntimeException("Cannot create new version for a deleted document");
        }
        requireDocumentFolderPermission(document, member, "WRITE");

        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());
        validateObjectKeyOwnership(projectId, request.getObjectKey());

        // Virus scan verification
        virusScanService.scanFile(dmsBucket, request.getObjectKey(), request.getFileName());

        verifyObjectExists(request.getObjectKey());

        // Step 1: Idempotency check. If we already saved this version, don't crash.
        DocumentVersion existingVersion = documentVersionRepository.findByObjectKey(request.getObjectKey()).orElse(null);
        if (existingVersion != null) {
            // Security check: Make sure they aren't trying to attach a version to the wrong parent doc.
            if (!existingVersion.getDocument().getId().equals(documentId)) {
                throw new RuntimeException("Provided object key already belongs to another document");
            }
            return mapDocument(existingVersion.getDocument(), true);
        }

        User uploader = getUser(userId);

        // BUG-010 Fix: Deduplication - only create a new version if enough
        // time has passed or content changed significantly.
        Optional<DocumentVersion> latestVersion =
                documentVersionRepository.findTopByDocumentIdOrderByVersionNumberDesc(documentId);

        if (latestVersion.isPresent()) {
            DocumentVersion latest = latestVersion.get();
            boolean enoughTimePassed = latest.getCreatedAt() != null
                    && Duration.between(latest.getCreatedAt(), LocalDateTime.now()).toMinutes() >= VERSION_MIN_INTERVAL_MINUTES;
            boolean contentChanged = request.getFileSize() != null
                    && latest.getFileSize() != null
                    && Math.abs(request.getFileSize() - latest.getFileSize()) >= VERSION_MIN_SIZE_DELTA_BYTES;

            if (!enoughTimePassed && !contentChanged) {
                // Not enough time and not enough change - update the existing version
                // rather than creating a new record. This collapses rapid autosave bursts.
                latest.setObjectKey(request.getObjectKey());
                latest.setContentType(request.getContentType());
                latest.setFileSize(request.getFileSize());
                latest.setUploadedBy(uploader);
                documentVersionRepository.save(latest);

                // Keep the parent document pointed at the latest content.
                document.setLatestObjectKey(request.getObjectKey());
                document.setContentType(request.getContentType());
                document.setFileSize(request.getFileSize());
                document.setUploadedBy(uploader);
                documentRepository.save(document);

                logger.debug("DocumentService: version dedup - updated existing version {} for doc {}",
                        latest.getVersionNumber(), documentId);
                return mapDocument(document, true);
            }
        }

        // Step 2: Calculate the next version number safely.
        int nextVersion = documentVersionRepository.findTopByDocumentIdOrderByVersionNumberDesc(documentId)
                .map(v -> v.getVersionNumber() + 1)
                .orElse(document.getLatestVersionNumber() + 1);

        // Step 3: Save the new historical version record.
        DocumentVersion version = new DocumentVersion();
        version.setDocument(document);
        version.setVersionNumber(nextVersion);
        version.setObjectKey(request.getObjectKey());
        version.setContentType(request.getContentType());
        version.setFileSize(request.getFileSize());
        version.setUploadedBy(uploader);
        documentVersionRepository.save(version);

        // Step 4: Update the parent document to point to this new version.
        document.setLatestVersionNumber(nextVersion);
        document.setLatestObjectKey(request.getObjectKey());
        document.setContentType(request.getContentType());
        document.setFileSize(request.getFileSize());
        document.setUploadedBy(uploader);
        documentRepository.save(document);

        return mapDocument(document, true);
    }

    @Transactional(readOnly = true)
    public List<DocumentResponseDTO> listDocuments(Long projectId, Long userId, Long folderId, boolean includeDeleted) {
        TeamMember member = getProjectMember(projectId, userId);

        List<Document> documents;
        if (folderId != null) {
            DocumentFolder folder = resolveFolder(projectId, folderId);
            requireFolderPermission(folder.getId(), member, "READ");
            // If they want trash included, don't filter by status. Otherwise, only get ACTIVE.
            documents = includeDeleted
                    ? documentRepository.findByProjectIdAndFolderIdOrderByCreatedAtDesc(projectId, folderId)
                    : documentRepository.findByProjectIdAndFolderIdAndStatusOrderByCreatedAtDesc(projectId, folderId, DocumentStatus.ACTIVE);
        } else {
            // Same logic, but for the root directory (no folder).
            documents = includeDeleted
                    ? documentRepository.findByProjectIdOrderByCreatedAtDesc(projectId)
                    : documentRepository.findByProjectIdAndStatusOrderByCreatedAtDesc(projectId, DocumentStatus.ACTIVE);
        }

        Set<Long> readableFolderIds = getFolderIdsWithPermission(documents.stream()
                .map(Document::getFolder)
                .filter(java.util.Objects::nonNull)
                .map(DocumentFolder::getId)
                .collect(java.util.stream.Collectors.toSet()), member, "READ");

        return documents.stream()
                .filter(document -> document.getFolder() == null || readableFolderIds.contains(document.getFolder().getId()))
                .limit(200)
                .map(document -> mapDocument(document, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public DocumentResponseDTO getDocumentById(Long projectId, Long documentId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        Document document = getDocument(projectId, documentId);
        requireDocumentFolderPermission(document, member, "READ");
        return mapDocument(document, true);
    }

    // Generates a temporary, secure URL for the user to download the file directly from S3.
    @Transactional(readOnly = true)
    public String getDownloadUrl(Long projectId, Long documentId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);

        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            throw new ResourceNotFoundException("Document is deleted");
        }
        requireDocumentFolderPermission(document, member, "READ");

        // Safety check: Ensure the file wasn't manually deleted in the AWS console by an admin.
        try {
            s3StorageService.verifyObjectExists(dmsBucket, document.getLatestObjectKey());
        } catch (ResourceNotFoundException e) {
            throw new ResourceNotFoundException("Document file is no longer available in storage. The file may have been deleted externally.");
        }
        return requiresAttachment(document.getName())
                ? s3StorageService.generatePresignedDownloadUrl(dmsBucket, document.getLatestObjectKey(), URL_DURATION, true)
                : s3StorageService.generatePresignedDownloadUrl(dmsBucket, document.getLatestObjectKey(), URL_DURATION);
    }

    @Transactional(readOnly = true)
    public List<DocumentVersionResponseDTO> getVersions(Long projectId, Long documentId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        Document document = getDocument(projectId, documentId);
        requireDocumentFolderPermission(document, member, "READ");

        return documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId)
                .stream()
                .map(this::mapVersion)
                .toList();
    }

    // Allows renaming a file or moving it to a different folder.
    @Transactional
    public DocumentResponseDTO updateMetadata(Long projectId, Long documentId, Long userId, DocumentMetadataUpdateRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            throw new RuntimeException("Cannot update deleted document");
        }
        requireDocumentFolderPermission(document, member, "WRITE");

        if (request.getName() != null && !request.getName().isBlank()) {
            document.setName(normalizeFileName(request.getName()));
        }

        // Moving the document to a new folder
        if (request.getFolderId() != null) {
            DocumentFolder folder = resolveFolder(projectId, request.getFolderId());
            requireFolderPermission(folder.getId(), member, "WRITE");
            document.setFolder(folder);
        }

        documentRepository.save(document);
        return mapDocument(document, true);
    }

    // Soft Delete: Moves the document to the "Trash" without actually deleting the file from S3.
    // Can be restored later.
    @Transactional
    public void softDelete(Long projectId, Long documentId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireOwnerOrAdmin(member);

        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            return; // Already deleted, nothing to do.
        }

        document.setStatus(DocumentStatus.SOFT_DELETED);
        document.setDeletedAt(LocalDateTime.now());
        documentRepository.save(document);
    }

    // Restores a soft-deleted document back to the active project workspace.
    @Transactional
    public DocumentResponseDTO restore(Long projectId, Long documentId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireOwnerOrAdmin(member);

        Document document = getDocument(projectId, documentId);
        document.setStatus(DocumentStatus.ACTIVE);
        document.setDeletedAt(null);
        document.setUpdatedAt(LocalDateTime.now());
        Document saved = documentRepository.saveAndFlush(document);

        logger.info("Document id={} restored to ACTIVE by userId={}", documentId, userId);
        return mapDocument(saved, true);
    }

    // Hard Delete: Completely wipes the document
    @Transactional
    public void permanentDelete(Long projectId, Long documentId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireOwnerOrAdmin(member);

        Document document = getDocument(projectId, documentId);
        List<DocumentVersion> versions = documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);

        // Step 1: Nuke all physical files from AWS.
        for (DocumentVersion version : versions) {
            try {
                s3StorageService.deleteObject(dmsBucket, version.getObjectKey());
            } catch (Exception e) {
                // If S3 fails, we log it but don't crash. We still want to delete the DB records.
                // (Though in a perfect world, we'd queue a retry for the S3 deletion).
                logger.warn("Failed to delete object from S3 for key {}: {}", version.getObjectKey(), e.getMessage());
            }
        }

        // Step 2: Wipe the database records.
        documentVersionRepository.deleteAll(versions);
        documentRepository.delete(document);
    }

    @Transactional
    public DocumentFolderResponseDTO createFolder(Long projectId, Long userId, DocumentFolderCreateRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        Project project = getProject(projectId);
        User user = getUser(userId);
        DocumentFolder parent = resolveFolder(projectId, request.getParentFolderId());
        if (parent != null) {
            requireFolderPermission(parent.getId(), member, "WRITE");
        }
        String normalizedName = normalizeFolderName(request.getName());

        // Prevent users from making two folders named "Financials" in the exact same directory.
        boolean exists = documentFolderRepository.existsByProjectIdAndParentFolderIdAndNameIgnoreCaseAndDeletedAtIsNull(
                projectId,
                parent != null ? parent.getId() : null,
                normalizedName
        );
        if (exists) {
            throw new RuntimeException("A folder with the same name already exists at this level");
        }

        DocumentFolder folder = new DocumentFolder();
        folder.setName(normalizedName);
        folder.setProject(project);
        folder.setParentFolder(parent);
        folder.setCreatedBy(user);

        DocumentFolder savedFolder = documentFolderRepository.save(folder);
        seedDefaultFolderPermissions(savedFolder, user);
        return mapFolder(savedFolder);
    }

    @Transactional(readOnly = true)
    public List<DocumentFolderResponseDTO> listFolders(Long projectId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        // Only return folders that haven't been soft-deleted.
        List<DocumentFolder> folders = documentFolderRepository.findByProjectIdAndDeletedAtIsNullOrderByCreatedAtAsc(projectId);
        Set<Long> readableFolderIds = getFolderIdsWithPermission(folders.stream()
                .map(DocumentFolder::getId)
                .toList(), member, "READ");

        return folders
                .stream()
                .filter(folder -> readableFolderIds.contains(folder.getId()))
                .map(this::mapFolder)
                .toList();
    }

    @Transactional
    public DocumentFolderResponseDTO updateFolder(Long projectId, Long folderId, Long userId, DocumentFolderUpdateRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        DocumentFolder folder = resolveFolder(projectId, folderId);
        requireFolderPermission(folder.getId(), member, "MANAGE");
        String normalizedName = normalizeFolderName(request.getName());

        DocumentFolder parent = null;
        if (request.getParentFolderId() != null) {
            parent = resolveFolder(projectId, request.getParentFolderId());
            requireFolderPermission(parent.getId(), member, "WRITE");
            // Infinite loop prevention: A folder cannot be placed inside itself.
            if (parent.getId().equals(folderId)) {
                throw new RuntimeException("Folder cannot be its own parent");
            }
        }

        // Check for naming collisions, but allow the user to save if they didn't actually change the name.
        boolean exists = documentFolderRepository.existsByProjectIdAndParentFolderIdAndNameIgnoreCaseAndDeletedAtIsNull(
                projectId,
                parent != null ? parent.getId() : null,
                normalizedName
        );

        if (exists && !(normalizedName.equalsIgnoreCase(folder.getName())
                && ((folder.getParentFolder() == null && parent == null)
                || (folder.getParentFolder() != null && parent != null && folder.getParentFolder().getId().equals(parent.getId()))))) {
            throw new RuntimeException("A folder with the same name already exists at this level");
        }

        folder.setName(normalizedName);
        folder.setParentFolder(parent);
        return mapFolder(documentFolderRepository.save(folder));
    }

    // Deletes a folder and cascadingly deletes EVERYTHING inside of it.
    @Transactional
    public void deleteFolder(Long projectId, Long folderId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireOwnerOrAdmin(member);

        DocumentFolder folder = resolveFolder(projectId, folderId);
        requireFolderPermission(folder.getId(), member, "MANAGE");
        softDeleteFolderRecursive(folder);
    }

    @Transactional
    public void updateFolderPermissions(Long projectId, Long folderId, Long userId, List<FolderPermissionRequest> permissions) {
        TeamMember member = getProjectMember(projectId, userId);
        requireOwnerOrAdmin(member);

        DocumentFolder folder = resolveFolder(projectId, folderId);
        requireFolderPermission(folder.getId(), member, "MANAGE");
        User grantedBy = getUser(userId);

        if (permissions == null) {
            throw new RuntimeException("permissions are required");
        }

        for (FolderPermissionRequest request : permissions) {
            TeamRole role = parseTeamRole(request.teamRole());
            if (role == TeamRole.OWNER) {
                continue;
            }

            folderPermissionRepository.deleteByFolderIdAndTeamRole(folder.getId(), role);

            for (String permission : normalizePermissions(request.permissions())) {
                folderPermissionRepository.save(DocumentFolderPermission.builder()
                        .folder(folder)
                        .teamRole(role)
                        .permission(permission)
                        .grantedBy(grantedBy)
                        .grantedAt(LocalDateTime.now())
                        .build());
            }
        }
    }

    // Recursive helper: Digs through the tree structure and soft-deletes every child folder
    // and document it finds.
    private void softDeleteFolderRecursive(DocumentFolder folder) {
        // Find child folders and recurse down.
        List<DocumentFolder> children = documentFolderRepository.findByParentFolderIdAndDeletedAtIsNull(folder.getId());
        for (DocumentFolder child : children) {
            softDeleteFolderRecursive(child);
        }

        // Find documents in this specific folder and delete them.
        List<Document> activeDocs = documentRepository.findByFolderIdAndStatus(folder.getId(), DocumentStatus.ACTIVE);
        for (Document doc : activeDocs) {
            doc.setStatus(DocumentStatus.SOFT_DELETED);
            doc.setDeletedAt(LocalDateTime.now());
        }
        if (!activeDocs.isEmpty()) {
            documentRepository.saveAll(activeDocs);
        }

        // Finally, delete the folder itself.
        folder.setDeletedAt(LocalDateTime.now());
        documentFolderRepository.save(folder);
    }

    private TeamMember getProjectMember(Long projectId, Long userId) {
        Project project = getProject(projectId);
        return teamMemberRepository.findByTeamIdAndUserUserId(project.getTeam().getId(), userId)
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this project team"));
    }

    private void requireNotViewer(TeamMember member) {
        if (member.getRole() == TeamRole.VIEWER) {
            throw new AccessDeniedException("Viewer role does not have permission for this action");
        }
    }

    private void requireOwnerOrAdmin(TeamMember member) {
        if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
            throw new AccessDeniedException("Only OWNER or ADMIN can perform this action");
        }
    }

    /**
     * Throws ForbiddenException if the given team member does not have
     * the required permission on the specified folder.
     * MANAGE implies WRITE which implies READ.
     */
    private void requireFolderPermission(Long folderId, TeamMember member, String requiredPermission) {
        if (!hasFolderPermission(folderId, member, requiredPermission)) {
            throw new ForbiddenException("You do not have " + requiredPermission + " access to this folder.");
        }
    }

    private void requireDocumentFolderPermission(Document document, TeamMember member, String requiredPermission) {
        if (document.getFolder() != null) {
            requireFolderPermission(document.getFolder().getId(), member, requiredPermission);
        }
    }

    private boolean hasDocumentFolderPermission(Document document, TeamMember member, String requiredPermission) {
        return document.getFolder() == null || hasFolderPermission(document.getFolder().getId(), member, requiredPermission);
    }

    private boolean hasFolderPermission(Long folderId, TeamMember member, String requiredPermission) {
        TeamRole role = member.getRole();
        // OWNER always has all permissions.
        if (role == TeamRole.OWNER) {
            return true;
        }

        List<String> grantedPermissions = folderPermissionRepository
                .findByFolderIdAndTeamRole(folderId, role)
                .stream()
                .map(DocumentFolderPermission::getPermission)
                .toList();

        return hasRequiredPermission(grantedPermissions, requiredPermission);
    }

    private Set<Long> getFolderIdsWithPermission(Collection<Long> folderIds, TeamMember member, String requiredPermission) {
        TeamRole role = member.getRole();
        if (role == TeamRole.OWNER) {
            return new HashSet<>(folderIds);
        }

        if (folderIds.isEmpty()) {
            return Set.of();
        }

        Map<Long, List<String>> permissionsByFolderId = folderPermissionRepository
                .findByFolderIdInAndTeamRole(folderIds, role)
                .stream()
                .collect(Collectors.groupingBy(
                        permission -> permission.getFolder().getId(),
                        Collectors.mapping(DocumentFolderPermission::getPermission, Collectors.toList())
                ));

        return folderIds.stream()
                .filter(folderId -> hasRequiredPermission(permissionsByFolderId.getOrDefault(folderId, List.of()), requiredPermission))
                .collect(Collectors.toSet());
    }

    private boolean hasRequiredPermission(Collection<String> grantedPermissions, String requiredPermission) {
        return switch (requiredPermission) {
            case "READ" -> grantedPermissions.contains("READ")
                    || grantedPermissions.contains("WRITE")
                    || grantedPermissions.contains("MANAGE");
            case "WRITE" -> grantedPermissions.contains("WRITE")
                    || grantedPermissions.contains("MANAGE");
            case "MANAGE" -> grantedPermissions.contains("MANAGE");
            default -> false;
        };
    }

    private void seedDefaultFolderPermissions(DocumentFolder folder, User grantedBy) {
        List<DocumentFolderPermission> permissions = new ArrayList<>();
        addFolderPermission(permissions, folder, TeamRole.ADMIN, "MANAGE", grantedBy);
        addFolderPermission(permissions, folder, TeamRole.MEMBER, "READ", grantedBy);
        addFolderPermission(permissions, folder, TeamRole.MEMBER, "WRITE", grantedBy);
        addFolderPermission(permissions, folder, TeamRole.VIEWER, "READ", grantedBy);
        folderPermissionRepository.saveAll(permissions);
    }

    private void addFolderPermission(
            List<DocumentFolderPermission> permissions,
            DocumentFolder folder,
            TeamRole role,
            String permission,
            User grantedBy
    ) {
        permissions.add(DocumentFolderPermission.builder()
                .folder(folder)
                .teamRole(role)
                .permission(permission)
                .grantedBy(grantedBy)
                .grantedAt(LocalDateTime.now())
                .build());
    }

    private TeamRole parseTeamRole(String teamRole) {
        if (teamRole == null || teamRole.isBlank()) {
            throw new RuntimeException("teamRole is required");
        }

        try {
            return TeamRole.valueOf(teamRole.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("Invalid teamRole: " + teamRole);
        }
    }

    private Set<String> normalizePermissions(Collection<String> permissions) {
        Set<String> normalizedPermissions = new HashSet<>();
        if (permissions == null) {
            return normalizedPermissions;
        }

        for (String permission : permissions) {
            String normalized = permission == null ? "" : permission.trim().toUpperCase();
            if (!Set.of("READ", "WRITE", "MANAGE").contains(normalized)) {
                throw new RuntimeException("Invalid folder permission: " + permission);
            }
            normalizedPermissions.add(normalized);
        }

        return normalizedPermissions;
    }

    private void validateFileRequest(String fileName, String contentType, Long fileSize) {
        String normalizedType = fileTypeRegistry.normalizeContentType(fileName, contentType);
        if (normalizedType == null) {
            throw new RuntimeException("Unsupported file type");
        }
        s3StorageService.validateFileRequest(fileName, normalizedType, fileSize, MAX_FILE_SIZE_BYTES, fileTypeRegistry.allMimeTypes());
    }

    @Transactional(readOnly = true)
    public DocumentFolder requireWritableUploadFolder(Long projectId, Long userId, Long folderId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);
        if (folderId == null) return null;
        DocumentFolder folder = resolveFolder(projectId, folderId);
        requireFolderPermission(folder.getId(), member, "WRITE");
        return folder;
    }

    @Transactional(readOnly = true)
    public void requireProjectMembership(Long projectId, Long userId) {
        getProjectMember(projectId, userId);
    }

    private void requireWithinProjectQuota(Long projectId, Long additionalBytes) {
        long uploadBytes = additionalBytes != null ? additionalBytes : 0L;
        long usedBytes = documentRepository.sumFileSizeByProjectId(projectId);
        if (usedBytes + uploadBytes > PROJECT_STORAGE_QUOTA_BYTES) {
            throw new StorageQuotaExceededException("Project storage quota exceeded. Delete files or contact an admin before uploading more documents.");
        }
    }

    private String resolveContentType(String contentType, String fileName) {
        return s3StorageService.resolveContentType(contentType, fileName);
    }

    // Builds a predictable, secure S3 Object Key.
    // Format: project-{id}/folder-{id}/{uuid}-filename.ext
    // The UUID prevents files with the same name from overwriting each other.
    private String buildObjectKey(Long projectId, Long folderId, String fileName) {
        String safeName = normalizeFileName(fileName).replace(" ", "_");
        String folderPart = folderId != null ? "folder-" + folderId : "root";
        return "project-" + projectId + "/" + folderPart + "/" + UUID.randomUUID() + "-" + safeName;
    }

    // Prevents path traversal attacks (e.g., uploading a file named "../../../etc/passwd").
    private String normalizeFileName(String fileName) {
        String trimmed = fileName.trim();
        String withoutPath = trimmed.replace("\\", "/");
        String nameOnly = withoutPath.substring(withoutPath.lastIndexOf("/") + 1);
        if (nameOnly.isBlank()) {
            throw new RuntimeException("Invalid file name");
        }
        return nameOnly;
    }

    private String normalizeFolderName(String name) {
        String normalized = name == null ? "" : name.trim();
        if (normalized.isBlank()) {
            throw new RuntimeException("Folder name is required");
        }
        return normalized;
    }

    // Ensures users can't finalize an upload using an S3 key that belongs to a different project.
    private void validateObjectKeyOwnership(Long projectId, String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new RuntimeException("objectKey is required");
        }

        String expectedPrefix = "project-" + projectId + "/";
        if (!objectKey.startsWith(expectedPrefix)) {
            throw new RuntimeException("Invalid object key for this project");
        }
    }

    private void verifyObjectExists(String objectKey) {
        s3StorageService.verifyObjectExists(dmsBucket, objectKey);
    }

    private String generateDownloadUrl(String objectKey) {
        return requiresAttachment(objectKey)
                ? s3StorageService.generatePresignedDownloadUrl(dmsBucket, objectKey, URL_DURATION, true)
                : s3StorageService.generatePresignedDownloadUrl(dmsBucket, objectKey, URL_DURATION);
    }

    private boolean requiresAttachment(String name) {
        String extension = fileTypeRegistry.extensionOf(name);
        return extension != null && Set.of("docm", "pptm", "xlsm", "xlsb", "svg", "ai", "eps").contains(extension);
    }

    private Project getProject(Long projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
    }

    private Document getDocument(Long projectId, Long documentId) {
        return documentRepository.findByIdAndProjectId(documentId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found with id: " + documentId));
    }

    private DocumentFolder resolveFolder(Long projectId, Long folderId) {
        if (folderId == null) {
            return null;
        }

        DocumentFolder folder = documentFolderRepository.findByIdAndProjectId(folderId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Folder not found with id: " + folderId));

        if (folder.getDeletedAt() != null) {
            throw new ResourceNotFoundException("Folder is deleted");
        }

        return folder;
    }

    private DocumentResponseDTO mapDocument(Document document, boolean includeDownloadUrl) {
        return DocumentResponseDTO.builder()
                .id(document.getId())
                .name(document.getName())
                .contentType(document.getContentType())
                .fileSize(document.getFileSize())
                .humanReadableSize(formatFileSize(document.getFileSize()))
                .status(document.getStatus())
                .projectId(document.getProject().getId())
                .folderId(document.getFolder() != null ? document.getFolder().getId() : null)
                .folderName(document.getFolder() != null ? document.getFolder().getName() : null)
                .latestVersionNumber(document.getLatestVersionNumber())
                .downloadUrl(includeDownloadUrl && document.getStatus() == DocumentStatus.ACTIVE
                        ? generateDownloadUrl(document.getLatestObjectKey())
                        : null)
                .uploadedById(document.getUploadedBy().getUserId())
                .uploadedByName(document.getUploadedBy().getUsername())
                .createdAt(document.getCreatedAt())
                .updatedAt(document.getUpdatedAt())
                .deletedAt(document.getDeletedAt())
                .build();
    }

    private String formatFileSize(Long bytes) {
        if (bytes == null || bytes < 0) return "0 B";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024L * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }

    private DocumentVersionResponseDTO mapVersion(DocumentVersion version) {
        return DocumentVersionResponseDTO.builder()
                .id(version.getId())
                .versionNumber(version.getVersionNumber())
                .contentType(version.getContentType())
                .fileSize(version.getFileSize())
                .uploadedById(version.getUploadedBy().getUserId())
                .uploadedByName(version.getUploadedBy().getUsername())
                .uploadedAt(version.getCreatedAt())
                .downloadUrl(generateDownloadUrl(version.getObjectKey()))
                .build();
    }

    @Transactional(readOnly = true)
    public ProjectStorageQuotaResponseDTO getStorageQuota(Long projectId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        
        long usedBytes = documentRepository.sumFileSizeByProjectId(projectId);
        long quotaBytes = PROJECT_STORAGE_QUOTA_BYTES;
        long maxFileSizeBytes = MAX_FILE_SIZE_BYTES; // 100 MB
        long documentCount = documentRepository.countByProjectIdAndStatus(projectId, DocumentStatus.ACTIVE);
        
        return ProjectStorageQuotaResponseDTO.builder()
                .usedBytes(usedBytes)
                .quotaBytes(quotaBytes)
                .maxFileSizeBytes(maxFileSizeBytes)
                .documentCount(documentCount)
                .humanReadableUsed(formatFileSize(usedBytes))
                .humanReadableQuota(formatFileSize(quotaBytes))
                .build();
    }

    @Transactional(readOnly = true)
    public List<FolderPermissionRequest> getFolderPermissions(Long projectId, Long folderId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        DocumentFolder folder = resolveFolder(projectId, folderId);
        requireFolderPermission(folder.getId(), member, "READ");

        List<DocumentFolderPermission> folderPermissions = folderPermissionRepository.findByFolderId(folderId);

        Map<TeamRole, List<String>> permissionsByRole = folderPermissions.stream()
                .collect(Collectors.groupingBy(
                        DocumentFolderPermission::getTeamRole,
                        Collectors.mapping(DocumentFolderPermission::getPermission, Collectors.toList())
                ));

        List<FolderPermissionRequest> result = new ArrayList<>();
        for (TeamRole role : List.of(TeamRole.ADMIN, TeamRole.MEMBER, TeamRole.VIEWER)) {
            List<String> perms = permissionsByRole.getOrDefault(role, List.of());
            result.add(new FolderPermissionRequest(role.name(), perms));
        }
        return result;
    }

    private DocumentFolderResponseDTO mapFolder(DocumentFolder folder) {
        return DocumentFolderResponseDTO.builder()
                .id(folder.getId())
                .name(folder.getName())
                .projectId(folder.getProject().getId())
                .parentFolderId(folder.getParentFolder() != null ? folder.getParentFolder().getId() : null)
                .createdById(folder.getCreatedBy().getUserId())
                .createdAt(folder.getCreatedAt())
                .updatedAt(folder.getUpdatedAt())
                .build();
    }
}
