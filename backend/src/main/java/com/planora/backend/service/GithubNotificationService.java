package com.planora.backend.service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.planora.backend.dto.GithubCIUpdatePayload;
import com.planora.backend.dto.GithubIssueUpdatePayload;
import com.planora.backend.dto.GithubPRUpdatePayload;
import com.planora.backend.event.CIFailedEvent;
import com.planora.backend.event.IssueLabeledEvent;
import com.planora.backend.event.IssueOpenedEvent;
import com.planora.backend.event.PRMergedEvent;
import com.planora.backend.event.PROpenedEvent;
import com.planora.backend.event.ReleasePublishedEvent;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GithubNotificationService {

    private static final Logger log = LoggerFactory.getLogger(GithubNotificationService.class);

    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final GithubEventBroadcaster githubEventBroadcaster;

    private void ensureDependenciesInjected() {
        if (notificationService == null || userRepository == null
                || projectRepository == null || taskRepository == null || teamMemberRepository == null
                || applicationEventPublisher == null || githubEventBroadcaster == null) {
            throw new IllegalStateException("GitHub notification dependencies were not injected");
        }
    }

    public void notifyPROpened(
            String repoFullName,
            int prNumber,
            String prTitle,
            String authorGithubLogin,
            String branch) {
        ensureDependenciesInjected();
        if (repoFullName == null || repoFullName.isBlank() || prNumber <= 0) {
            return;
        }

        String normalizedRepoFullName = repoFullName.trim();
        List<Project> projects = projectRepository.findByGithubRepoFullNameIgnoreCase(normalizedRepoFullName);
        String link = "https://github.com/" + normalizedRepoFullName + "/pull/" + prNumber;

        broadcastPRUpdate(projects, new GithubPRUpdatePayload(
                "opened", prNumber, safeTitle(prTitle), link, safeLogin(authorGithubLogin)));

        applicationEventPublisher.publishEvent(new PROpenedEvent(
                this,
                normalizedRepoFullName,
                prNumber,
                safeTitle(prTitle),
                safeLogin(authorGithubLogin),
                safeText(branch)));
    }

    public void notifyPRMerged(String repoFullName, int prNumber, String prTitle, String mergerGithubLogin) {
        notifyPRMerged(repoFullName, prNumber, prTitle, mergerGithubLogin, "");
    }

    public void notifyPRMerged(
            String repoFullName,
            int prNumber,
            String prTitle,
            String mergerGithubLogin,
            String branch) {
        ensureDependenciesInjected();
        if (repoFullName == null || repoFullName.isBlank() || prNumber <= 0) {
            return;
        }

        String normalizedRepoFullName = repoFullName.trim();
        List<Project> projects = projectRepository.findByGithubRepoFullNameIgnoreCase(normalizedRepoFullName);
        String link = "https://github.com/" + normalizedRepoFullName + "/pull/" + prNumber;

        broadcastPRUpdate(projects, new GithubPRUpdatePayload(
                "merged", prNumber, safeTitle(prTitle), link, safeLogin(mergerGithubLogin)));

        applicationEventPublisher.publishEvent(
                new PRMergedEvent(this, normalizedRepoFullName, prNumber, safeTitle(prTitle), safeText(branch)));
    }

    public void notifyReviewRequested(String repoFullName, int prNumber, String prTitle, String reviewerGithubLogin) {
        ensureDependenciesInjected();
        // In-app notifications for GitHub activity have been removed.
    }

    public void notifyCIFailed(String repoFullName, String branch, String commitSha, String workflowName) {
        ensureDependenciesInjected();
        if (repoFullName == null || repoFullName.isBlank()
                || commitSha == null || commitSha.isBlank()) {
            return;
        }

        String normalizedRepoFullName = repoFullName.trim();
        String normalizedCommitSha = commitSha.trim();
        List<Project> projects = projectRepository.findByGithubRepoFullNameIgnoreCase(normalizedRepoFullName);

        broadcastCIUpdate(projects, new GithubCIUpdatePayload(
                safeText(workflowName), safeText(branch), "failure", normalizedCommitSha));

        applicationEventPublisher.publishEvent(new CIFailedEvent(
                this, normalizedRepoFullName, safeText(branch), normalizedCommitSha, safeText(workflowName)));
    }

    public void notifyIssueEvent(
            String repoFullName,
            int issueNumber,
            String issueTitle,
            String action,
            String actorGithubLogin) {
        notifyIssueEvent(repoFullName, issueNumber, issueTitle, action, actorGithubLogin, "", List.of(), "", "");
    }

    public void notifyIssueEvent(
            String repoFullName,
            int issueNumber,
            String issueTitle,
            String action,
            String actorGithubLogin,
            String issueBody,
            List<String> labels) {
        notifyIssueEvent(repoFullName, issueNumber, issueTitle, action, actorGithubLogin, issueBody, labels, "", "");
    }

    public void notifyIssueEvent(
            String repoFullName,
            int issueNumber,
            String issueTitle,
            String action,
            String actorGithubLogin,
            String issueBody,
            List<String> labels,
            String labelName,
            String labelColor) {
        ensureDependenciesInjected();
        if (repoFullName == null || repoFullName.isBlank() || issueNumber <= 0 || action == null) {
            return;
        }
        if (!Set.of("opened", "closed", "labeled", "assigned").contains(action)) {
            return;
        }

        String normalizedRepoFullName = repoFullName.trim();
        List<Project> projects = projectRepository.findByGithubRepoFullNameIgnoreCase(normalizedRepoFullName);
        GithubIssueUpdatePayload updatePayload = new GithubIssueUpdatePayload(
                action, issueNumber, safeTitle(issueTitle), safeLogin(actorGithubLogin));

        switch (action) {
            case "opened" -> {
                applicationEventPublisher.publishEvent(new IssueOpenedEvent(
                        this,
                        normalizedRepoFullName,
                        issueNumber,
                        safeTitle(issueTitle),
                        safeText(issueBody),
                        safeLogin(actorGithubLogin),
                        labels));
            }
            case "closed" -> {
                // Issue closed event handled
            }
            case "labeled" -> {
                applicationEventPublisher.publishEvent(new IssueLabeledEvent(
                        this,
                        normalizedRepoFullName,
                        issueNumber,
                        safeTitle(issueTitle),
                        safeText(labelName),
                        safeText(labelColor)));
            }
            case "assigned" -> {
                // Issue assigned handled
            }
            default -> {
            }
        }
        broadcastIssueUpdate(projects, updatePayload);
    }

    public void notifyRelease(String repoFullName, String tagName, String releaseName, String releaseUrl) {
        ensureDependenciesInjected();
        if (repoFullName == null || repoFullName.isBlank()
                || releaseUrl == null || releaseUrl.isBlank()) {
            return;
        }

        String normalizedRepoFullName = repoFullName.trim();
        String normalizedReleaseUrl = releaseUrl.trim();

        applicationEventPublisher.publishEvent(new ReleasePublishedEvent(
                this, normalizedRepoFullName, safeText(tagName), safeText(releaseName), normalizedReleaseUrl));
    }

    public List<User> resolveUsersFromGithubLogin(String githubLogin) {
        ensureDependenciesInjected();
        if (githubLogin == null || githubLogin.isBlank()) {
            return Collections.emptyList();
        }

        return userRepository.findByGithubUsernameIgnoreCase(githubLogin);
    }

    private String safeTitle(String title) {
        return title == null ? "" : title;
    }

    private String safeLogin(String login) {
        return login == null ? "" : login;
    }

    private String safeText(String text) {
        return text == null ? "" : text;
    }

    private Map<Long, User> projectMemberRecipients(List<Project> projects) {
        Map<Long, User> recipients = new LinkedHashMap<>();
        for (Project project : projects) {
            if (project.getTeam() == null || project.getTeam().getId() == null) {
                continue;
            }
            for (TeamMember member : teamMemberRepository.findByTeamId(project.getTeam().getId())) {
                User user = member.getUser();
                if (user != null && user.getUserId() != null) {
                    recipients.putIfAbsent(user.getUserId(), user);
                }
            }
        }
        return recipients;
    }

    private void broadcastPRUpdate(List<Project> projects, GithubPRUpdatePayload payload) {
        for (Project project : projects) {
            if (project.getId() != null) {
                githubEventBroadcaster.broadcastPRUpdate(project.getId(), payload);
            }
        }
    }

    private void broadcastCIUpdate(List<Project> projects, GithubCIUpdatePayload payload) {
        for (Project project : projects) {
            if (project.getId() != null) {
                githubEventBroadcaster.broadcastCIUpdate(project.getId(), payload);
            }
        }
    }

    private void broadcastIssueUpdate(List<Project> projects, GithubIssueUpdatePayload payload) {
        for (Project project : projects) {
            if (project.getId() != null) {
                githubEventBroadcaster.broadcastIssueUpdate(project.getId(), payload);
            }
        }
    }
}
