package com.planora.backend.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.service.CiStatusResolver;
import com.planora.backend.service.GithubNotificationService;
import com.planora.backend.service.GithubWebhookDeliveryService;
import com.planora.backend.service.TaskGithubService;
import com.planora.backend.util.GithubWebhookSignatureVerifier;

class GitHubWebhookControllerTest {

    private static final String SECRET = "webhook-test-secret";
    private static final String OPENED_PR_BODY = """
            {
              "action":"opened",
              "repository":{"full_name":"planora/app"},
              "pull_request":{"number":17,"title":"Improve sync","user":{"login":"octocat"},"head":{"ref":"feature/planora-123-review"}}
            }
            """;
    private static final String MERGED_PR_BODY = """
            {
              "action":"closed",
              "repository":{"full_name":"planora/app"},
              "pull_request":{"number":17,"title":"Improve sync","merged":true,"merged_by":{"login":"maintainer"},"head":{"ref":"feature/planora-123-review"}}
            }
            """;
    private static final String REVIEW_REQUESTED_BODY = """
            {
              "action":"review_requested",
              "repository":{"full_name":"planora/app"},
              "pull_request":{"number":17,"title":"Improve sync"},
              "requested_reviewer":{"login":"reviewer"}
            }
            """;
    private static final String FAILED_WORKFLOW_BODY = """
            {
              "action":"completed",
              "repository":{"full_name":"planora/app"},
              "workflow_run":{
                "name":"Backend checks",
                "head_branch":"main",
                "head_sha":"abcdef1234567890",
                "conclusion":"failure"
              }
            }
            """;
    private static final String SUCCESSFUL_WORKFLOW_BODY = """
            {
              "action":"completed",
              "repository":{"full_name":"planora/app"},
              "workflow_run":{
                "name":"Backend checks",
                "head_branch":"main",
                "head_sha":"abcdef1234567890",
                "conclusion":"success"
              }
            }
            """;
    private static final String ASSIGNED_ISSUE_BODY = """
            {
              "action":"assigned",
              "repository":{"full_name":"planora/app"},
              "issue":{"number":34,"title":"Broken sync"},
              "sender":{"login":"maintainer"},
              "assignee":{"login":"assigned-user"}
            }
            """;
    private static final String OPENED_ISSUE_BODY = """
            {
              "action":"opened",
              "repository":{"full_name":"planora/app"},
              "issue":{
                "number":34,
                "title":"Broken sync",
                "body":"Build fails on main",
                "labels":[{"name":"bug"},{"name":"backend"}]
              },
              "sender":{"login":"octocat"}
            }
            """;
    private static final String LABELED_ISSUE_BODY = """
            {
              "action":"labeled",
              "repository":{"full_name":"planora/app"},
              "issue":{
                "number":34,
                "title":"Broken sync",
                "labels":[{"name":"ready-for-review","color":"5319e7"}]
              },
              "sender":{"login":"octocat"},
              "label":{"name":"ready-for-review","color":"5319e7"}
            }
            """;
    private static final String PUBLISHED_RELEASE_BODY = """
            {
              "action":"published",
              "repository":{"full_name":"planora/app"},
              "release":{
                "tag_name":"v2.0.0",
                "name":"Planora 2.0",
                "html_url":"https://github.com/planora/app/releases/tag/v2.0.0"
              }
            }
            """;
    private static final String EDITED_RELEASE_BODY = """
            {
              "action":"edited",
              "repository":{"full_name":"planora/app"},
              "release":{
                "tag_name":"v2.0.0",
                "name":"Planora 2.0",
                "html_url":"https://github.com/planora/app/releases/tag/v2.0.0"
              }
            }
            """;

    private MockMvc mockMvc;
    private GithubNotificationService githubNotificationService;
    private GithubWebhookDeliveryService webhookDeliveryService;

    @BeforeEach
    void setUp() {
        githubNotificationService = mock(GithubNotificationService.class);
        webhookDeliveryService = mock(GithubWebhookDeliveryService.class);
        org.mockito.Mockito.when(webhookDeliveryService.registerIfNew(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(true);
        CiStatusResolver ciStatusResolver = mock(CiStatusResolver.class);
        TaskGithubService taskGithubService = mock(TaskGithubService.class);
        ObjectMapper objectMapper = new ObjectMapper();

        GitHubWebhookController controller = new GitHubWebhookController(
                ciStatusResolver,
                taskGithubService,
                githubNotificationService,
                objectMapper,
                new GithubWebhookSignatureVerifier(SECRET),
                webhookDeliveryService
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void singularWebhookRoute_dispatchesSignedOpenedPullRequest() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "pull_request")
                        .header("X-Hub-Signature-256", signature(OPENED_PR_BODY))
                        .content(OPENED_PR_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("processed"));

        verify(githubNotificationService).notifyPROpened(
                "planora/app", 17, "Improve sync", "octocat", "feature/planora-123-review");
    }

    @Test
    void webhook_dispatchesMergedPullRequest() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "pull_request")
                        .header("X-Hub-Signature-256", signature(MERGED_PR_BODY))
                        .content(MERGED_PR_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("processed"));

        verify(githubNotificationService).notifyPRMerged(
                "planora/app", 17, "Improve sync", "maintainer", "feature/planora-123-review");
    }

    @Test
    void webhook_dispatchesReviewRequestedPullRequest() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "pull_request")
                        .header("X-Hub-Signature-256", signature(REVIEW_REQUESTED_BODY))
                        .content(REVIEW_REQUESTED_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("processed"));

        verify(githubNotificationService).notifyReviewRequested("planora/app", 17, "Improve sync", "reviewer");
    }

    @Test
    void webhook_dispatchesCompletedFailedWorkflowRun() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "workflow_run")
                        .header("X-Hub-Signature-256", signature(FAILED_WORKFLOW_BODY))
                        .content(FAILED_WORKFLOW_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("processed"));

        verify(githubNotificationService).notifyCIFailed(
                "planora/app", "main", "abcdef1234567890", "Backend checks");
    }

    @Test
    void webhook_ignoresSuccessfulWorkflowRun() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "workflow_run")
                        .header("X-Hub-Signature-256", signature(SUCCESSFUL_WORKFLOW_BODY))
                        .content(SUCCESSFUL_WORKFLOW_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("ignored"));

        verify(githubNotificationService, never()).notifyCIFailed(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void webhook_dispatchesAssignedIssueUsingAssigneeLogin() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "issues")
                        .header("X-Hub-Signature-256", signature(ASSIGNED_ISSUE_BODY))
                        .content(ASSIGNED_ISSUE_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("processed"));

        verify(githubNotificationService).notifyIssueEvent(
                "planora/app", 34, "Broken sync", "assigned", "assigned-user", "", java.util.List.of(), "", "");
    }

    @Test
    void webhook_dispatchesOpenedIssueWithAutomationPayload() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "issues")
                        .header("X-Hub-Signature-256", signature(OPENED_ISSUE_BODY))
                        .content(OPENED_ISSUE_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("processed"));

        verify(githubNotificationService).notifyIssueEvent(
                "planora/app",
                34,
                "Broken sync",
                "opened",
                "octocat",
                "Build fails on main",
                java.util.List.of("bug", "backend"),
                "",
                "");
    }

    @Test
    void webhook_dispatchesLabeledIssueWithAppliedLabel() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "issues")
                        .header("X-Hub-Signature-256", signature(LABELED_ISSUE_BODY))
                        .content(LABELED_ISSUE_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("processed"));

        verify(githubNotificationService).notifyIssueEvent(
                "planora/app",
                34,
                "Broken sync",
                "labeled",
                "octocat",
                "",
                java.util.List.of("ready-for-review"),
                "ready-for-review",
                "5319e7");
    }

    @Test
    void webhook_dispatchesPublishedReleaseWithGithubReleaseUrl() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "release")
                        .header("X-Hub-Signature-256", signature(PUBLISHED_RELEASE_BODY))
                        .content(PUBLISHED_RELEASE_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("processed"));

        verify(githubNotificationService).notifyRelease(
                "planora/app", "v2.0.0", "Planora 2.0",
                "https://github.com/planora/app/releases/tag/v2.0.0");
    }

    @Test
    void webhook_ignoresReleaseActionsOtherThanPublished() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "release")
                        .header("X-Hub-Signature-256", signature(EDITED_RELEASE_BODY))
                        .content(EDITED_RELEASE_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string("ignored"));

        verify(githubNotificationService, never()).notifyRelease(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void webhook_rejectsInvalidSignatureBeforeDispatch() throws Exception {
        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "pull_request")
                        .header("X-Hub-Signature-256", "sha256=deadbeef")
                        .content(OPENED_PR_BODY))
                .andExpect(status().isUnauthorized());

        verify(githubNotificationService, never()).notifyPROpened(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void webhook_rejectsDeliveriesWhenSecretIsNotConfigured() throws Exception {
        GitHubWebhookController controller = new GitHubWebhookController(
                mock(CiStatusResolver.class),
                mock(TaskGithubService.class),
                githubNotificationService,
                new ObjectMapper(),
                new GithubWebhookSignatureVerifier(""),
                mock(GithubWebhookDeliveryService.class)
        );
        MockMvc unconfiguredMockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        unconfiguredMockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "pull_request")
                        .header("X-Hub-Signature-256", signature(OPENED_PR_BODY))
                        .content(OPENED_PR_BODY))
                .andExpect(status().isServiceUnavailable());
    }

    private String signature(String body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }
}
