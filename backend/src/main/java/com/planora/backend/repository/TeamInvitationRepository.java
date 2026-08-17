package com.planora.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.planora.backend.model.TeamInvitation;

import jakarta.persistence.LockModeType;

public interface TeamInvitationRepository extends JpaRepository<TeamInvitation, Long> {
    java.util.List<TeamInvitation> findByTeamIdAndEmail(Long teamId, String email);

    @EntityGraph(attributePaths = {"team.projects"})
    Optional<TeamInvitation> findByToken(String token);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"team.projects"})
    @Query("select invitation from TeamInvitation invitation where invitation.token = :token")
    Optional<TeamInvitation> findByTokenWithLock(@Param("token") String token);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"team.projects"})
    @Query("select invitation from TeamInvitation invitation where invitation.token = :token or invitation.token = :hashedToken")
    Optional<TeamInvitation> findByTokenOrHashedTokenWithLock(@Param("token") String token, @Param("hashedToken") String hashedToken);

    java.util.List<TeamInvitation> findByTeamIdAndStatus(Long teamId, String status);
}
