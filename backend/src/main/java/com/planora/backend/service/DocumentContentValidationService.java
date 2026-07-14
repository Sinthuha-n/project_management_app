package com.planora.backend.service;

import com.planora.backend.exception.DocumentUploadException;
import org.apache.tika.Tika;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipInputStream;

@Service
public class DocumentContentValidationService {
    private static final int MAX_ARCHIVE_ENTRIES = 10_000;
    private static final long MAX_ARCHIVE_EXPANDED_BYTES = 1024L * 1024 * 1024;
    private static final Set<String> ZIP_EXTENSIONS = Set.of("zip", "docx", "docm", "pptx", "pptm", "xlsx", "xlsm", "odt", "ods", "odp", "epub", "vsdx");

    private final S3StorageService storage;
    private final DocumentFileTypeRegistry registry;
    private final Tika tika = new Tika();

    public DocumentContentValidationService(S3StorageService storage, DocumentFileTypeRegistry registry) {
        this.storage = storage;
        this.registry = registry;
    }

    public String validate(String bucket, String objectKey, String fileName) {
        String detected;
        try (InputStream input = storage.getObjectStream(bucket, objectKey)) {
            detected = tika.detect(input, fileName);
        } catch (IOException ex) {
            throw new DocumentUploadException("STORAGE_UPLOAD_FAILED", "Could not inspect the uploaded file.", HttpStatus.BAD_GATEWAY);
        }
        if (!registry.detectedTypeMatches(fileName, detected)) {
            throw new DocumentUploadException("CONTENT_TYPE_MISMATCH",
                    "The file contents do not match its extension.", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (ZIP_EXTENSIONS.contains(registry.extensionOf(fileName))) inspectZip(bucket, objectKey);
        return detected;
    }

    private void inspectZip(String bucket, String objectKey) {
        int entries = 0;
        long expandedBytes = 0;
        byte[] buffer = new byte[8192];
        try (ZipInputStream zip = new ZipInputStream(storage.getObjectStream(bucket, objectKey))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > MAX_ARCHIVE_ENTRIES) throw archiveLimit();
                int read;
                while ((read = zip.read(buffer)) >= 0) {
                    expandedBytes += read;
                    if (expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) throw archiveLimit();
                }
            }
        } catch (DocumentUploadException ex) {
            throw ex;
        } catch (ZipException ex) {
            throw new DocumentUploadException("ENCRYPTED_ARCHIVE",
                    "Encrypted or unreadable archives are not supported.", HttpStatus.UNPROCESSABLE_ENTITY);
        } catch (IOException ex) {
            throw new DocumentUploadException("ARCHIVE_LIMIT_EXCEEDED",
                    "The archive could not be safely inspected.", HttpStatus.UNPROCESSABLE_ENTITY);
        }
    }

    private DocumentUploadException archiveLimit() {
        return new DocumentUploadException("ARCHIVE_LIMIT_EXCEEDED",
                "The archive exceeds safe extraction limits.", HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
