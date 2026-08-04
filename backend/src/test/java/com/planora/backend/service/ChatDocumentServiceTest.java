package com.planora.backend.service;

import com.planora.backend.dto.ChatAttachmentUploadFinalizeRequestDTO;
import com.planora.backend.dto.ChatAttachmentUploadInitRequestDTO;
import com.planora.backend.exception.DocumentUploadException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

import java.io.InputStream;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatDocumentServiceTest {
    @Mock
    private S3StorageService storage;

    private ChatDocumentService service;

    @BeforeEach
    void setUp() {
        service = new ChatDocumentService(storage, new WorkAttachmentPolicy());
        ReflectionTestUtils.setField(service, "chatBucket", "chat-bucket");
    }

    @Test
    void multipartUploadUsesNumericIdentityAndSafeFilename() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "Quarterly Résumé 2026.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[]{1, 2, 3});
        when(storage.generatePresignedDownloadUrl(eq("chat-bucket"), anyString(), any(Duration.class)))
                .thenReturn("https://download.example/file");

        String result = service.uploadChatDocument(file, 3L, 17L);

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(storage).putObject(
                eq("chat-bucket"),
                key.capture(),
                eq("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                any(InputStream.class),
                eq(3L));
        assertTrue(key.getValue().matches(
                "project-3/user-17/[0-9a-f-]+-Quarterly_R_sum_2026\\.xlsx"));
        assertEquals("https://download.example/file", result);
    }

    @Test
    void finalizeValidatesOwnershipAndStoredMetadataAndIsIdempotent() {
        String key = "project-3/user-17/8dd136b6-4a04-45d6-993f-710a87bc753c-report.pdf";
        var request = new ChatAttachmentUploadFinalizeRequestDTO(
                key, "report.pdf", "application/pdf", 512L);
        when(storage.headObject("chat-bucket", key)).thenReturn(
                HeadObjectResponse.builder()
                        .contentType("application/pdf")
                        .contentLength(512L)
                        .build());
        when(storage.generatePresignedDownloadUrl(eq("chat-bucket"), eq(key), any(Duration.class)))
                .thenReturn("https://download.example/one", "https://download.example/two");

        assertEquals("https://download.example/one", service.finalizeUpload(3L, 17L, request).downloadUrl());
        assertEquals("https://download.example/two", service.finalizeUpload(3L, 17L, request).downloadUrl());
        verify(storage, times(2)).headObject("chat-bucket", key);
    }

    @Test
    void finalizeRejectsAnotherUsersKeyAndMetadataMismatch() {
        String foreignKey = "project-3/user-99/8dd136b6-4a04-45d6-993f-710a87bc753c-report.pdf";
        DocumentUploadException ownership = assertThrows(
                DocumentUploadException.class,
                () -> service.finalizeUpload(3L, 17L, new ChatAttachmentUploadFinalizeRequestDTO(
                        foreignKey, "report.pdf", "application/pdf", 512L)));

        String ownedKey = "project-3/user-17/8dd136b6-4a04-45d6-993f-710a87bc753c-report.pdf";
        when(storage.headObject("chat-bucket", ownedKey)).thenReturn(
                HeadObjectResponse.builder()
                        .contentType("application/pdf")
                        .contentLength(513L)
                        .build());
        DocumentUploadException metadata = assertThrows(
                DocumentUploadException.class,
                () -> service.finalizeUpload(3L, 17L, new ChatAttachmentUploadFinalizeRequestDTO(
                        ownedKey, "report.pdf", "application/pdf", 512L)));

        assertEquals("INVALID_OBJECT_KEY", ownership.getErrorCode());
        assertEquals("UPLOAD_METADATA_MISMATCH", metadata.getErrorCode());
    }

    @Test
    void refreshAllowsProjectOwnedNewAndLegacyKeysButRejectsCrossProjectKeys() {
        when(storage.generatePresignedDownloadUrl(eq("chat-bucket"), anyString(), any(Duration.class)))
                .thenReturn("https://download.example/fresh");

        assertEquals(
                "https://download.example/fresh",
                service.refreshPresignedUrl(
                        "https://chat-bucket.s3.eu-west-1.amazonaws.com/project-3/user-17/key-report.pdf?signature=x",
                        3L));
        assertEquals(
                "https://download.example/fresh",
                service.refreshPresignedUrl(
                        "https://chat-bucket.s3.eu-west-1.amazonaws.com/3/alice%40example.com/key-report.pdf?signature=x",
                        3L));

        DocumentUploadException exception = assertThrows(
                DocumentUploadException.class,
                () -> service.refreshPresignedUrl(
                        "https://chat-bucket.s3.eu-west-1.amazonaws.com/project-4/user-17/key-report.pdf",
                        3L));
        assertEquals("ATTACHMENT_ACCESS_DENIED", exception.getErrorCode());
    }
}
