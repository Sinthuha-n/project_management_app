package com.planora.backend.service;

import com.planora.backend.model.Priority;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskActivityType;
import com.planora.backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecurringTaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private TaskActivityService taskActivityService;

    @Mock
    private ScheduledJobLockService scheduledJobLockService;

    @InjectMocks
    private RecurringTaskScheduler recurringTaskScheduler;

    private Task templateTask;

    @BeforeEach
    void setUp() {
        when(scheduledJobLockService.tryAcquire(anyString(), any())).thenReturn(true);
        templateTask = new Task();
        templateTask.setId(1L);
        templateTask.setTitle("Daily Standup");
        templateTask.setRecurrenceRule("DAILY");
        templateTask.setRecurrenceActive(true);
        templateTask.setNextOccurrence(LocalDate.now());
    }

    @Test
    void spawnDueRecurrences_doesNothingWhenNoTasksDue() {
        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of());

        recurringTaskScheduler.spawnDueRecurrences();

        verify(taskRepository, never()).save(any());
        verify(taskActivityService, never()).logActivity(any(), any(), any(), any());
    }

    @Test
    void spawnDueRecurrences_spawnsNewTaskInstance_IdempotentCheck() {
        LocalDate occurrenceDate = templateTask.getNextOccurrence();
        
        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of(templateTask));
        
        // Mock that it is NOT already spawned for the occurrenceDate
        when(taskRepository.existsByRecurrenceParentIdAndDueDate(1L, occurrenceDate))
                .thenReturn(false);

        // When spawning, the saved task instance gets returned
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        recurringTaskScheduler.spawnDueRecurrences();

        // Should save template and spawned instance
        verify(taskRepository, atLeastOnce()).save(any(Task.class));
        
        // Verify audit logs are created for generated task AND template task
        verify(taskActivityService, times(2)).logActivity(any(), any(), any(), any());
    }

    @Test
    void spawnDueRecurrences_skipsSpawningIfAlreadyExists_Idempotency() {
        LocalDate occurrenceDate = templateTask.getNextOccurrence();

        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of(templateTask));

        // Mock that it is ALREADY spawned for this occurrenceDate
        when(taskRepository.existsByRecurrenceParentIdAndDueDate(1L, occurrenceDate))
                .thenReturn(true);

        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        recurringTaskScheduler.spawnDueRecurrences();

        // Should not save any new instance, but saves template task to advance nextOccurrence
        // Verify we only save the template (or we advanced nextOccurrence)
        assertEquals(occurrenceDate.plusDays(1), templateTask.getNextOccurrence());
        verify(taskActivityService, never()).logActivity(any(), any(), any(), any());
    }

    @Test
    void spawnDueRecurrences_catchesUpOnOverdueOccurrences() {
        // Today is T. Template nextOccurrence is T-3 (3 days ago).
        // Catch-up should run 3 times: T-3, T-2, T-1, and then advance to T.
        LocalDate today = LocalDate.now();
        templateTask.setNextOccurrence(today.minusDays(3));
        templateTask.setRecurrenceRule("DAILY");

        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of(templateTask));
        when(taskRepository.existsByRecurrenceParentIdAndDueDate(eq(1L), any(LocalDate.class)))
                .thenReturn(false);
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        recurringTaskScheduler.spawnDueRecurrences();

        // Verify catch up advanced nextOccurrence to tomorrow
        assertEquals(today.plusDays(1), templateTask.getNextOccurrence());
        
        // Count should increment to 4 (T-3, T-2, T-1, T)
        assertEquals(4, templateTask.getRecurrenceCount());
    }

    @Test
    void spawnDueRecurrences_respectsRecurrenceLimit() {
        templateTask.setNextOccurrence(LocalDate.now().minusDays(1));
        templateTask.setRecurrenceLimit(2);
        templateTask.setRecurrenceCount(1); // 1 occurrence already spawned

        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of(templateTask));
        when(taskRepository.existsByRecurrenceParentIdAndDueDate(1L, LocalDate.now().minusDays(1)))
                .thenReturn(false);
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        recurringTaskScheduler.spawnDueRecurrences();

        // Next advanced date should be null because limit was reached (count = 2 >= limit = 2)
        assertNull(templateTask.getNextOccurrence());
        assertEquals(2, templateTask.getRecurrenceCount());
    }
}
