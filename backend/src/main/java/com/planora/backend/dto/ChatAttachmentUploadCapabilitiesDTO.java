package com.planora.backend.dto;

import java.util.List;
import java.util.Map;

public record ChatAttachmentUploadCapabilitiesDTO(
        long maxFileSizeBytes,
        List<String> allowedExtensions,
        Map<String, List<String>> mimeTypesByExtension,
        boolean directUploadEnabled
) {
}
