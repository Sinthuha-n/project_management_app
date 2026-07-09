package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.annotation.WithMockUserPrincipal;
import com.planora.backend.dto.KanbanMoveTaskRequest;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.TaskActivityService;
import com.planora.backend.service.TaskService;
import com.planora.backend.service.TaskTemplateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TaskController.class)
class TaskControllerKanbanMoveTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TaskService service;

    @MockBean
    private TaskActivityService activityService;

    @MockBean
    private TaskTemplateService templateService;

    @MockBean
    private SimpMessagingTemplate messagingTemplate;

    @MockBean
    private JWTService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private com.planora.backend.service.TaskGithubService taskGithubService;

    @MockBean
    private com.planora.backend.service.GithubTokenService githubTokenService;

    @MockBean
    private com.planora.backend.service.GithubIssuesSyncService githubIssuesSyncService;

    @MockBean
    private com.planora.backend.service.GithubNotificationService githubNotificationService;

    @Autowired
    private ObjectMapper objectMapper;

    private TaskResponseDTO movedTask;

    @BeforeEach
    void setUp() {
        movedTask = new TaskResponseDTO();
        movedTask.setId(5L);
        movedTask.setTitle("Moved task");
        movedTask.setProjectId(1L);
        movedTask.setStatus("IN_PROGRESS");
    }

    // ── Happy Path ────────────────────────────────────────────────────────────

    @Test
    @WithMockUserPrincipal
    void moveKanbanTask_crossColumnDrag_returnsOkAndBroadcasts() throws Exception {
        when(service.moveKanbanTask(eq(1L), eq(5L), eq("IN_PROGRESS"), anyList(), eq(1L)))
                .thenReturn(movedTask);

        KanbanMoveTaskRequest request = new KanbanMoveTaskRequest(1L, 5L, "IN_PROGRESS", List.of(5L, 3L, 7L));

        mockMvc.perform(patch("/api/tasks/kanban/move")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        // Verify WebSocket broadcast was fired with TASK_UPDATED
        verify(messagingTemplate).convertAndSend(
                eq("/topic/project/1/tasks"),
                argThat((Object payload) -> payload.toString().contains("TASK_UPDATED"))
        );
    }

    @Test
    @WithMockUserPrincipal
    void moveKanbanTask_sameColumnReorder_returnsOk() throws Exception {
        movedTask.setStatus("TODO");
        when(service.moveKanbanTask(eq(1L), eq(5L), eq("TODO"), anyList(), eq(1L)))
                .thenReturn(movedTask);

        KanbanMoveTaskRequest request = new KanbanMoveTaskRequest(1L, 5L, "TODO", List.of(3L, 5L, 7L));

        mockMvc.perform(patch("/api/tasks/kanban/move")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TODO"));

        verify(service).moveKanbanTask(1L, 5L, "TODO", List.of(3L, 5L, 7L), 1L);
    }

    @Test
    @WithMockUserPrincipal
    void moveKanbanTask_emptyOrderedTaskIds_returnsOk() throws Exception {
        movedTask.setStatus("DONE");
        when(service.moveKanbanTask(eq(1L), eq(5L), eq("DONE"), eq(List.of()), eq(1L)))
                .thenReturn(movedTask);

        KanbanMoveTaskRequest request = new KanbanMoveTaskRequest(1L, 5L, "DONE", List.of());

        mockMvc.perform(patch("/api/tasks/kanban/move")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));
    }

    // ── Error Paths ───────────────────────────────────────────────────────────

    @Test
    @WithMockUserPrincipal
    void moveKanbanTask_unknownTask_returns404() throws Exception {
        when(service.moveKanbanTask(anyLong(), anyLong(), anyString(), anyList(), anyLong()))
                .thenThrow(new ResourceNotFoundException("Task not found"));

        KanbanMoveTaskRequest request = new KanbanMoveTaskRequest(1L, 999L, "IN_PROGRESS", List.of(999L));

        mockMvc.perform(patch("/api/tasks/kanban/move")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUserPrincipal
    void moveKanbanTask_taskInDifferentProject_returnsForbidden() throws Exception {
        when(service.moveKanbanTask(anyLong(), anyLong(), anyString(), anyList(), anyLong()))
                .thenThrow(new ForbiddenException("Task does not belong to project 1"));

        KanbanMoveTaskRequest request = new KanbanMoveTaskRequest(1L, 5L, "IN_PROGRESS", List.of(5L));

        mockMvc.perform(patch("/api/tasks/kanban/move")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Task does not belong to project 1"));
    }

    @Test
    @WithMockUserPrincipal
    void moveKanbanTask_callerNotMember_returnsForbidden() throws Exception {
        when(service.moveKanbanTask(anyLong(), anyLong(), anyString(), anyList(), anyLong()))
                .thenThrow(new ForbiddenException("User is not a member of this team"));

        KanbanMoveTaskRequest request = new KanbanMoveTaskRequest(1L, 5L, "IN_PROGRESS", List.of(5L));

        mockMvc.perform(patch("/api/tasks/kanban/move")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    // ── Validation ────────────────────────────────────────────────────────────

    @Test
    @WithMockUserPrincipal
    void moveKanbanTask_missingProjectId_returns400() throws Exception {
        // projectId is missing — validation should reject
        String body = "{\"taskId\":5,\"status\":\"IN_PROGRESS\",\"orderedTaskIds\":[5]}";

        mockMvc.perform(patch("/api/tasks/kanban/move")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    @WithMockUserPrincipal
    void moveKanbanTask_blankStatus_returns400() throws Exception {
        String body = "{\"projectId\":1,\"taskId\":5,\"status\":\"\",\"orderedTaskIds\":[5]}";

        mockMvc.perform(patch("/api/tasks/kanban/move")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }
}
