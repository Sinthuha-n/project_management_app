package com.planora.backend.service;

import com.planora.backend.exception.DocumentUploadException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Canonical policy for user-facing work attachments shared by chat and tasks.
 */
@Component
public class WorkAttachmentPolicy {
    public static final long MAX_FILE_SIZE_BYTES = 25L * 1024 * 1024;
    private static final int MAX_SAFE_FILE_NAME_LENGTH = 140;

    private final Map<String, LinkedHashSet<String>> mimeTypesByExtension = new LinkedHashMap<>();

    public WorkAttachmentPolicy() {
        add("pdf", "application/pdf");
        add("txt", "text/plain");
        add("doc", "application/msword", "application/octet-stream");
        add("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/zip", "application/octet-stream");
        add("xls", "application/vnd.ms-excel", "application/octet-stream");
        add("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/zip", "application/octet-stream");
        add("jpg", "image/jpeg");
        add("jpeg", "image/jpeg");
        add("png", "image/png");
        add("gif", "image/gif");
        add("webp", "image/webp");
    }

    private void add(String extension, String... mimeTypes) {
        mimeTypesByExtension.put(extension,
                new LinkedHashSet<>(Arrays.stream(mimeTypes).map(value -> value.toLowerCase(Locale.ROOT)).toList()));
    }

    public ValidatedAttachment validate(String fileName, String declaredContentType, Long fileSize) {
        if (fileName == null || fileName.isBlank()) {
            throw error("INVALID_FILE_NAME", "A file name is required.", HttpStatus.BAD_REQUEST);
        }
        if (fileSize == null || fileSize <= 0) {
            throw error("INVALID_FILE_SIZE", "The file is empty.", HttpStatus.BAD_REQUEST);
        }
        if (fileSize > MAX_FILE_SIZE_BYTES) {
            throw error("FILE_TOO_LARGE", "Files must be 25 MB or smaller.", HttpStatus.PAYLOAD_TOO_LARGE);
        }

        String extension = extensionOf(fileName);
        Set<String> aliases = mimeTypesByExtension.get(extension);
        if (aliases == null) {
            throw error("UNSUPPORTED_FILE_TYPE", "This file type is not supported.", HttpStatus.BAD_REQUEST);
        }

        String normalizedType = normalizeContentType(extension, declaredContentType, aliases);
        if (normalizedType == null) {
            throw error("UNSUPPORTED_FILE_TYPE",
                    "The file extension and content type do not match.", HttpStatus.BAD_REQUEST);
        }

        return new ValidatedAttachment(sanitizeFileName(fileName, extension), extension, normalizedType, fileSize);
    }

    public String normalizeStoredContentType(String fileName, String contentType) {
        String extension = extensionOf(fileName);
        Set<String> aliases = mimeTypesByExtension.get(extension);
        if (aliases == null) return null;
        return normalizeContentType(extension, contentType, aliases);
    }

    public List<String> extensions() {
        return List.copyOf(mimeTypesByExtension.keySet());
    }

    public Map<String, List<String>> mimeTypes() {
        Map<String, List<String>> result = new LinkedHashMap<>();
        mimeTypesByExtension.forEach((extension, aliases) -> result.put(extension, List.copyOf(aliases)));
        return result;
    }

    private String normalizeContentType(String extension, String declaredContentType, Set<String> aliases) {
        String value = declaredContentType == null ? "" : declaredContentType.trim().toLowerCase(Locale.ROOT);
        if (value.isBlank() || "application/octet-stream".equals(value)) {
            return canonicalContentType(extension);
        }
        return aliases.contains(value) ? canonicalContentType(extension) : null;
    }

    private String canonicalContentType(String extension) {
        return mimeTypesByExtension.get(extension).stream()
                .filter(value -> !"application/octet-stream".equals(value) && !"application/zip".equals(value))
                .findFirst()
                .orElseThrow();
    }

    private String extensionOf(String fileName) {
        String name = baseName(fileName);
        int dot = name.lastIndexOf('.');
        return dot < 0 || dot == name.length() - 1
                ? ""
                : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private String sanitizeFileName(String fileName, String extension) {
        String normalized = Normalizer.normalize(baseName(fileName).trim(), Normalizer.Form.NFKC);
        int dot = normalized.lastIndexOf('.');
        String stem = dot > 0 ? normalized.substring(0, dot) : normalized;
        stem = stem.replaceAll("[^A-Za-z0-9_-]+", "_")
                .replaceAll("_+", "_")
                .replaceAll("^[_-]+|[_-]+$", "");
        if (stem.isBlank()) stem = "upload";

        int maximumStemLength = Math.max(1, MAX_SAFE_FILE_NAME_LENGTH - extension.length() - 1);
        if (stem.length() > maximumStemLength) stem = stem.substring(0, maximumStemLength);
        return stem + "." + extension;
    }

    private String baseName(String fileName) {
        String normalized = fileName.replace('\\', '/');
        return normalized.substring(normalized.lastIndexOf('/') + 1);
    }

    private DocumentUploadException error(String code, String message, HttpStatus status) {
        return new DocumentUploadException(code, message, status);
    }

    public record ValidatedAttachment(String safeFileName,
                                      String extension,
                                      String contentType,
                                      long fileSize) {
    }
}
