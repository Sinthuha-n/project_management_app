package com.planora.backend.service;

import com.planora.backend.dto.DocumentBatchUploadInitRequestDTO;
import com.planora.backend.dto.DocumentBatchUploadInitResponseDTO;
import com.planora.backend.model.Project;
import com.planora.backend.model.User;
import com.planora.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentBatchUploadServiceTest {
    @Mock DocumentUploadReservationRepository reservationRepository;
    @Mock DocumentRepository documentRepository;
    @Mock ProjectRepository projectRepository;
    @Mock UserRepository userRepository;
    @Mock DocumentService documentService;
    @Mock S3StorageService storage;
    @Mock DocumentContentValidationService contentValidation;
    @Mock VirusScanService virusScanService;
    private DocumentBatchUploadService service;

    @BeforeEach
    void setUp() {
        service = new DocumentBatchUploadService(reservationRepository, documentRepository, projectRepository, userRepository,
                documentService, new DocumentFileTypeRegistry(), storage, contentValidation, virusScanService);
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "dmsBucket", "documents");
    }

    @Test
    void initReturnsPerFileResultAndReservesOnlyValidFiles() {
        Project project = new Project(); project.setId(5L);
        User user = new User(); user.setUserId(9L);
        when(projectRepository.findByIdWithLock(5L)).thenReturn(Optional.of(project));
        when(userRepository.findById(9L)).thenReturn(Optional.of(user));
        when(documentRepository.sumFileSizeByProjectId(5L)).thenReturn(0L);
        when(reservationRepository.sumActiveReservedBytes(eq(5L), anyList(), any(LocalDateTime.class))).thenReturn(0L);
        when(storage.generatePresignedUploadUrl(eq("documents"), anyString(), eq("application/pdf"), any(Duration.class))).thenReturn("https://storage/upload");

        DocumentBatchUploadInitRequestDTO request = new DocumentBatchUploadInitRequestDTO();
        request.setFiles(List.of(file("good", "spec.pdf", "application/pdf", 100), file("bad", "tool.exe", "application/octet-stream", 100)));

        DocumentBatchUploadInitResponseDTO response = service.init(5L, 9L, request);

        assertTrue(response.getFiles().get(0).isAccepted());
        assertEquals("https://storage/upload", response.getFiles().get(0).getUploadUrl());
        assertFalse(response.getFiles().get(1).isAccepted());
        assertEquals("UNSUPPORTED_EXTENSION", response.getFiles().get(1).getErrorCode());
        verify(reservationRepository, times(1)).save(any());
    }

    private DocumentBatchUploadInitRequestDTO.FileItem file(String id, String name, String type, long size) {
        DocumentBatchUploadInitRequestDTO.FileItem item = new DocumentBatchUploadInitRequestDTO.FileItem();
        item.setClientId(id); item.setFileName(name); item.setContentType(type); item.setFileSize(size);
        return item;
    }
}
