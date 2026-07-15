package com.planora.backend.repository;

import com.planora.backend.model.DocumentUploadReservation;
import com.planora.backend.model.DocumentUploadStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface DocumentUploadReservationRepository extends JpaRepository<DocumentUploadReservation, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM DocumentUploadReservation r WHERE r.uploadId = :uploadId")
    Optional<DocumentUploadReservation> findByUploadIdWithLock(@Param("uploadId") String uploadId);

    @Query("SELECT COALESCE(SUM(r.fileSize), 0) FROM DocumentUploadReservation r " +
            "WHERE r.project.id = :projectId AND r.status IN :statuses AND r.expiresAt > :now")
    long sumActiveReservedBytes(@Param("projectId") Long projectId,
                                @Param("statuses") List<DocumentUploadStatus> statuses,
                                @Param("now") LocalDateTime now);

    List<DocumentUploadReservation> findByStatusInAndExpiresAtBefore(
            List<DocumentUploadStatus> statuses, LocalDateTime cutoff);
}
