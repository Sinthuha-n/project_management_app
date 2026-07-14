package com.planora.backend.repository;

import com.planora.backend.model.Document;
import com.planora.backend.model.DocumentStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    @EntityGraph(attributePaths = {"uploadedBy"})
    List<Document> findByProjectIdAndStatusOrderByCreatedAtDesc(Long projectId, DocumentStatus status);

    @EntityGraph(attributePaths = {"uploadedBy"})
    List<Document> findByProjectIdOrderByCreatedAtDesc(Long projectId);

    @EntityGraph(attributePaths = {"uploadedBy"})
    List<Document> findByProjectIdAndFolderIdAndStatusOrderByCreatedAtDesc(Long projectId, Long folderId, DocumentStatus status);

    @EntityGraph(attributePaths = {"uploadedBy"})
    List<Document> findByProjectIdAndFolderIdOrderByCreatedAtDesc(Long projectId, Long folderId);

    Optional<Document> findByIdAndProjectId(Long id, Long projectId);

    long countByFolderIdAndStatus(Long folderId, DocumentStatus status);

    List<Document> findByFolderIdAndStatus(Long folderId, DocumentStatus status);

    @Query("SELECT COALESCE(SUM(d.fileSize), 0) FROM Document d WHERE d.project.id = :projectId")
    long sumFileSizeByProjectId(@Param("projectId") Long projectId);

    long countByProjectIdAndStatus(Long projectId, DocumentStatus status);

    @Query("SELECT d FROM Document d WHERE d.status = :status " +
            "AND d.deletedAt IS NOT NULL " +
            "AND d.deletedAt < :cutoff")
    List<Document> findExpiredSoftDeleted(
            @Param("status") DocumentStatus status,
            @Param("cutoff") LocalDateTime cutoff);
}
