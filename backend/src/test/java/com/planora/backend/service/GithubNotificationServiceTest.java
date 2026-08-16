package com.planora.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import com.planora.backend.dto.GithubCIUpdatePayload;
import com.planora.backend.dto.GithubIssueUpdatePayload;
import com.planora.backend.dto.GithubPRUpdatePayload;
import com.planora.backend.event.CIFailedEvent;
import com.planora.backend.event.IssueLabeledEvent;
import com.planora.backend.event.IssueOpenedEvent;
import com.planora.backend.event.PRMergedEvent;
import com.planora.backend.event.PROpenedEvent;
import com.planora.backend.event.ReleasePublishedEvent;
import com.planora.backend.model.NotificationEventType;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class GithubNotificationServiceTest {

    @Mock
    private NotificationService notificationService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private ApplicationEventPublisher applicationEventPublisher;

    @Mock
    private GithubEventBroadcaster githubEventBroadcaster;

    @InjectMocks
    private GithubNotificationService githubNotificationService;

    private User author;
    private User recipient;
    private Project firstProject;
    private Project secondProject;

    @BeforeEach
    void setUp() {
        author = user(1L, "author");
        recipient = user(2L, "reviewer");

        Team firstTeam = new Team();
        firstTeam.setId(11L);
        Team secondTeam = new Team();
        secondTeam.setId(12L);

        firstProject = new Project();
        firstProject.setId(41L);
        firstProject.setTeam(firstTeam);
        secondProject = new Project();
        secondProject.setId(42L);
        secondProject.setTeam(secondTeam);
    }

    @Test
    void notifyPROpened_broadcastsUpdateAndPublishesEventWithoutCreatingInAppNotifications() {
        when(projectRepository.findByGithubRepoFullNameIgnoreCase("planora/app"))
                .thenReturn(List.of(firstProject, secondProject));

        githubNotificationService.notifyPROpened(
                "planora/app", 17, "Improve sync", "octocat", "feature/planora-123-review");

        String link = "https://github.com/planora/app/pull/17";
        verify(notificationService, never()).createNotificationIfNotDuplicateByLinkAndMessagePrefix(
                any(), any(), any(), any(), any(), any());
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());

        GithubPRUpdatePayload updatePayload = new GithubPRUpdatePayload(
                "opened", 17, "Improve sync", link, "octocat");
        verify(githubEventBroadcaster).broadcastPRUpdate(41L, updatePayload);
        verify(githubEventBroadcaster).broadcastPRUpdate(42L, updatePayload);

        ArgumentCaptor<PROpenedEvent> eventCaptor = ArgumentCaptor.forClass(PROpenedEvent.class);
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture());
        PROpenedEvent event = eventCaptor.getValue();
        assertSame(githubNotificationService, event.getSource());
        assertEquals("planora/app", event.getRepoFullName());
        assertEquals(17, event.getPrNumber());
        assertEquals("Improve sync", event.getPrTitle());
        assertEquals("octocat", event.getAuthorLogin());
        assertEquals("feature/planora-123-review", event.getBranch());
    }

    @Test
    void notifyPROpened_ignoresInvalidRepositoryInput() {
        githubNotificationService.notifyPROpened(" ", 17, "Improve sync", "octocat", "task/123");

        verify(projectRepository, never()).findByGithubRepoFullNameIgnoreCase(org.mockito.ArgumentMatchers.anyString());
        verify(notificationService, never()).createNotificationIfNotDuplicateByLinkAndMessagePrefix(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(applicationEventPublisher, never()).publishEvent(any());
    }

    @Test
    void notifyPRMerged_broadcastsUpdateAndPublishesEventWithoutCreatingInAppNotifications() {
        when(projectRepository.findByGithubRepoFullNameIgnoreCase("planora/app"))
                .thenReturn(List.of(firstProject, secondProject));

        githubNotificationService.notifyPRMerged(
                " planora/app ", 17, "Improve sync", "maintainer", "feature/planora-123-review");

        String link = "https://github.com/planora/app/pull/17";
        verify(notificationService, never()).createNotificationIfNotDuplicateByLinkAndMessagePrefix(
                any(), any(), any(), any(), any(), any());
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());

        GithubPRUpdatePayload updatePayload = new GithubPRUpdatePayload(
                "merged", 17, "Improve sync", link, "maintainer");
        verify(githubEventBroadcaster).broadcastPRUpdate(41L, updatePayload);
        verify(githubEventBroadcaster).broadcastPRUpdate(42L, updatePayload);

        ArgumentCaptor<PRMergedEvent> eventCaptor = ArgumentCaptor.forClass(PRMergedEvent.class);
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture());
        PRMergedEvent event = eventCaptor.getValue();
        assertSame(githubNotificationService, event.getSource());
        assertEquals("planora/app", event.getRepoFullName());
        assertEquals(17, event.getPrNumber());
        assertEquals("Improve sync", event.getPrTitle());
        assertEquals("feature/planora-123-review", event.getBranch());
    }

    @Test
    void notifyPRMerged_ignoresInvalidRepositoryInputWithoutPublishingEvent() {
        githubNotificationService.notifyPRMerged(" ", 17, "Improve sync", "maintainer");

        verify(projectRepository, never()).findByGithubRepoFullNameIgnoreCase(any());
        verify(applicationEventPublisher, never()).publishEvent(any());
    }

    @Test
    void notifyReviewRequested_doesNotCreateInAppNotification() {
        githubNotificationService.notifyReviewRequested(
                " planora/app ", 17, "Improve sync", "requested-reviewer");

        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());
        verify(notificationService, never()).createNotificationIfNotDuplicateByLinkAndMessagePrefix(
                any(), any(), any(), any(), any(), any());
    }

    @Test
    void notifyCIFailed_broadcastsUpdateAndPublishesEventWithoutCreatingInAppNotifications() {
        when(projectRepository.findByGithubRepoFullNameIgnoreCase("planora/app"))
                .thenReturn(List.of(firstProject, secondProject));

        githubNotificationService.notifyCIFailed(
                " planora/app ", "main", "abcdef1234567890", "Backend checks");

        verify(notificationService, never()).createNotificationIfNotDuplicateByLinkAndMessagePrefix(
                any(), any(), any(), any(), any(), any());
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());

        GithubCIUpdatePayload updatePayload = new GithubCIUpdatePayload(
                "Backend checks", "main", "failure", "abcdef1234567890");
        verify(githubEventBroadcaster).broadcastCIUpdate(41L, updatePayload);
        verify(githubEventBroadcaster).broadcastCIUpdate(42L, updatePayload);

        ArgumentCaptor<CIFailedEvent> eventCaptor = ArgumentCaptor.forClass(CIFailedEvent.class);
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture());
        CIFailedEvent event = eventCaptor.getValue();
        assertSame(githubNotificationService, event.getSource());
        assertEquals("planora/app", event.getRepoFullName());
        assertEquals("main", event.getBranch());
        assertEquals("abcdef1234567890", event.getCommitSha());
        assertEquals("Backend checks", event.getWorkflowName());
    }

    @Test
    void notifyCIFailed_ignoresMissingCommitWithoutPublishingEvent() {
        githubNotificationService.notifyCIFailed("planora/app", "main", " ", "Backend checks");

        verify(projectRepository, never()).findByGithubRepoFullNameIgnoreCase(any());
        verify(applicationEventPublisher, never()).publishEvent(any());
    }

    @Test
    void notifyIssueEvent_openedPublishesEventAndBroadcastsWithoutCreatingInAppNotifications() {
        when(projectRepository.findByGithubRepoFullNameIgnoreCase("planora/app"))
                .thenReturn(List.of(firstProject, secondProject));

        githubNotificationService.notifyIssueEvent(
                "planora/app",
                34,
                "Broken sync",
                "opened",
                "octocat",
                "Build fails on main",
                List.of("bug", "backend"));

        verify(notificationService, never()).createNotificationIfNotDuplicateByLinkAndMessagePrefix(
                any(), any(), any(), any(), any(), any());
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());

        GithubIssueUpdatePayload updatePayload = new GithubIssueUpdatePayload(
                "opened", 34, "Broken sync", "octocat");
        verify(githubEventBroadcaster).broadcastIssueUpdate(41L, updatePayload);
        verify(githubEventBroadcaster).broadcastIssueUpdate(42L, updatePayload);

        ArgumentCaptor<IssueOpenedEvent> eventCaptor = ArgumentCaptor.forClass(IssueOpenedEvent.class);
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture());
        assertEquals("planora/app", eventCaptor.getValue().getRepoFullName());
        assertEquals(34, eventCaptor.getValue().getIssueNumber());
        assertEquals("Broken sync", eventCaptor.getValue().getIssueTitle());
        assertEquals("Build fails on main", eventCaptor.getValue().getIssueBody());
        assertEquals("octocat", eventCaptor.getValue().getAuthorLogin());
        assertEquals(List.of("bug", "backend"), eventCaptor.getValue().getLabels());
    }

    @Test
    void notifyIssueEvent_closedBroadcastsWithoutInAppNotification() {
        when(projectRepository.findByGithubRepoFullNameIgnoreCase("planora/app"))
                .thenReturn(List.of(firstProject));

        githubNotificationService.notifyIssueEvent("planora/app", 34, "Broken sync", "closed", "octocat");

        verify(notificationService, never()).createNotificationIfNotDuplicateByLinkAndMessagePrefix(
                any(), any(), any(), any(), any(), any());
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());
        verify(githubEventBroadcaster).broadcastIssueUpdate(41L, new GithubIssueUpdatePayload(
                "closed", 34, "Broken sync", "octocat"));
    }

    @Test
    void notifyIssueEvent_labeledPublishesEventAndBroadcastsWithoutInAppNotifications() {
        when(projectRepository.findByGithubRepoFullNameIgnoreCase("planora/app"))
                .thenReturn(List.of(firstProject));

        githubNotificationService.notifyIssueEvent(
                "planora/app",
                34,
                "Broken sync",
                "labeled",
                "octocat",
                "",
                List.of("ready-for-review"),
                "ready-for-review",
                "5319e7");

        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());
        ArgumentCaptor<IssueLabeledEvent> eventCaptor = ArgumentCaptor.forClass(IssueLabeledEvent.class);
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture());
        assertEquals("planora/app", eventCaptor.getValue().getRepoFullName());
        assertEquals(34, eventCaptor.getValue().getIssueNumber());
        assertEquals("Broken sync", eventCaptor.getValue().getIssueTitle());
        assertEquals("ready-for-review", eventCaptor.getValue().getLabelName());
        assertEquals("5319e7", eventCaptor.getValue().getLabelColor());
    }

    @Test
    void notifyIssueEvent_assignedBroadcastsWithoutInAppNotification() {
        when(projectRepository.findByGithubRepoFullNameIgnoreCase("planora/app"))
                .thenReturn(List.of(firstProject));

        githubNotificationService.notifyIssueEvent(
                "planora/app", 34, "Broken sync", "assigned", "assigned-user");

        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());
        verify(githubEventBroadcaster).broadcastIssueUpdate(eq(41L), eq(new GithubIssueUpdatePayload(
                "assigned", 34, "Broken sync", "assigned-user")));
    }

    @Test
    void notifyRelease_publishesEventWithoutInAppNotifications() {
        githubNotificationService.notifyRelease(
                " planora/app ", "v2.0.0", "Planora 2.0", " https://github.com/planora/app/releases/tag/v2.0.0 ");

        String link = "https://github.com/planora/app/releases/tag/v2.0.0";
        verify(notificationService, never()).createNotificationIfNotDuplicateByLinkAndMessagePrefix(
                any(), any(), any(), any(), any(), any());
        verify(notificationService, never()).createNotification(any(), any(), any(), any(), any());

        ArgumentCaptor<ReleasePublishedEvent> eventCaptor = ArgumentCaptor.forClass(ReleasePublishedEvent.class);
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture());
        ReleasePublishedEvent event = eventCaptor.getValue();
        assertEquals("planora/app", event.getRepoFullName());
        assertEquals("v2.0.0", event.getTagName());
        assertEquals("Planora 2.0", event.getReleaseName());
        assertEquals(link, event.getReleaseUrl());
    }

    @Test
    void notifyRelease_ignoresMissingReleaseUrlWithoutPublishingEvent() {
        githubNotificationService.notifyRelease("planora/app", "v2.0.0", "Planora 2.0", " ");

        verify(projectRepository, never()).findByGithubRepoFullNameIgnoreCase(any());
        verify(applicationEventPublisher, never()).publishEvent(any());
    }

    private User user(Long id, String username) {
        User user = new User();
        user.setUserId(id);
        user.setUsername(username);
        return user;
    }

    private TeamMember member(User user) {
        TeamMember member = new TeamMember();
        member.setUser(user);
        return member;
    }
}
