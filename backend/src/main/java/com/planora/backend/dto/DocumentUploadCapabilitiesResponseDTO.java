package com.planora.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class DocumentUploadCapabilitiesResponseDTO {
    private Boolean multiUploadEnabled;
    private List<String> acceptedExtensions;
    private Map<String, List<String>> mimeTypesByExtension;
    private Long maxFileSizeBytes;
    private Integer maxBatchFiles;
    private Long maxBatchSizeBytes;
    private Integer recommendedConcurrency;
}
