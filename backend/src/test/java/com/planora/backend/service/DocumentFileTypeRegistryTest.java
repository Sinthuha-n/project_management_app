package com.planora.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DocumentFileTypeRegistryTest {
    private final DocumentFileTypeRegistry registry = new DocumentFileTypeRegistry();

    @Test
    void supportsEveryPublishedBusinessExtension() {
        List<String> expected = List.of("pdf", "doc", "docx", "docm", "rtf", "odt", "ppt", "pptx", "pptm", "odp",
                "xls", "xlsx", "xlsm", "xlsb", "ods", "csv", "tsv", "json", "xml", "yaml", "yml", "parquet",
                "txt", "md", "log", "tex", "epub", "jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff",
                "heic", "svg", "psd", "ai", "eps", "dwg", "dxf", "step", "stp", "iges", "igs", "stl", "mp3",
                "wav", "m4a", "ogg", "mp4", "mov", "avi", "webm", "zip", "7z", "rar", "tar", "gz", "tgz",
                "eml", "msg", "mpp", "vsd", "vsdx");
        assertTrue(expected.stream().allMatch(extension -> registry.supports("file." + extension)));
    }

    @Test
    void blocksExecutablesInstallersScriptsAndUnknownFiles() {
        List<String> blocked = List.of("exe", "dll", "msi", "dmg", "pkg", "apk", "bat", "cmd", "ps1", "sh", "unknown");
        assertTrue(blocked.stream().noneMatch(extension -> registry.supports("file." + extension)));
    }

    @Test
    void normalizesBrowserGenericMimeButRejectsConflictingMime() {
        assertEquals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                registry.normalizeContentType("report.xlsx", "application/octet-stream"));
        assertNull(registry.normalizeContentType("report.xlsx", "image/png"));
    }
}
