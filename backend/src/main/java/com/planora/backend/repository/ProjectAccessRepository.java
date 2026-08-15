package com.planora.backend.repository;

import com.planora.backend.model.ProjectAccess;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectAccessRepository extends JpaRepository<ProjectAccess, Long> {
    Optional<ProjectAccess> findByProject_IdAndUser_UserId(Long projectId, Long userId);

    void deleteByProject_Id(Long projectId);

    // Returns the N most recently accessed projects for a user, newest first
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"project.team"})
    List<ProjectAccess> findByUser_UserIdOrderByLastAccessedAtDesc(Long userId, Pageable pageable);

    @Modifying(clearAutomatically = true)
    @Query(value = """
            INSERT INTO project_access (project_id, user_id, last_accessed_at)
            VALUES (:projectId, :userId, CURRENT_TIMESTAMP)
            ON CONFLICT (project_id, user_id)
            DO UPDATE SET last_accessed_at = EXCLUDED.last_accessed_at
            WHERE project_access.last_accessed_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
            """, nativeQuery = true)
    int upsertThrottledAccess(@Param("projectId") Long projectId, @Param("userId") Long userId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"project.owner", "project.team"})
    @Query("""
            SELECT pa
            FROM ProjectAccess pa
            JOIN pa.project p
            JOIN p.team t
            JOIN TeamMember tm ON tm.team = t AND tm.user.userId = :userId
            WHERE pa.user.userId = :userId
            ORDER BY pa.lastAccessedAt DESC
            """)
    List<ProjectAccess> findAccessibleRecentForUser(@Param("userId") Long userId, Pageable pageable);
}
