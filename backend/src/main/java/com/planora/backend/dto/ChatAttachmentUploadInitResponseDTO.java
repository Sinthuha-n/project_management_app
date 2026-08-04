package com.planora.backend.dto;

public record ChatAttachmentUploadInitResponseDTO(
        String uploadUrl,
        String objectKey,
        String contentType,
        long expiresInSeconds
) {
}
