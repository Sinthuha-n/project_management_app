package com.planora.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ChatAttachmentUploadFinalizeRequestDTO(
        @NotBlank String objectKey,
        @NotBlank String fileName,
        String contentType,
        @NotNull @Positive Long fileSize
) {
}
