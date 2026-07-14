package com.planora.backend.dto;

import jakarta.validation.constraints.NotNull;

public record MobileGithubOAuthStartRequest(
        @NotNull Destination destination,
        Long projectId) {
    public enum Destination {
        PROFILE, PROJECT
    }
}
