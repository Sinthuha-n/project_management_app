package com.planora.backend.repository;

import com.planora.backend.model.GithubIntegration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GithubIntegrationRepository extends JpaRepository<GithubIntegration, Long> {

    List<GithubIntegration> findByProjectIdAndActiveTrue(Long projectId);

    Optional<GithubIntegration> findByIdAndProjectId(Long id, Long projectId);

    Optional<GithubIntegration> findByProjectIdAndRepositoryFullName(Long projectId, String repositoryFullName);

    boolean existsByProjectIdAndRepositoryFullName(Long projectId, String repositoryFullName);

    List<GithubIntegration> findAllByActiveTrue();
}
