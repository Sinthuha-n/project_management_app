package com.planora.backend.service;

import com.planora.backend.dto.SprintVelocityDTO;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BurndownVelocityServiceTest {

    @Mock private SprintRepository sprintRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private SprintService sprintService;

    @Test
    void returnsStableSnapshotsInChronologicalOrderAndMarksLegacyBaselines() {
        Sprint newer = completedSprint(2L, "Sprint 2", LocalDate.of(2026, 8, 14));
        newer.setCompletedAt(LocalDateTime.of(2026, 8, 15, 9, 30));
        newer.setCommittedPoints(21);
        newer.setCompletedPoints(18);
        newer.setCommitmentCaptured(true);

        Sprint legacy = completedSprint(1L, "Sprint 1", LocalDate.of(2026, 7, 31));
        legacy.setCompletedPoints(13);

        Sprint active = new Sprint();
        active.setId(3L);
        active.setStatus(SprintStatus.ACTIVE);

        when(sprintService.getSprintEntitiesByProject(3L, 99L))
                .thenReturn(List.of(newer, active, legacy));

        BurndownService service = new BurndownService(
                sprintRepository,
                taskRepository,
                sprintService,
                Clock.fixed(Instant.parse("2026-08-20T00:00:00Z"), ZoneOffset.UTC)
        );

        List<SprintVelocityDTO> result = service.getVelocityData(3L, 99L);

        assertEquals(List.of(1L, 2L), result.stream().map(SprintVelocityDTO::getSprintId).toList());
        assertEquals(13, result.get(0).getCompletedPoints());
        assertFalse(result.get(0).isCommitmentCaptured());
        assertEquals(21, result.get(1).getCommittedPoints());
        assertEquals(18, result.get(1).getCompletedPoints());
        assertTrue(result.get(1).isCommitmentCaptured());
    }

    private Sprint completedSprint(Long id, String name, LocalDate endDate) {
        Sprint sprint = new Sprint();
        sprint.setId(id);
        sprint.setName(name);
        sprint.setStartDate(endDate.minusDays(13));
        sprint.setEndDate(endDate);
        sprint.setStatus(SprintStatus.COMPLETED);
        return sprint;
    }
}
