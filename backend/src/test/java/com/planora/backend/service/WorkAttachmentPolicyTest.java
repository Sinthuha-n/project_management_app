package com.planora.backend.service;

import com.planora.backend.exception.DocumentUploadException;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorkAttachmentPolicyTest {
    private final WorkAttachmentPolicy policy = new WorkAttachmentPolicy();

    @Test
    void acceptsEveryPublishedExtensionAndCanonicalMimePair() {
        for (Map.Entry<String, java.util.List<String>> entry : policy.mimeTypes().entrySet()) {
            String canonicalMime = entry.getValue().stream()
                    .filter(value -> !value.equals("application/octet-stream") && !value.equals("application/zip"))
                    .findFirst()
                    .orElseThrow();

            var result = policy.validate("work file." + entry.getKey(), canonicalMime, 42L);

            assertEquals(canonicalMime, result.contentType());
            assertEquals(entry.getKey(), result.extension());
        }
    }

    @Test
    void normalizesGenericMimeAndSanitizesPathsSpacesAndUnicode() {
        var result = policy.validate(
                "../../Quarterly Résumé 2026.xlsx",
                "application/octet-stream",
                1_024L);

        assertEquals("Quarterly_R_sum_2026.xlsx", result.safeFileName());
        assertEquals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", result.contentType());
        assertFalse(result.safeFileName().contains("/"));
    }

    @Test
    void rejectsExecutableAndMismatchedMimeWithStableCode() {
        DocumentUploadException executable = assertThrows(
                DocumentUploadException.class,
                () -> policy.validate("installer.exe", "application/octet-stream", 100L));
        DocumentUploadException mismatch = assertThrows(
                DocumentUploadException.class,
                () -> policy.validate("report.pdf", "image/png", 100L));

        assertEquals("UNSUPPORTED_FILE_TYPE", executable.getErrorCode());
        assertEquals("UNSUPPORTED_FILE_TYPE", mismatch.getErrorCode());
    }

    @Test
    void rejectsEmptyAndOversizedFilesWithStableCodes() {
        DocumentUploadException empty = assertThrows(
                DocumentUploadException.class,
                () -> policy.validate("report.pdf", "application/pdf", 0L));
        DocumentUploadException oversized = assertThrows(
                DocumentUploadException.class,
                () -> policy.validate(
                        "report.pdf",
                        "application/pdf",
                        WorkAttachmentPolicy.MAX_FILE_SIZE_BYTES + 1));

        assertEquals("INVALID_FILE_SIZE", empty.getErrorCode());
        assertEquals("FILE_TOO_LARGE", oversized.getErrorCode());
        assertTrue(oversized.getStatus().is4xxClientError());
    }
}
