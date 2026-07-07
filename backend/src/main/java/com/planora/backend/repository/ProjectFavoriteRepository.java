package com.planora.backend.repository;

import com.planora.backend.model.ProjectFavorite;
import com.planora.backend.model.Project;
import com.planora.backend.model.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ProjectFavoriteRepository extends JpaRepository<ProjectFavorite, Long> {
    Optional<ProjectFavorite> findByUserAndProject(User user, Project project);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"project.owner", "project.team"})
    List<ProjectFavorite> findByUserOrderByCreatedAtDesc(User user);  // most recently favourited first
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"project.owner", "project.team"})
    @Query("""
            SELECT pf
            FROM ProjectFavorite pf
            JOIN pf.project p
            JOIN p.team t
            JOIN TeamMember tm ON tm.team = t AND tm.user.userId = :userId
            WHERE pf.user.userId = :userId
            ORDER BY pf.createdAt DESC
            """)
    List<ProjectFavorite> findAccessibleFavoritesForUser(@Param("userId") Long userId, Pageable pageable);
    boolean existsByUserAndProject(User user, Project project);
    void deleteByUserAndProject(User user, Project project);
    void deleteByProject(Project project);
}
