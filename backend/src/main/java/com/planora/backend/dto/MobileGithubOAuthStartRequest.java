package com.planora.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record MobileGithubOAuthStartRequest(
        @NotNull Destination destination,
        Long projectId,
        @Size(max = 39, message = "GitHub login hint must be 39 characters or fewer")
        @Pattern(regexp = "^$|^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$",
                message = "GitHub login hint is invalid")
        String loginHint) {
    public enum Destination {
        PROFILE, PROJECT
    }
}
