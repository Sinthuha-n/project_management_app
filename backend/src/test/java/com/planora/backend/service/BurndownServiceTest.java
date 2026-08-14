package com.planora.backend.service;

import com.planora.backend.dto.BurndownResponseDTO;
import com.planora.backend.dto.SprintResponseDTO;
import com.planora.backend.model.Priority;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.model.Task;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BurndownServiceTest {

    private static final Clock FIXED_CLOCK = Clock.fixed(
            Instant.parse("2026-04-08T10:15:00Z"),
            ZoneId.of("UTC")
    );

    @Mock
    private SprintRepository sprintRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private SprintService sprintService;

    private BurndownService burndownService;
    private Sprint sprint;

    @BeforeEach
    void setUp() {
        burndownService = new BurndownService(sprintRepository, taskRepository, sprintService, FIXED_CLOCK);
        sprint = sprint("Sprint 7", LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 14), SprintStatus.ACTIVE);
        when(sprintService.getSprintById(7L, 99L)).thenReturn(SprintResponseDTO.builder().id(7L).name("Sprint 7").build());
        when(sprintService.getSprintEntityById(7L)).thenReturn(sprint);
    }

    @Test
    void activeSprintOnTrackIncludesSummaryAndBreakdown() {
        when(taskRepository.findBySprintIdWithScalars(7L)).thenReturn(List.of(
                task("DONE", 8, Priority.HIGH, LocalDateTime.of(2026, 4, 3, 9, 0)),
                task("DONE", 5, Priority.MEDIUM, LocalDateTime.of(2026, 4, 7, 12, 0)),
                task("IN_PROGRESS", 3, Priority.HIGH, null)
        ));

        BurndownResponseDTO response = burndownService.getBurndownData(7L, null, null, 99L);

        assertEquals(16, response.totalStoryPoints());
        assertEquals(13, response.summary().completedStoryPoints());
        assertEquals(3, response.summary().remainingStoryPoints());
        assertEquals("ON_TRACK", response.summary().healthStatus());
        assertTrue(response.summary().actualBurnRate() > response.summary().requiredBurnRate());
        assertEquals(2, response.breakdown().byStatus().size());
        assertTrue(response.insights().stream().anyMatch(message -> message.contains("pts/day required")));
        assertTrue(response.insights().stream().noneMatch(message ->
                message.contains("ideal remaining line") || message.contains("above the ideal") || message.contains("ahead of the ideal")));
    }

    @Test
    void lateSprintIsOffTrackWhenEndDatePassedWithRemainingScope() {
        sprint.setEndDate(LocalDate.of(2026, 4, 6));
        when(taskRepository.findBySprintIdWithScalars(7L)).thenReturn(List.of(
                task("DONE", 2, Priority.LOW, LocalDateTime.of(2026, 4, 2, 9, 0)),
                task("TODO", 8, Priority.URGENT, null)
        ));

        BurndownResponseDTO response = burndownService.getBurndownData(7L, null, null, 99L);

        assertEquals("OFF_TRACK", response.summary().healthStatus());
        assertTrue(response.insights().stream().anyMatch(message -> message.contains("end date has passed")));
    }

    @Test
    void completedSprintReportsComplete() {
        sprint.setStatus(SprintStatus.COMPLETED);
        sprint.setEndDate(LocalDate.of(2026, 4, 7));
        when(taskRepository.findBySprintIdWithScalars(7L)).thenReturn(List.of(
                task("DONE", 4, Priority.HIGH, LocalDateTime.of(2026, 4, 3, 9, 0)),
                task("DONE", 6, Priority.MEDIUM, null)
        ));

        BurndownResponseDTO response = burndownService.getBurndownData(7L, null, null, 99L);

        assertEquals("COMPLETE", response.summary().healthStatus());
        assertEquals(0, response.summary().remainingStoryPoints());
    }

    @Test
    void zeroStoryPointSprintReportsNoScope() {
        when(taskRepository.findBySprintIdWithScalars(7L)).thenReturn(List.of(
                task("TODO", 0, Priority.LOW, null)
        ));

        BurndownResponseDTO response = burndownService.getBurndownData(7L, null, null, 99L);

        assertEquals("NO_SCOPE", response.summary().healthStatus());
        assertEquals(0, response.summary().progressPercent());
    }

    @Test
    void customDateRangeIsClampedToSprintDates() {
        when(taskRepository.findBySprintIdWithScalars(7L)).thenReturn(List.of(
                task("DONE", 3, Priority.HIGH, LocalDateTime.of(2026, 4, 5, 9, 0)),
                task("TODO", 5, Priority.MEDIUM, null)
        ));

        BurndownResponseDTO response = burndownService.getBurndownData(
                7L,
                LocalDate.of(2026, 3, 28),
                LocalDate.of(2026, 4, 4),
                99L
        );

        assertEquals("2026-04-01", response.dataPoints().get(0).date());
        assertEquals("2026-04-04", response.dataPoints().get(response.dataPoints().size() - 1).date());
    }

    @Test
    void doneTaskWithoutCompletedAtBurnsOnEffectiveSprintEnd() {
        sprint.setEndDate(LocalDate.of(2026, 4, 6));
        when(taskRepository.findBySprintIdWithScalars(7L)).thenReturn(List.of(
                task("DONE", 5, Priority.HIGH, null)
        ));

        BurndownResponseDTO response = burndownService.getBurndownData(7L, null, null, 99L);

        assertEquals(5, response.summary().completedStoryPoints());
        assertEquals(0, response.summary().remainingStoryPoints());
        assertEquals("COMPLETE", response.summary().healthStatus());
    }

    private Sprint sprint(String name, LocalDate startDate, LocalDate endDate, SprintStatus status) {
        Sprint sprint = new Sprint();
        sprint.setId(7L);
        sprint.setName(name);
        sprint.setStartDate(startDate);
        sprint.setEndDate(endDate);
        sprint.setStatus(status);
        return sprint;
    }

    private Task task(String status, int storyPoints, Priority priority, LocalDateTime completedAt) {
        Task task = new Task();
        task.setStatus(status);
        task.setStoryPoint(storyPoints);
        task.setPriority(priority);
        task.setCompletedAt(completedAt);
        return task;
    }
}
