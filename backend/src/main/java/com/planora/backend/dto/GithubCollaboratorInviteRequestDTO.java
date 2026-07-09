package com.planora.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GithubCollaboratorInviteRequestDTO {

    @NotBlank(message = "GitHub username or email is required")
    @Size(max = 255, message = "Identifier must be 255 characters or fewer")
    private String identifier;

    @Pattern(regexp = "^(pull|triage|push|maintain)$", message = "Permission must be pull, triage, push, or maintain")
    private String permission = "push";
}
