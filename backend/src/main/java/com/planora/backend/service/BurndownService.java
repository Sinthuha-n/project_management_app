package com.planora.backend.service;

import com.planora.backend.dto.BurndownDataPointDTO;
import com.planora.backend.dto.BurndownBreakdownDTO;
import com.planora.backend.dto.BurndownBreakdownItemDTO;
import com.planora.backend.dto.BurndownResponseDTO;
import com.planora.backend.dto.BurndownSummaryDTO;
import com.planora.backend.dto.SprintResponseDTO;
import com.planora.backend.dto.SprintVelocityDTO;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class BurndownService {

    private final SprintRepository sprintRepository;
    private final TaskRepository taskRepository;
    private final SprintService sprintService;
    private final Clock clock;

    @Autowired
    public BurndownService(SprintRepository sprintRepository,
                           TaskRepository taskRepository,
                           SprintService sprintService) {
        this(sprintRepository, taskRepository, sprintService, Clock.systemDefaultZone());
    }

    BurndownService(SprintRepository sprintRepository,
                    TaskRepository taskRepository,
                    SprintService sprintService,
                    Clock clock) {
        this.sprintRepository = sprintRepository;
        this.taskRepository = taskRepository;
        this.sprintService = sprintService;
        this.clock = clock;
    }

    /**
     * Builds a burndown chart response for the given sprint.
     * Optionally filters the visible date range with {@code from}/{@code to}.
     *
     * @param sprintId        ID of the sprint
     * @param fromDate        optional start of visible range (defaults to sprint startDate)
     * @param toDate          optional end of visible range (defaults to sprint endDate or today)
     * @param currentUserId   ID of the requesting user (used for membership check)
     */
    @Transactional(readOnly = true)
    public BurndownResponseDTO getBurndownData(Long sprintId,
                                               LocalDate fromDate,
                                               LocalDate toDate,
                                               Long currentUserId) {

        // Authorisation re-used from SprintService (throws if not a member).
        sprintService.getSprintById(sprintId, currentUserId);
        Sprint sprint = sprintService.getSprintEntityById(sprintId);
        LocalDate today = LocalDate.now(clock);

        LocalDate sprintStart = sprint.getStartDate();
        LocalDate sprintEnd   = sprint.getEndDate() != null ? sprint.getEndDate()
                                                             : today;

        // Clamp the visible range to the sprint bounds
        LocalDate rangeStart = (fromDate != null && !fromDate.isBefore(sprintStart))
                ? fromDate : sprintStart;
        LocalDate rangeEnd   = (toDate   != null && !toDate.isAfter(sprintEnd))
                ? toDate : sprintEnd;

        if (rangeStart.isAfter(rangeEnd)) {
            rangeStart = sprintStart;
            rangeEnd   = sprintEnd;
        }

        // Fetch tasks
        List<Task> allTasks  = taskRepository.findBySprintIdWithScalars(sprintId);
        List<Task> doneTasks = allTasks.stream()
                .filter(t -> "done".equalsIgnoreCase(t.getStatus()))
                .collect(Collectors.toList());

        // Total story points (all tasks in sprint)
        int total = allTasks.stream().mapToInt(Task::getStoryPoint).sum();

        long totalDays = Math.max(0, ChronoUnit.DAYS.between(sprintStart, sprintEnd));

        // For DONE tasks missing completedAt: treat as completed on the sprint end date
        // (or today if the sprint hasn't ended yet), so historical views stay accurate.
        final LocalDate effectiveNullCompletion = sprintEnd.isBefore(today)
                ? sprintEnd
                : today;

        List<BurndownDataPointDTO> points = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE;
        int previousRemaining = total;

        LocalDate current = rangeStart;
        while (!current.isAfter(rangeEnd)) {
            // Ideal: linearly decreasing from total → 0 over the full sprint duration
            int ideal;
            if (totalDays == 0) {
                ideal = 0;
            } else {
                long dayIdx = ChronoUnit.DAYS.between(sprintStart, current);
                ideal = (int) Math.round(total * (1.0 - (double) dayIdx / (double) totalDays));
                ideal = Math.max(0, ideal);
            }

            // Actual: total − story points of tasks completed ON OR BEFORE this day
            final LocalDate day = current;
            int completedPoints = doneTasks.stream()
                    .filter(t -> {
                        LocalDateTime completedAt = t.getCompletedAt();
                        if (completedAt == null) {
                            return !effectiveNullCompletion.isAfter(day);
                        }
                        return !completedAt.toLocalDate().isAfter(day);
                    })
                    .mapToInt(Task::getStoryPoint)
                    .sum();

            int remaining = Math.max(0, total - completedPoints);
            int dailyBurn = Math.max(0, previousRemaining - remaining);
            points.add(new BurndownDataPointDTO(
                    current.format(fmt),
                    remaining,
                    ideal,
                    completedPoints,
                    dailyBurn,
                    current.isEqual(today)
            ));
            previousRemaining = remaining;
            current = current.plusDays(1);
        }

        BurndownDataPointDTO summaryPoint = pointForSummary(points, today);
        int completed = summaryPoint != null ? total - summaryPoint.remainingPoints() : 0;
        int remaining = summaryPoint != null ? summaryPoint.remainingPoints() : total;
        int idealRemaining = summaryPoint != null ? summaryPoint.idealPoints() : total;
        int totalTasks = allTasks.size();
        int completedTasks = doneTasks.size();
        int remainingTasks = Math.max(0, totalTasks - completedTasks);
        long elapsedDays = Math.max(0, ChronoUnit.DAYS.between(sprintStart, today.isBefore(sprintStart) ? sprintStart : today) + 1);
        elapsedDays = Math.min(elapsedDays, totalDays + 1);
        long remainingDays = Math.max(0, ChronoUnit.DAYS.between(today, sprintEnd));
        double actualBurnRate = elapsedDays > 0 ? completed / (double) elapsedDays : 0.0;
        double requiredBurnRate = remainingDays > 0 ? remaining / (double) remainingDays : remaining;
        String projectedCompletion = projectedCompletionDate(today, sprintEnd, remaining, actualBurnRate, fmt);
        String health = healthStatus(total, remaining, idealRemaining, sprintEnd, today, actualBurnRate, requiredBurnRate);

        BurndownSummaryDTO summary = new BurndownSummaryDTO(
                total,
                completed,
                remaining,
                totalTasks,
                completedTasks,
                remainingTasks,
                total > 0 ? (int) Math.round((completed * 100.0) / total) : 0,
                elapsedDays,
                remainingDays,
                idealRemaining,
                roundOne(actualBurnRate),
                roundOne(requiredBurnRate),
                projectedCompletion,
                health
        );

        BurndownBreakdownDTO breakdown = new BurndownBreakdownDTO(
                breakdownByStatus(allTasks),
                breakdownByPriority(allTasks)
        );

        return new BurndownResponseDTO(
                sprint.getId(),
                sprint.getName(),
                sprintStart.format(fmt),
                sprintEnd.format(fmt),
                total,
                points,
                summary,
                breakdown,
                insights(summary, sprintEnd, today)
        );
    }

    private BurndownDataPointDTO pointForSummary(List<BurndownDataPointDTO> points, LocalDate today) {
        if (points.isEmpty()) {
            return null;
        }
        String todayKey = today.format(DateTimeFormatter.ISO_LOCAL_DATE);
        return points.stream()
                .filter(p -> p.date().compareTo(todayKey) <= 0)
                .reduce((first, second) -> second)
                .orElse(points.get(0));
    }

    private String projectedCompletionDate(LocalDate today,
                                           LocalDate sprintEnd,
                                           int remaining,
                                           double actualBurnRate,
                                           DateTimeFormatter fmt) {
        if (remaining <= 0) {
            return today.format(fmt);
        }
        if (actualBurnRate <= 0.0) {
            return null;
        }
        long daysNeeded = (long) Math.ceil(remaining / actualBurnRate);
        return today.plusDays(daysNeeded).isAfter(sprintEnd.plusDays(30))
                ? sprintEnd.plusDays(30).format(fmt)
                : today.plusDays(daysNeeded).format(fmt);
    }

    private String healthStatus(int total,
                                int remaining,
                                int idealRemaining,
                                LocalDate sprintEnd,
                                LocalDate today,
                                double actualBurnRate,
                                double requiredBurnRate) {
        if (total == 0) {
            return "NO_SCOPE";
        }
        if (remaining == 0) {
            return "COMPLETE";
        }
        if (today.isAfter(sprintEnd)) {
            return "OFF_TRACK";
        }
        if (actualBurnRate == 0.0 && remaining > 0 && !today.isBefore(sprintEnd)) {
            return "OFF_TRACK";
        }
        if (remaining <= idealRemaining) {
            return "ON_TRACK";
        }
        if (requiredBurnRate > 0 && actualBurnRate >= requiredBurnRate * 0.75) {
            return "AT_RISK";
        }
        return "OFF_TRACK";
    }

    private List<BurndownBreakdownItemDTO> breakdownByStatus(List<Task> tasks) {
        Map<String, int[]> grouped = new LinkedHashMap<>();
        for (Task task : tasks) {
            String key = normalizeStatus(task.getStatus());
            int[] values = grouped.computeIfAbsent(key, ignored -> new int[]{0, 0});
            values[0] += 1;
            values[1] += task.getStoryPoint();
        }
        return grouped.entrySet().stream()
                .map(entry -> new BurndownBreakdownItemDTO(entry.getKey(), entry.getValue()[0], entry.getValue()[1]))
                .sorted(Comparator.comparing(BurndownBreakdownItemDTO::storyPoints).reversed())
                .toList();
    }

    private List<BurndownBreakdownItemDTO> breakdownByPriority(List<Task> tasks) {
        Map<String, int[]> grouped = new LinkedHashMap<>();
        for (Task task : tasks) {
            String key = task.getPriority() != null ? task.getPriority().name() : "UNSET";
            int[] values = grouped.computeIfAbsent(key, ignored -> new int[]{0, 0});
            values[0] += 1;
            values[1] += task.getStoryPoint();
        }
        return grouped.entrySet().stream()
                .map(entry -> new BurndownBreakdownItemDTO(entry.getKey(), entry.getValue()[0], entry.getValue()[1]))
                .sorted(Comparator.comparing(BurndownBreakdownItemDTO::storyPoints).reversed())
                .toList();
    }

    private List<String> insights(BurndownSummaryDTO summary, LocalDate sprintEnd, LocalDate today) {
        List<String> messages = new ArrayList<>();
        if ("NO_SCOPE".equals(summary.healthStatus())) {
            messages.add("No story points are estimated in this sprint yet.");
            messages.add("Add estimates to make burn rate and forecast useful.");
            return messages;
        }
        if ("COMPLETE".equals(summary.healthStatus())) {
            messages.add("Sprint scope is fully burned down.");
            messages.add("Review completed work before closing the sprint.");
            return messages;
        }
        messages.add(String.format(Locale.US, "%.1f pts/day required to finish on time.", summary.requiredBurnRate()));
        messages.add(String.format(Locale.US, "%.1f pts/day actual burn so far.", summary.actualBurnRate()));
        if (summary.projectedCompletionDate() == null) {
            messages.add("No completion forecast yet because no story points have burned down.");
        } else {
            LocalDate projected = LocalDate.parse(summary.projectedCompletionDate());
            long delta = ChronoUnit.DAYS.between(sprintEnd, projected);
            if (delta > 0) {
                messages.add("Projected " + delta + " day" + (delta == 1 ? "" : "s") + " late at the current burn rate.");
            } else {
                messages.add("Projected to finish within the sprint window.");
            }
        }
        if (today.isAfter(sprintEnd) && summary.remainingStoryPoints() > 0) {
            messages.add("Sprint end date has passed with unfinished scope.");
        }
        return messages;
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "UNSET";
        }
        return status.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
    }

    private double roundOne(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    /**
     * Returns velocity data (committed vs completed story points) for every
     * COMPLETED sprint in the given project. Uses SprintService for the
     * membership auth check.
     *
     * @param projectId     ID of the project
     * @param currentUserId ID of the requesting user
     */
    @Transactional(readOnly = true)
    public List<SprintVelocityDTO> getVelocityData(Long projectId, Long currentUserId) {
        List<SprintResponseDTO> sprints = sprintService.getSprintsByProject(projectId, currentUserId);
        List<SprintResponseDTO> completedSprints = sprints.stream()
                .filter(s -> "COMPLETED".equals(s.getStatus()))
                .toList();
        if (completedSprints.isEmpty()) {
            return List.of();
        }

        List<Long> sprintIds = completedSprints.stream().map(SprintResponseDTO::getId).toList();
        java.util.Map<Long, int[]> velocityBySprintId = new java.util.HashMap<>();
        for (Object[] row : taskRepository.aggregateVelocityBySprintIds(sprintIds)) {
            Long sprintId = (Long) row[0];
            int committed = row[1] != null ? ((Number) row[1]).intValue() : 0;
            int completed = row[2] != null ? ((Number) row[2]).intValue() : 0;
            velocityBySprintId.put(sprintId, new int[]{committed, completed});
        }

        return completedSprints.stream()
                .map(s -> {
                    int[] values = velocityBySprintId.getOrDefault(s.getId(), new int[]{0, 0});
                    return new SprintVelocityDTO(s.getId(), s.getName(), values[0], values[1]);
                })
                .collect(Collectors.toList());
    }
}
