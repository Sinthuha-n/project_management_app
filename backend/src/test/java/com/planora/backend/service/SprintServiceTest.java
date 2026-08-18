package com.planora.backend.service;

import com.planora.backend.dto.SprintCreateRequestDTO;
import com.planora.backend.dto.SprintResponseDTO;
import com.planora.backend.exception.BadRequestException;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.SprintboardRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SprintServiceTest {

    @Mock private SprintRepository sprintRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private TeamMemberRepository teamMemberRepository;
    @Mock private SprintboardService sprintboardService;
    @Mock private TaskRepository taskRepository;
    @Mock private SprintboardRepository sprintboardRepository;
    @Mock private Project project;
    @Mock private Team team;
    @Mock private TeamMember teamMember;

    private SprintService sprintService;

    @BeforeEach
    void setUp() {
        sprintService = new SprintService(
                sprintRepository,
                projectRepository,
                teamMemberRepository,
                sprintboardService,
                taskRepository,
                sprintboardRepository
        );
    }

    private void authorize(Long projectId, Long userId) {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(project.getTeam()).thenReturn(team);
        when(team.getId()).thenReturn(10L);
        when(teamMemberRepository.findByTeamIdAndUserUserId(10L, userId)).thenReturn(Optional.of(teamMember));
        when(teamMember.getRole()).thenReturn(TeamRole.OWNER);
    }

    @Test
    void createSprint_startDateInPast_throwsBadRequestException() {
        authorize(1L, 99L);
        SprintCreateRequestDTO request = new SprintCreateRequestDTO();
        request.setProId(1L);
        request.setName("Sprint 1");
        request.setStartDate(LocalDate.now().minusDays(1));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> sprintService.createSprint(request, 99L));

        assertEquals("Sprint start date cannot be before today. Please select today or a future date.", ex.getMessage());
        verify(sprintRepository, never()).save(any());
    }

    @Test
    void createSprint_endDateBeforeStartDate_throwsBadRequestException() {
        authorize(1L, 99L);
        SprintCreateRequestDTO request = new SprintCreateRequestDTO();
        request.setProId(1L);
        request.setName("Sprint 1");
        request.setStartDate(LocalDate.now().plusDays(5));
        request.setEndDate(LocalDate.now().plusDays(3));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> sprintService.createSprint(request, 99L));

        assertEquals("Sprint end date cannot be before the sprint start date.", ex.getMessage());
        verify(sprintRepository, never()).save(any());
    }

    @Test
    void createSprint_validDates_success() {
        authorize(1L, 99L);
        when(project.getId()).thenReturn(1L);
        SprintCreateRequestDTO request = new SprintCreateRequestDTO();
        request.setProId(1L);
        request.setName("Sprint 1");
        request.setStartDate(LocalDate.now());
        request.setEndDate(LocalDate.now().plusDays(14));

        when(sprintRepository.save(any(Sprint.class))).thenAnswer(inv -> {
            Sprint s = inv.getArgument(0);
            s.setId(101L);
            return s;
        });

        SprintResponseDTO response = sprintService.createSprint(request, 99L);
        assertNotNull(response);
        assertEquals(101L, response.getId());
        assertEquals("Sprint 1", response.getName());
    }

    @Test
    void startSprint_startDateInPast_throwsBadRequestException() {
        Sprint sprint = new Sprint();
        sprint.setId(5L);
        sprint.setProject(project);
        sprint.setStatus(SprintStatus.NOT_STARTED);
        when(project.getId()).thenReturn(1L);
        authorize(1L, 99L);
        when(sprintRepository.findById(5L)).thenReturn(Optional.of(sprint));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> sprintService.startSprint(5L, LocalDate.now().minusDays(2), LocalDate.now().plusDays(10), 99L));

        assertEquals("Sprint start date cannot be before today. Please select today or a future date.", ex.getMessage());
    }

    @Test
    void startSprint_endDateBeforeStartDate_throwsBadRequestException() {
        Sprint sprint = new Sprint();
        sprint.setId(5L);
        sprint.setProject(project);
        sprint.setStatus(SprintStatus.NOT_STARTED);
        when(project.getId()).thenReturn(1L);
        authorize(1L, 99L);
        when(sprintRepository.findById(5L)).thenReturn(Optional.of(sprint));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> sprintService.startSprint(5L, LocalDate.now().plusDays(5), LocalDate.now().plusDays(2), 99L));

        assertEquals("Sprint end date cannot be before the sprint start date.", ex.getMessage());
    }

    @Test
    void startSprint_withTaskDateBeforeSprintStart_throwsBadRequestException() {
        Sprint sprint = new Sprint();
        sprint.setId(5L);
        sprint.setProject(project);
        sprint.setStatus(SprintStatus.NOT_STARTED);
        when(project.getId()).thenReturn(1L);
        authorize(1L, 99L);
        when(sprintRepository.findById(5L)).thenReturn(Optional.of(sprint));

        Task task = new Task();
        task.setStartDate(LocalDate.now()); // before sprint start date of now + 2
        when(taskRepository.findBySprintIdWithScalars(5L)).thenReturn(List.of(task));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> sprintService.startSprint(5L, LocalDate.now().plusDays(2), LocalDate.now().plusDays(10), 99L));

        assertEquals("Task date cannot be before the sprint start date.", ex.getMessage());
    }

    @Test
    void startSprint_withTaskDueDateAfterSprintEnd_throwsBadRequestException() {
        Sprint sprint = new Sprint();
        sprint.setId(5L);
        sprint.setProject(project);
        sprint.setStatus(SprintStatus.NOT_STARTED);
        when(project.getId()).thenReturn(1L);
        authorize(1L, 99L);
        when(sprintRepository.findById(5L)).thenReturn(Optional.of(sprint));

        Task task = new Task();
        task.setDueDate(LocalDate.now().plusDays(15)); // after sprint end date of now + 10
        when(taskRepository.findBySprintIdWithScalars(5L)).thenReturn(List.of(task));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> sprintService.startSprint(5L, LocalDate.now(), LocalDate.now().plusDays(10), 99L));

        assertEquals("Task date cannot be after the sprint end date.", ex.getMessage());
    }

    @Test
    void updateSprint_startDateInPast_throwsBadRequestException() {
        Sprint sprint = new Sprint();
        sprint.setId(5L);
        sprint.setProject(project);
        sprint.setStatus(SprintStatus.NOT_STARTED);
        when(project.getId()).thenReturn(1L);
        authorize(1L, 99L);
        when(sprintRepository.findById(5L)).thenReturn(Optional.of(sprint));

        SprintCreateRequestDTO request = new SprintCreateRequestDTO();
        request.setStartDate(LocalDate.now().minusDays(3));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> sprintService.updateSprint(5L, request, 99L));

        assertEquals("Sprint start date cannot be before today. Please select today or a future date.", ex.getMessage());
    }
}
