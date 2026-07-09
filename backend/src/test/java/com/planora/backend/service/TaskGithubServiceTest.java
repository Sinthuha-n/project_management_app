package com.planora.backend.service;

import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.repository.GithubCommitRepository;
import com.planora.backend.repository.GithubPullRequestRepository;
import com.planora.backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskGithubServiceTest {

    @Mock
    private GithubPullRequestRepository prRepository;
    @Mock
    private GithubCommitRepository commitRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TeamMembershipLookupService teamMembershipLookupService;
    @Mock
    private GitHubIntegrationService gitHubIntegrationService;
    @Mock
    private TaskActivityService taskActivityService;
    @Mock
    private CiStatusResolver ciStatusResolver;

    @InjectMocks
    private TaskGithubService taskGithubService;

    @BeforeEach
    void setUp() {
        Team team = new Team();
        team.setId(20L);
        Project project = new Project();
        project.setTeam(team);
        Task task = new Task();
        task.setId(1L);
        task.setProject(project);

        when(taskRepository.findByIdWithProjectTeam(1L)).thenReturn(Optional.of(task));
        when(teamMembershipLookupService.getTeamMember(20L, 999L)).thenReturn(null);
    }

    @Test
    void githubReadEndpoints_throwForbidden_whenUserIsNotTeamMember() {
        assertAll(
                () -> assertForbidden(() -> taskGithubService.getTaskGithubSummary(1L, 999L)),
                () -> assertForbidden(() -> taskGithubService.syncAndGetSummary(1L, "owner/repo", "token", 999L)),
                () -> assertForbidden(() -> taskGithubService.getLinkedPrs(1L, 999L)),
                () -> assertForbidden(() -> taskGithubService.syncAndGetLinkedPrs(1L, "owner/repo", "token", 999L)),
                () -> assertForbidden(() -> taskGithubService.getLinkedCommits(1L, 20, 999L)),
                () -> assertForbidden(() -> taskGithubService.syncAndGetLinkedCommits(1L, "owner/repo", "token", 20, 999L))
        );

        verifyNoInteractions(gitHubIntegrationService);
    }

    private void assertForbidden(Runnable invocation) {
        ForbiddenException exception = assertThrows(ForbiddenException.class, invocation::run);
        assertEquals("User is not a member of this team", exception.getMessage());
    }
}
