package com.planora.backend.service;

import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class DocumentFileTypeRegistry {
    public static final long MAX_FILE_SIZE_BYTES = 100L * 1024 * 1024;
    public static final int MAX_BATCH_FILES = 25;
    public static final long MAX_BATCH_SIZE_BYTES = 500L * 1024 * 1024;
    public static final int RECOMMENDED_CONCURRENCY = 3;

    private final Map<String, LinkedHashSet<String>> types = new LinkedHashMap<>();

    public DocumentFileTypeRegistry() {
        add("pdf", "application/pdf");
        add("doc", "application/msword");
        add("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip");
        add("docm", "application/vnd.ms-word.document.macroenabled.12", "application/zip");
        add("rtf", "application/rtf", "text/rtf"); add("odt", "application/vnd.oasis.opendocument.text", "application/zip");
        add("ppt", "application/vnd.ms-powerpoint"); add("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip");
        add("pptm", "application/vnd.ms-powerpoint.presentation.macroenabled.12", "application/zip"); add("odp", "application/vnd.oasis.opendocument.presentation", "application/zip");
        add("xls", "application/vnd.ms-excel"); add("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip");
        add("xlsm", "application/vnd.ms-excel.sheet.macroenabled.12", "application/zip"); add("xlsb", "application/vnd.ms-excel.sheet.binary.macroenabled.12");
        add("ods", "application/vnd.oasis.opendocument.spreadsheet", "application/zip"); add("csv", "text/csv", "text/plain"); add("tsv", "text/tab-separated-values", "text/plain");
        add("json", "application/json", "text/plain"); add("xml", "application/xml", "text/xml", "text/plain");
        add("yaml", "application/yaml", "text/yaml", "text/plain"); add("yml", "application/yaml", "text/yaml", "text/plain"); add("parquet", "application/vnd.apache.parquet", "application/octet-stream");
        add("txt", "text/plain"); add("md", "text/markdown", "text/plain"); add("log", "text/plain"); add("tex", "application/x-tex", "text/plain"); add("epub", "application/epub+zip", "application/zip");
        add("jpg", "image/jpeg"); add("jpeg", "image/jpeg"); add("png", "image/png"); add("gif", "image/gif"); add("webp", "image/webp");
        add("bmp", "image/bmp", "image/x-ms-bmp"); add("tif", "image/tiff"); add("tiff", "image/tiff"); add("heic", "image/heic", "image/heif");
        add("svg", "image/svg+xml", "text/xml"); add("psd", "image/vnd.adobe.photoshop", "application/octet-stream");
        add("ai", "application/postscript", "application/pdf"); add("eps", "application/postscript");
        add("dwg", "image/vnd.dwg", "application/acad", "application/octet-stream"); add("dxf", "image/vnd.dxf", "application/dxf", "text/plain");
        add("step", "model/step", "application/step", "text/plain"); add("stp", "model/step", "application/step", "text/plain");
        add("iges", "model/iges", "application/iges", "text/plain"); add("igs", "model/iges", "application/iges", "text/plain"); add("stl", "model/stl", "application/sla", "text/plain", "application/octet-stream");
        add("mp3", "audio/mpeg"); add("wav", "audio/wav", "audio/x-wav"); add("m4a", "audio/mp4", "audio/x-m4a"); add("ogg", "audio/ogg", "application/ogg");
        add("mp4", "video/mp4"); add("mov", "video/quicktime"); add("avi", "video/x-msvideo"); add("webm", "video/webm");
        add("zip", "application/zip", "application/x-zip-compressed"); add("7z", "application/x-7z-compressed"); add("rar", "application/vnd.rar", "application/x-rar-compressed");
        add("tar", "application/x-tar"); add("gz", "application/gzip", "application/x-gzip"); add("tgz", "application/gzip", "application/x-gzip");
        add("eml", "message/rfc822", "text/plain"); add("msg", "application/vnd.ms-outlook", "application/x-tika-msoffice");
        add("mpp", "application/vnd.ms-project", "application/x-tika-msoffice"); add("vsd", "application/vnd.visio", "application/x-tika-msoffice");
        add("vsdx", "application/vnd.ms-visio.drawing", "application/zip");
    }

    private void add(String extension, String... mimeTypes) {
        types.put(extension, new LinkedHashSet<>(Arrays.stream(mimeTypes).map(String::toLowerCase).toList()));
    }

    public String extensionOf(String fileName) {
        if (fileName == null) return "";
        String normalized = fileName.replace('\\', '/');
        normalized = normalized.substring(normalized.lastIndexOf('/') + 1);
        int dot = normalized.lastIndexOf('.');
        return dot < 0 || dot == normalized.length() - 1 ? "" : normalized.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public boolean supports(String fileName) { return types.containsKey(extensionOf(fileName)); }

    public String normalizeContentType(String fileName, String declared) {
        Set<String> aliases = types.get(extensionOf(fileName));
        if (aliases == null) return null;
        String value = declared == null ? "" : declared.trim().toLowerCase(Locale.ROOT);
        if (value.isBlank() || value.equals("application/octet-stream")) return aliases.iterator().next();
        return aliases.contains(value) ? aliases.iterator().next() : null;
    }

    public boolean detectedTypeMatches(String fileName, String detected) {
        Set<String> aliases = types.get(extensionOf(fileName));
        if (aliases == null || detected == null) return false;
        String value = detected.toLowerCase(Locale.ROOT);
        return aliases.contains(value) || (value.equals("application/octet-stream") && aliases.contains(value));
    }

    public List<String> extensions() { return List.copyOf(types.keySet()); }
    public Map<String, List<String>> mimeTypes() {
        Map<String, List<String>> result = new LinkedHashMap<>();
        types.forEach((key, value) -> result.put(key, List.copyOf(value)));
        return result;
    }
    public Set<String> allMimeTypes() { return types.values().stream().flatMap(Collection::stream).collect(java.util.stream.Collectors.toUnmodifiableSet()); }
}
