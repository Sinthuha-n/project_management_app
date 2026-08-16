package com.planora.backend.controller;

import com.planora.backend.dto.ProjectInviteRequest;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.ProjectInvitationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectInvitationController {

    private final ProjectInvitationService projectInvitationService;

    @PostMapping("/{projectId}/invitations")
    public ResponseEntity<?> inviteToProject(
            @PathVariable Long projectId,
            @Valid @RequestBody ProjectInviteRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User is not authenticated");
        }
        projectInvitationService.inviteToProject(projectId, request, principal.getUserId());
        return ResponseEntity.ok("Invitation email sent");
    }

    @PostMapping("/invitations/accept")
    public ResponseEntity<?> acceptInvitation(
            @RequestBody java.util.Map<String, String> request,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User is not authenticated");
        }
        String token = request.get("token");
        projectInvitationService.acceptInvitation(token, principal.getUserId());
        return ResponseEntity.ok("Invitation accepted successfully");
    }
}