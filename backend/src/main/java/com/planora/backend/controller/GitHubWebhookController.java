package com.planora.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.model.CiStatus;
import com.planora.backend.service.CiStatusResolver;
import com.planora.backend.service.GithubNotificationService;
import com.planora.backend.service.TaskGithubService;
import com.planora.backend.service.GithubWebhookDeliveryService;
import com.planora.backend.util.GithubWebhookSignatureVerifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

import lombok.RequiredArgsConstructor;

/**
 * Receives GitHub webhook events and applies real-time CI status updates to tasks.
 *
 * Endpoints: POST /api/github/webhook and POST /api/github/webhooks
 *
 * Supported event types (via X-GitHub-Event header):
 *   check_run  — updates ci_status on the matching commit row when a check run completes
 *   ping       — accepted and acknowledged (GitHub sends this on webhook creation)
 *
 * Notification event types are routed to {@link GithubNotificationService};
 * CI check-run events continue to update linked task status.
 *
 * Security:
 *   GitHub signs every delivery with HMAC-SHA256 using the configured webhook secret.
 *   The signature is compared using a constant-time algorithm to prevent timing attacks.
 *   Requests are rejected until GITHUB_WEBHOOK_SECRET is configured.
 */
@RestController
@RequestMapping({"/api/github/webhook", "/api/github/webhooks"})
@RequiredArgsConstructor
public class GitHubWebhookController {

    private static final Logger log = LoggerFactory.getLogger(GitHubWebhookController.class);

    private final CiStatusResolver ciStatusResolver;

    private final TaskGithubService taskGithubService;

    private final GithubNotificationService githubNotificationService;

    private final ObjectMapper objectMapper;

    private final GithubWebhookSignatureVerifier signatureVerifier;
    private final GithubWebhookDeliveryService webhookDeliveryService;

    /**
     * Main webhook receiver. Reads the body as a raw string so the exact bytes
     * can be used for HMAC-SHA256 signature validation before parsing JSON.
     *
     * @param eventType value of the X-GitHub-Event header (e.g. "check_run", "ping")
     * @param signature value of the X-Hub-Signature-256 header (e.g. "sha256=abc…")
     * @param rawBody   raw request body as text — preserved for HMAC computation
     */
    @PostMapping(consumes = "application/json")
    public ResponseEntity<String> handleWebhook(
            @RequestHeader(value = "X-GitHub-Event",      defaultValue = "") String eventType,
            @RequestHeader(value = "X-Hub-Signature-256", defaultValue = "") String signature,
            @RequestHeader(value = "X-GitHub-Delivery", required = false) String deliveryId,
            @RequestBody String rawBody) {

        if (!signatureVerifier.isConfigured()) {
            log.error("GitHub webhook rejected because GITHUB_WEBHOOK_SECRET is not configured");
            return ResponseEntity.status(503).body("Webhook secret is not configured");
        }
        if (!signatureVerifier.isValid(rawBody, signature)) {
            log.warn("GitHub webhook rejected: invalid signature for event '{}'", eventType);
            return ResponseEntity.status(401).body("Invalid signature");
        }
        if (!webhookDeliveryService.registerIfNew(deliveryId, eventType)) {
            log.info("Ignoring duplicate GitHub webhook delivery {}", deliveryId);
            return ResponseEntity.ok("duplicate");
        }
        JsonNode body;
        try {
            body = objectMapper.readTree(rawBody);
        } catch (Exception e) {
            log.error("Failed to parse GitHub webhook body", e);
            return ResponseEntity.badRequest().body("Malformed JSON");
        }

        return switch (eventType) {
            case "pull_request" -> handlePullRequest(body);
            case "issues"       -> handleIssue(body);
            case "release"      -> handleRelease(body);
            case "check_run" -> handleCheckRun(body);
            case "workflow_run" -> handleWorkflowRun(body);
            case "ping"      -> ResponseEntity.ok("pong");
            default          -> {
                log.debug("GitHub webhook event '{}' received — no action taken", eventType);
                yield ResponseEntity.ok("ignored");
            }
        };
    }

    // ── Event handlers ────────────────────────────────────────────────────────────

    /**
     * Handles a {@code check_run} event.
     *
     * Resolves the CI status from the event payload and persists it to every
     * commit row in the DB that matches the {@code head_sha}. Skips writes when
     * the resolved status is UNKNOWN to avoid overwriting useful existing data.
     *
     * Webhook body shape:
     * <pre>
     * {
     *   "action": "completed" | "created" | "rerequested" | "requested_action",
     *   "check_run": {
     *     "status":     "completed" | "in_progress" | "queued",
     *     "conclusion": "success" | "failure" | ...,
     *     "head_sha":   "<40-char SHA>"
     *   }
     * }
     * </pre>
     */
    /** Dispatches pull request lifecycle events to notification handlers. */
    private ResponseEntity<String> handlePullRequest(JsonNode body) {
        String action = body.path("action").asText("");
        String repoFullName = repositoryFullName(body);
        JsonNode pullRequest = body.path("pull_request");
        int prNumber = pullRequest.path("number").asInt(body.path("number").asInt(0));
        String title = pullRequest.path("title").asText("");

        if (repoFullName.isBlank() || prNumber <= 0) {
            return ResponseEntity.badRequest().body("Missing pull request repository or number");
        }

        switch (action) {
            case "opened" -> githubNotificationService.notifyPROpened(
                    repoFullName,
                    prNumber,
                    title,
                    loginAt(pullRequest, "user"),
                    pullRequest.path("head").path("ref").asText(""));
            case "closed" -> {
                if (pullRequest.path("merged").asBoolean(false)) {
                    githubNotificationService.notifyPRMerged(
                            repoFullName,
                            prNumber,
                            title,
                            loginAt(pullRequest, "merged_by"),
                            pullRequest.path("head").path("ref").asText(""));
                }
            }
            case "review_requested" -> githubNotificationService.notifyReviewRequested(
                    repoFullName, prNumber, title, loginAt(body, "requested_reviewer"));
            default -> {
                return ResponseEntity.ok("ignored");
            }
        }
        return ResponseEntity.ok("processed");
    }

    private ResponseEntity<String> handleIssue(JsonNode body) {
        JsonNode issue = body.path("issue");
        String action = body.path("action").asText("");
        String repoFullName = repositoryFullName(body);
        int issueNumber = issue.path("number").asInt(0);
        if (repoFullName.isBlank() || issueNumber <= 0) {
            return ResponseEntity.badRequest().body("Missing issue repository or number");
        }
        String relevantLogin = "assigned".equals(action)
                ? loginAt(body, "assignee")
                : loginAt(body, "sender");
        if ("assigned".equals(action) && relevantLogin.isBlank()) {
            relevantLogin = loginAt(issue, "assignee");
        }
        githubNotificationService.notifyIssueEvent(
                repoFullName,
                issueNumber,
                issue.path("title").asText(""),
                action,
                relevantLogin,
                issue.path("body").asText(""),
                issueLabels(issue),
                body.path("label").path("name").asText(""),
                body.path("label").path("color").asText(""));
        return ResponseEntity.ok("processed");
    }

    private ResponseEntity<String> handleRelease(JsonNode body) {
        if (!"published".equals(body.path("action").asText(""))) {
            return ResponseEntity.ok("ignored");
        }

        String repoFullName = repositoryFullName(body);
        JsonNode release = body.path("release");
        String releaseUrl = release.path("html_url").asText("").trim();
        if (repoFullName.isBlank() || release.isMissingNode() || releaseUrl.isBlank()) {
            return ResponseEntity.badRequest().body("Missing release repository or payload");
        }
        githubNotificationService.notifyRelease(
                repoFullName,
                release.path("tag_name").asText(""),
                release.path("name").asText(""),
                releaseUrl);
        return ResponseEntity.ok("processed");
    }

    private ResponseEntity<String> handleWorkflowRun(JsonNode body) {
        JsonNode workflowRun = body.path("workflow_run");
        if (!"completed".equals(body.path("action").asText(""))
                || !"failure".equals(workflowRun.path("conclusion").asText(""))) {
            return ResponseEntity.ok("ignored");
        }

        String repoFullName = repositoryFullName(body);
        String commitSha = workflowRun.path("head_sha").asText("").trim();
        if (repoFullName.isBlank() || commitSha.isBlank()) {
            return ResponseEntity.badRequest().body("Missing workflow repository or commit SHA");
        }

        githubNotificationService.notifyCIFailed(
                repoFullName,
                workflowRun.path("head_branch").asText(""),
                commitSha,
                workflowRun.path("name").asText(""));
        return ResponseEntity.ok("processed");
    }

    /** Resolves and persists CI state for a GitHub check run event. */
    private ResponseEntity<String> handleCheckRun(JsonNode body) {
        String action     = body.path("action").asText("");
        JsonNode checkRun = body.path("check_run");
        String   headSha  = checkRun.path("head_sha").asText("").trim();

        if (headSha.isEmpty()) {
            return ResponseEntity.badRequest().body("Missing head_sha");
        }

        // Skip events for commits not stored in our DB — avoids unnecessary writes.
        if (!taskGithubService.hasCommitWithSha(headSha)) {
            return ResponseEntity.ok("no matching task");
        }

        CiStatus resolved;
        if ("rerequested".equals(action)) {
            // User manually re-triggered the check — treat as running until a result arrives.
            resolved = CiStatus.RUNNING;
        } else {
            resolved = ciStatusResolver.resolveFromCheckRunEvent(checkRun);
        }

        // Do not overwrite real data with UNKNOWN — wait for a conclusive event.
        if (resolved == CiStatus.UNKNOWN) {
            return ResponseEntity.ok("unresolvable status — skipped");
        }

        taskGithubService.updateCiStatusBySha(headSha, resolved);
        if (resolved == CiStatus.FAILED) {
            githubNotificationService.notifyCIFailed(
                    repositoryFullName(body),
                    checkRun.path("check_suite").path("head_branch").asText(""),
                    headSha,
                    checkRun.path("name").asText(""));
        }
        log.info("CI status updated to {} for SHA {}", resolved,
                headSha.length() >= 7 ? headSha.substring(0, 7) : headSha);
        return ResponseEntity.ok("updated");
    }

    private String repositoryFullName(JsonNode body) {
        return body.path("repository").path("full_name").asText("").trim();
    }

    private String loginAt(JsonNode parent, String property) {
        return parent.path(property).path("login").asText("");
    }

    private List<String> issueLabels(JsonNode issue) {
        List<String> labels = new ArrayList<>();
        issue.path("labels").forEach(label -> {
            String name = label.path("name").asText("").trim();
            if (!name.isBlank()) {
                labels.add(name);
            }
        });
        return labels;
    }

}
