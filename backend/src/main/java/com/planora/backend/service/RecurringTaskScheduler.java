package com.planora.backend.service;

import com.planora.backend.model.Priority;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskActivityType;
import com.planora.backend.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Duration;
import java.util.List;

import lombok.RequiredArgsConstructor;

/**
 * Spawns new task instances for recurring tasks whose next occurrence is today or past.
 * Runs once every day at midnight UTC.
 */
@Service
@RequiredArgsConstructor
public class RecurringTaskScheduler {

    private static final Logger log = LoggerFactory.getLogger(RecurringTaskScheduler.class);

    private final TaskRepository taskRepository;
    private final TaskActivityService taskActivityService;
    private final ScheduledJobLockService scheduledJobLockService;

    @Scheduled(cron = "0 0 0 * * *")   // every day at midnight UTC
    @Transactional
    public void spawnDueRecurrences() {
        if (!scheduledJobLockService.tryAcquire("recurring-task-spawn", Duration.ofHours(2))) {
            log.debug("Recurring task spawn is already running on another instance.");
            return;
        }
        try {
        LocalDate today = LocalDate.now();
        List<Task> due = taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(today);

        for (Task template : due) {
            try {
                // Loop to catch up on any missed occurrences (e.g. if scheduler was down for days)
                while (template.getNextOccurrence() != null && !template.getNextOccurrence().isAfter(today)) {
                    LocalDate occurrenceDate = template.getNextOccurrence();

                    // Check end conditions: End Date
                    if (template.getRecurrenceEnd() != null && template.getRecurrenceEnd().isBefore(occurrenceDate)) {
                        template.setNextOccurrence(null);
                        taskRepository.save(template);
                        break;
                    }

                    // Check end conditions: End after N occurrences
                    if (template.getRecurrenceLimit() != null && template.getRecurrenceCount() >= template.getRecurrenceLimit()) {
                        template.setNextOccurrence(null);
                        taskRepository.save(template);
                        break;
                    }

                    // Ensure Idempotency: verify if this template already spawned an occurrence on the target due date
                    boolean alreadySpawned = taskRepository.existsByRecurrenceParentIdAndDueDate(template.getId(), occurrenceDate);
                    if (!alreadySpawned) {
                        // Spawn a new task instance
                        Task instance = new Task();
                        instance.setTitle(template.getTitle());
                        instance.setDescription(template.getDescription());
                        instance.setProject(template.getProject());
                        instance.setSprint(template.getSprint());
                        instance.setKanbanColumn(template.getKanbanColumn());
                        instance.setAssignee(template.getAssignee());
                        instance.getAssignees().addAll(template.getAssignees());
                        instance.setReporter(template.getReporter());
                        instance.setPriority(template.getPriority());
                        instance.setRecurrenceParent(template);
                        instance.setStartDate(occurrenceDate);
                        instance.setDueDate(occurrenceDate);

                        if (template.getMilestone() != null) {
                            instance.setMilestone(template.getMilestone());
                        }

                        Task savedInstance = taskRepository.save(instance);

                        // Audit event for the newly spawned task
                        taskActivityService.logActivity(
                                savedInstance.getId(),
                                TaskActivityType.TASK_CREATED,
                                "System",
                                "Task automatically generated from recurring template"
                        );

                        // Audit event for the template task noting the occurrence spawn
                        taskActivityService.logActivity(
                                template.getId(),
                                TaskActivityType.UPDATED,
                                "System",
                                "Spawned recurring task occurrence for due date: " + occurrenceDate
                        );

                        template.setRecurrenceCount(template.getRecurrenceCount() + 1);
                        log.info("Spawned recurring task instance={} for template={} on due date={}", savedInstance.getId(), template.getId(), occurrenceDate);
                    } else {
                        log.info("Occurrence for template={} on {} already spawned, skipping spawn.", template.getId(), occurrenceDate);
                    }

                    // Advance the template's nextOccurrence
                    LocalDate next = advance(occurrenceDate, template.getRecurrenceRule(), template.getCustomInterval());
                    
                    // Stop if next advanced date exceeds limits
                    if (template.getRecurrenceEnd() != null && next != null && next.isAfter(template.getRecurrenceEnd())) {
                        next = null;
                    }
                    if (template.getRecurrenceLimit() != null && template.getRecurrenceCount() >= template.getRecurrenceLimit()) {
                        next = null;
                    }
                    
                    template.setNextOccurrence(next);
                    taskRepository.save(template);
                }
            } catch (Exception e) {
                log.error("Failed to spawn recurrence for task {}: {}", template.getId(), e.getMessage());
            }
        }
        } finally {
            scheduledJobLockService.release("recurring-task-spawn");
        }
    }

    private LocalDate advance(LocalDate from, String rule, Integer customInterval) {
        if (from == null || rule == null) return from;
        int delta = (customInterval != null && customInterval > 0) ? customInterval : 1;
        return switch (rule.toUpperCase()) {
            case "DAILY", "CUSTOM_DAYS"     -> from.plusDays(delta);
            case "WEEKLY", "CUSTOM_WEEKS"   -> from.plusWeeks(delta);
            case "MONTHLY", "CUSTOM_MONTHS" -> from.plusMonths(delta);
            case "YEARLY", "CUSTOM_YEARS"   -> from.plusYears(delta);
            default                         -> from;
        };
    }
}
