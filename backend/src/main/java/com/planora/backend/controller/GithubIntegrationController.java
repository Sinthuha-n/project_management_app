package com.planora.backend.controller;

import com.planora.backend.dto.GithubCollaboratorInviteRequestDTO;
import com.planora.backend.dto.GithubCollaboratorInviteResponseDTO;
import com.planora.backend.dto.GithubLinkRequestDTO;
import com.planora.backend.dto.ProjectGithubRepositoryDTO;
import com.planora.backend.exception.GithubAuthenticationException;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.ProjectGithubIntegrationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/github")
@RequiredArgsConstructor
public class GithubIntegrationController {

    private final ProjectGithubIntegrationService integrationService;

    @PostMapping("/link")
    public ResponseEntity<ProjectGithubRepositoryDTO> linkRepository(
            @Valid @RequestBody GithubLinkRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {

        if (principal == null) {
            throw new GithubAuthenticationException("Authentication is required");
        }
        ProjectGithubRepositoryDTO result = integrationService.linkRepository(request, principal.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @DeleteMapping("/link/{integrationId}")
    public ResponseEntity<Void> unlinkRepository(
            @PathVariable Long integrationId,
            @RequestParam Long projectId,
            @AuthenticationPrincipal UserPrincipal principal) {

        if (principal == null) {
            throw new GithubAuthenticationException("Authentication is required");
        }
        integrationService.unlinkRepository(integrationId, projectId, principal.getUserId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/project/{projectId}/repos")
    public ResponseEntity<List<ProjectGithubRepositoryDTO>> getLinkedRepositories(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal principal) {

        if (principal == null) {
            throw new GithubAuthenticationException("Authentication is required");
        }
        List<ProjectGithubRepositoryDTO> repos = integrationService.getLinkedRepositories(projectId, principal.getUserId());
        return ResponseEntity.ok(repos);
    }

    @PostMapping("/project/{projectId}/collaborators")
    public ResponseEntity<GithubCollaboratorInviteResponseDTO> inviteCollaborator(
            @PathVariable Long projectId,
            @Valid @RequestBody GithubCollaboratorInviteRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {

        if (principal == null) {
            throw new GithubAuthenticationException("Authentication is required");
        }
        GithubCollaboratorInviteResponseDTO result = integrationService.inviteCollaborator(projectId, request, principal.getUserId());
        HttpStatus status = result.getGithubStatus() == 201 ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(result);
    }
}
