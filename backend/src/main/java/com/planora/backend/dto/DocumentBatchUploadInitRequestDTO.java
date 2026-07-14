package com.planora.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class DocumentBatchUploadInitRequestDTO {
    @Positive(message = "Folder ID must be positive")
    private Long folderId;

    @NotEmpty(message = "At least one file is required")
    @Size(max = 25, message = "A batch can contain at most 25 files")
    private List<@Valid FileItem> files;

    @Data
    public static class FileItem {
        @NotBlank(message = "clientId is required")
        @Size(max = 100)
        private String clientId;

        @NotBlank(message = "fileName is required")
        @Size(max = 255)
        private String fileName;

        @NotBlank(message = "contentType is required")
        @Size(max = 255)
        private String contentType;

        @NotNull(message = "fileSize is required")
        @Min(value = 1, message = "fileSize must be > 0")
        private Long fileSize;
    }
}
