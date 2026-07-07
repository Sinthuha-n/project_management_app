package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class GithubCollaboratorInviteResponseDTO {
    private Long projectId;
    private Long integrationId;
    private String repositoryFullName;
    private String githubUsername;
    private String permission;
    private int githubStatus;
    private String status;
    private String message;
}
