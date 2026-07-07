package com.planora.backend.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.planora.backend.model.TaskAccess;

import java.util.List;

@Repository
public interface TaskAccessRepository extends JpaRepository<TaskAccess, Long> {
    /**
     * Atomically records a task view. PostgreSQL serializes concurrent conflicts on
     * the (task_id, user_id) constraint, so a second viewer updates the existing
     * row instead of surfacing a unique-constraint violation.
     */
    @Modifying
    @Query(value = """
            INSERT INTO task_access (task_id, user_id, last_accessed_at)
            VALUES (:taskId, :userId, CURRENT_TIMESTAMP)
            ON CONFLICT (task_id, user_id)
            DO UPDATE SET last_accessed_at = EXCLUDED.last_accessed_at
            """, nativeQuery = true)
    void upsertTaskAccess(@Param("taskId") Long taskId, @Param("userId") Long userId);
    
    // For "Recent Tasks" endpoints
    @EntityGraph(attributePaths = {
            "task",
            "task.project",
            "task.project.team",
            "task.assignee",
            "task.assignee.user",
            "task.reporter",
            "task.reporter.user",
            "task.sprint",
            "task.milestone"
    })
    List<TaskAccess> findByUserUserIdOrderByLastAccessedAtDesc(Long userId, Pageable pageable);

    @Query("SELECT ta.task.id FROM TaskAccess ta WHERE ta.user.userId = :userId ORDER BY ta.lastAccessedAt DESC")
    List<Long> findRecentTaskIdsByUser(@Param("userId") Long userId, Pageable pageable);
}
