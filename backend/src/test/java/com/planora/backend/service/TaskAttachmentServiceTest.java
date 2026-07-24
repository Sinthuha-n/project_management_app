package com.planora.backend.service;

import com.planora.backend.dto.TaskAttachmentResponseDTO;
import com.planora.backend.dto.TaskAttachmentUploadFinalizeRequestDTO;
import com.planora.backend.dto.TaskAttachmentUploadInitRequestDTO;
import com.planora.backend.dto.TaskAttachmentUploadInitResponseDTO;
import com.planora.backend.model.*;
import com.planora.backend.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskAttachmentServiceTest {

    @Mock private TaskAttachmentRepository taskAttachmentRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private TeamMemberRepository teamMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private S3StorageService s3StorageService;

    @InjectMocks
    private TaskAttachmentService taskAttachmentService;

    private Task sampleTask;
    private User sampleUser;
    private Team sampleTeam;
    private Project sampleProject;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(taskAttachmentService, "taskBucket", "test-task-bucket");

        sampleTeam = new Team();
        sampleTeam.setId(5L);

        sampleProject = new Project();
        sampleProject.setId(10L);
        sampleProject.setTeam(sampleTeam);

        sampleTask = new Task();
        sampleTask.setId(1L);
        sampleTask.setProject(sampleProject);

        sampleUser = new User();
        sampleUser.setUserId(1L);
        sampleUser.setUsername("alice");
    }

    @Test
    void initUpload_returnsPresignedUrl_whenUserIsTeamMember() {
        TeamMember member = new TeamMember();
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(teamMemberRepository.findByTeamIdAndUserUserId(5L, 1L)).thenReturn(Optional.of(member));
        when(s3StorageService.generatePresignedUploadUrl(anyString(), anyString(), anyString(), any()))
                .thenReturn("https://s3.example.com/presigned");

        TaskAttachmentUploadInitRequestDTO req = new TaskAttachmentUploadInitRequestDTO();
        req.setFileName("report.pdf");
        req.setContentType("application/pdf");
        req.setFileSize(10_000L);

        TaskAttachmentUploadInitResponseDTO result = taskAttachmentService.initUpload(1L, 1L, req);

        assertNotNull(result.getUploadUrl());
        assertNotNull(result.getObjectKey());
    }

    @Test
    void initUpload_throwsEntityNotFound_whenTaskNotFound() {
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class,
                () -> taskAttachmentService.initUpload(99L, 1L, new TaskAttachmentUploadInitRequestDTO()));
    }

    @Test
    void listAttachments_returnsAttachments_whenUserIsTeamMember() {
        TeamMember member = new TeamMember();
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(teamMemberRepository.findByTeamIdAndUserUserId(5L, 1L)).thenReturn(Optional.of(member));

        TaskAttachment attachment = new TaskAttachment();
        attachment.setId(1L);
        attachment.setFileName("report.pdf");
        attachment.setContentType("application/pdf");
        attachment.setFileSize(1024L);
        attachment.setObjectKey("task-1/uuid-report.pdf");
        attachment.setUploadedBy(sampleUser);
        attachment.setCreatedAt(LocalDateTime.now());

        when(taskAttachmentRepository.findByTaskIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(attachment));
        when(s3StorageService.generatePresignedDownloadUrl(anyString(), anyString(), any())).thenReturn("https://cdn.example.com/report.pdf");

        List<TaskAttachmentResponseDTO> result = taskAttachmentService.listAttachments(1L, 1L);

        assertEquals(1, result.size());
        assertEquals("report.pdf", result.get(0).getFileName());
    }

    @Test
    void listAttachments_throwsRuntime_whenUserNotTeamMember() {
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(teamMemberRepository.findByTeamIdAndUserUserId(5L, 99L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> taskAttachmentService.listAttachments(1L, 99L));
    }

    @Test
    void finalizeUpload_usesS3MetadataInsteadOfClientDeclaredMetadata() {
        TeamMember member = new TeamMember();
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(teamMemberRepository.findByTeamIdAndUserUserId(5L, 1L)).thenReturn(Optional.of(member));
        when(s3StorageService.headObject("test-task-bucket", "task-1/uuid-report.pdf"))
                .thenReturn(HeadObjectResponse.builder().contentType("application/pdf").contentLength(1024L).build());
        when(s3StorageService.resolveContentType("application/pdf", "report.pdf")).thenReturn("application/pdf");
        when(taskAttachmentRepository.findByObjectKey("task-1/uuid-report.pdf")).thenReturn(Optional.empty());
        when(userRepository.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(taskAttachmentRepository.save(any(TaskAttachment.class))).thenAnswer(invocation -> {
            TaskAttachment attachment = invocation.getArgument(0);
            attachment.setId(1L);
            attachment.setCreatedAt(LocalDateTime.now());
            return attachment;
        });

        TaskAttachmentUploadFinalizeRequestDTO request = new TaskAttachmentUploadFinalizeRequestDTO();
        request.setFileName("report.pdf");
        request.setContentType("application/pdf");
        request.setFileSize(1024L);
        request.setObjectKey("task-1/uuid-report.pdf");

        TaskAttachmentResponseDTO result = taskAttachmentService.finalizeUpload(1L, 1L, request);

        assertEquals(1024L, result.getFileSize());
        verify(s3StorageService).headObject("test-task-bucket", "task-1/uuid-report.pdf");
    }

    @Test
    void finalizeUpload_rejectsMetadataThatDoesNotMatchStoredObject() {
        TeamMember member = new TeamMember();
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(teamMemberRepository.findByTeamIdAndUserUserId(5L, 1L)).thenReturn(Optional.of(member));
        when(s3StorageService.headObject("test-task-bucket", "task-1/uuid-report.pdf"))
                .thenReturn(HeadObjectResponse.builder().contentType("application/pdf").contentLength(2048L).build());
        when(s3StorageService.resolveContentType("application/pdf", "report.pdf")).thenReturn("application/pdf");

        TaskAttachmentUploadFinalizeRequestDTO request = new TaskAttachmentUploadFinalizeRequestDTO();
        request.setFileName("report.pdf");
        request.setContentType("application/pdf");
        request.setFileSize(1024L);
        request.setObjectKey("task-1/uuid-report.pdf");

        assertThrows(RuntimeException.class, () -> taskAttachmentService.finalizeUpload(1L, 1L, request));
        verify(taskAttachmentRepository, never()).save(any());
    }

    @Test
    void deleteAttachment_deletesFromS3AndRepository() {
        TeamMember member = new TeamMember();
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(teamMemberRepository.findByTeamIdAndUserUserId(5L, 1L)).thenReturn(Optional.of(member));

        TaskAttachment attachment = new TaskAttachment();
        attachment.setId(10L);
        attachment.setTask(sampleTask);
        attachment.setObjectKey("task-1/uuid-report.pdf");

        when(taskAttachmentRepository.findById(10L)).thenReturn(Optional.of(attachment));
        doNothing().when(s3StorageService).deleteObject(anyString(), anyString());
        doNothing().when(taskAttachmentRepository).delete(any());

        assertDoesNotThrow(() -> taskAttachmentService.deleteAttachment(1L, 10L, 1L));

        verify(s3StorageService).deleteObject("test-task-bucket", "task-1/uuid-report.pdf");
        verify(taskAttachmentRepository).delete(attachment);
    }

    @Test
    void deleteAttachment_throwsEntityNotFound_whenAttachmentNotFound() {
        TeamMember member = new TeamMember();
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(teamMemberRepository.findByTeamIdAndUserUserId(5L, 1L)).thenReturn(Optional.of(member));
        when(taskAttachmentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class,
                () -> taskAttachmentService.deleteAttachment(1L, 99L, 1L));
    }
}
