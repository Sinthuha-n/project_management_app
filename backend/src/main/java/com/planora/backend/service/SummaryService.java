package com.planora.backend.service;

import com.planora.backend.dto.*;
import com.planora.backend.model.Project;
import com.planora.backend.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
// Aggregates all project-related data into a single Backend-For-Frontend (BFF) payload for the summary dashboard.
public class SummaryService {

    private final ProjectService projectService;
    private final TaskService taskService;
    private final SprintService sprintService;
    private final ProjectPageService projectPageService;
    private final MilestoneService milestoneService;
    private final TeamMemberService teamMemberService;
    private final ProjectRepository projectRepository;
    private final UserService userService;
    private final com.planora.backend.repository.TaskRepository taskRepository;

    @Transactional(readOnly = true)
    public SummaryPageDTO getDashboardSummary(Long projectId, Long userId) {
        // Fetch base project details and check user access.
        ProjectResponseDTO projectDetails = projectService.getProjectByIdForUser(projectId, userId);
        
        // Fetch project metrics (task counts, sprint health, etc.).
        ProjectMetricsDTO metrics = projectService.getProjectMetrics(projectId);
        
        // Fetch all tasks for the project.
        List<TaskResponseDTO> tasks = taskService.getTasksByProject(projectId, userId, null, null, null, null, null);
        
        // Fetch sprints associated with the project.
        List<SprintResponseDTO> sprints = sprintService.getSprintsByProject(projectId, userId);
        
        // Fetch lightweight page summaries (documentation).
        List<PageSummaryResponseDto> pages = projectPageService.getProjectPages(projectId, userId);
        
        // Fetch project milestones.
        List<MilestoneResponseDTO> milestones = milestoneService.getMilestonesByProject(projectId, userId);
        
        // Fetch team members with task counts and presigned avatars.
        // We replicate some logic from ProjectMemberController for efficient member mapping.
        Project project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        Long teamId = project.getTeam().getId();
        teamMemberService.validateMembership(teamId, userId);
        
        List<com.planora.backend.model.TeamMember> memberEntities = teamMemberService.getTeamMembers(teamId);
        List<Long> userIds = memberEntities.stream()
                .map(m -> m.getUser() != null ? m.getUser().getUserId() : null)
                .filter(java.util.Objects::nonNull)
                .toList();
        
        java.util.Map<Long, Long> taskCountByUserId = userIds.isEmpty() ? java.util.Map.of() 
            : taskRepository.countTasksByAssigneeUserIdsAndTeamId(userIds, teamId).stream()
                .collect(Collectors.toMap(row -> (Long) row[0], row -> ((Number) row[1]).longValue()));
                
        List<TeamMemberResponseDTO> members = memberEntities.stream().map(member -> TeamMemberResponseDTO.builder()
                .id(member.getId())
                .role(member.getRole().name())
                .user(TeamMemberResponseDTO.UserInfo.builder()
                        .userId(member.getUser().getUserId())
                        .username(member.getUser().getUsername())
                        .fullName(member.getUser().getFullName())
                        .email(member.getUser().getEmail())
                        .githubUsername(member.getUser().getGithubUsername())
                        .githubEmail(member.getUser().getGithubEmail())
                        .profilePicUrl(userService.generatePresignedUrl(member.getUser().getProfilePicUrl()))
                        .build())
                .lastActive(member.getUser().getLastActive())
                .taskCount(taskCountByUserId.getOrDefault(member.getUser().getUserId(), 0L))
                .status("Active")
                .build()).collect(Collectors.toList());

        return SummaryPageDTO.builder()
                .projectDetails(projectDetails)
                .metrics(metrics)
                .tasks(tasks)
                .sprints(sprints)
                .pages(pages)
                .milestones(milestones)
                .members(members)
                .build();
    }
}
