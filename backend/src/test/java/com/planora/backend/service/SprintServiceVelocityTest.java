package com.planora.backend.service;

import com.planora.backend.dto.SprintCreateRequestDTO;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SprintServiceVelocityTest {

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

    @Test
    void startingSprintCapturesCommittedPoints() {
        Sprint sprint = sprint(SprintStatus.NOT_STARTED);
        authorize(sprint);
        when(taskRepository.findBySprintIdWithScalars(7L)).thenReturn(List.of(
                task("TODO", 8), task("IN_PROGRESS", 5), task("DONE", 3)
        ));
        when(sprintRepository.save(sprint)).thenReturn(sprint);

        sprintService.startSprint(
                7L,
                LocalDate.now(),
                LocalDate.now().plusDays(14),
                99L
        );

        assertEquals(16, sprint.getCommittedPoints());
        assertTrue(sprint.isCommitmentCaptured());
        assertEquals(SprintStatus.ACTIVE, sprint.getStatus());
    }

    @Test
    void completingSprintSnapshotsDeliveredPointsBeforeMovingIncompleteTasks() {
        Sprint sprint = sprint(SprintStatus.ACTIVE);
        authorize(sprint);
        Task done = task("DONE", 8);
        Task incomplete = task("IN_PROGRESS", 5);
        incomplete.setSprint(sprint);
        when(taskRepository.findBySprintIdWithScalars(7L)).thenReturn(List.of(done, incomplete));

        sprintService.completeSprint(7L, null, 99L);

        assertEquals(8, sprint.getCompletedPoints());
        assertNotNull(sprint.getCompletedAt());
        assertEquals(SprintStatus.COMPLETED, sprint.getStatus());
        assertNull(incomplete.getSprint());
        verify(taskRepository).saveAll(List.of(incomplete));
    }

    @Test
    void genericUpdateCannotBypassLifecycleSnapshots() {
        Sprint sprint = sprint(SprintStatus.NOT_STARTED);
        authorize(sprint);
        SprintCreateRequestDTO request = new SprintCreateRequestDTO();
        request.setStatus("COMPLETED");

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> sprintService.updateSprint(7L, request, 99L)
        );

        assertTrue(error.getMessage().contains("start and complete"));
        verify(sprintRepository, never()).save(any(Sprint.class));
    }

    private void authorize(Sprint sprint) {
        when(sprintRepository.findById(7L)).thenReturn(Optional.of(sprint));
        when(projectRepository.findById(3L)).thenReturn(Optional.of(project));
        when(project.getTeam()).thenReturn(team);
        when(team.getId()).thenReturn(4L);
        when(teamMemberRepository.findByTeamIdAndUserUserId(4L, 99L)).thenReturn(Optional.of(teamMember));
        when(teamMember.getRole()).thenReturn(TeamRole.OWNER);
    }

    private Sprint sprint(SprintStatus status) {
        Sprint sprint = new Sprint();
        sprint.setId(7L);
        sprint.setProject(project);
        sprint.setName("Sprint 7");
        sprint.setStatus(status);
        when(project.getId()).thenReturn(3L);
        return sprint;
    }

    private Task task(String status, int points) {
        Task task = new Task();
        task.setStatus(status);
        task.setStoryPoint(points);
        return task;
    }
}
