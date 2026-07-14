package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@NoArgsConstructor
@Table(name = "document_upload_reservations", indexes = {
        @Index(name = "idx_upload_reservation_project_status_expiry", columnList = "project_id,status,expires_at"),
        @Index(name = "idx_upload_reservation_batch", columnList = "batch_id")
})
public class DocumentUploadReservation {
    @Id
    @Column(name = "upload_id", length = 36)
    private String uploadId;

    @Column(name = "batch_id", nullable = false, length = 36)
    private String batchId;

    @Column(name = "client_id", nullable = false, length = 100)
    private String clientId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id")
    private DocumentFolder folder;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", unique = true)
    private Document document;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "object_key", nullable = false, unique = true, length = 500)
    private String objectKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DocumentUploadStatus status;

    @Column(name = "error_code", length = 60)
    private String errorCode;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "finalized_at")
    private LocalDateTime finalizedAt;
}
