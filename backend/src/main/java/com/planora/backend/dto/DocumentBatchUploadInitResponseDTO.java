package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentBatchUploadInitResponseDTO {
    private String batchId;
    private LocalDateTime expiresAt;
    private List<FileResult> files;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FileResult {
        private String clientId;
        private boolean accepted;
        private String uploadId;
        private String uploadUrl;
        private String objectKey;
        private String contentType;
        private Long expiresInSeconds;
        private String errorCode;
        private String message;
    }
}
