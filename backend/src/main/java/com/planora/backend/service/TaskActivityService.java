package com.planora.backend.service;

import com.planora.backend.dto.TaskActivityResponseDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskActivity;
import com.planora.backend.model.TaskActivityType;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.repository.TaskActivityRepository;
import com.planora.backend.repository.TaskRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskActivityService {

    private final TaskActivityRepository taskActivityRepository;
    private final TaskRepository taskRepository;
    private final TeamMembershipLookupService teamMembershipLookupService;

    @Transactional
    public void logActivity(Long taskId, TaskActivityType type, String actorName, String description) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found"));
        TaskActivity activity = new TaskActivity();
        activity.setTask(task);
        activity.setActivityType(type);
        activity.setActorName(actorName != null ? actorName : "System");
        activity.setDescription(description);
        taskActivityRepository.save(activity);
    }

    @Transactional(readOnly = true)
    public List<TaskActivityResponseDTO> getActivities(Long taskId, Long currentUserId) {
        Task task = taskRepository.findByIdWithProjectTeam(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        Long teamId = task.getProject().getTeam().getId();
        // Task read policy: any team member, including viewers, may read task data.
        requireMinimumRole(teamId, currentUserId, null);
        return taskActivityRepository.findByTaskIdOrderByCreatedAtDesc(taskId).stream()
                .map(a -> TaskActivityResponseDTO.builder()
                        .id(a.getId())
                        .activityType(a.getActivityType().name())
                        .actorName(a.getActorName())
                        .description(a.getDescription())
                        .createdAt(a.getCreatedAt().toString())
                        .build())
                .collect(Collectors.toList());
    }

    private TeamMember requireMinimumRole(Long teamId, Long userId, TeamRole minimumRole) {
        TeamMember member = teamMembershipLookupService.getTeamMember(teamId, userId);
        if (member == null) {
            throw new ForbiddenException("User is not a member of this team");
        }
        if (minimumRole != null && roleRank(member.getRole()) < roleRank(minimumRole)) {
            throw new ForbiddenException("Insufficient permissions: requires " + minimumRole + " or higher");
        }
        return member;
    }

    private int roleRank(TeamRole role) {
        return switch (role) {
            case OWNER -> 4;
            case ADMIN -> 3;
            case MEMBER -> 2;
            case VIEWER -> 1;
        };
    }
}
