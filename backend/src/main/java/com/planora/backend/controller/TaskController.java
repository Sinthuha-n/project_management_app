package com.planora.backend.controller;

import com.planora.backend.dto.BulkDeleteTasksRequest;
import com.planora.backend.dto.BulkUpdateStatusRequest;
import com.planora.backend.dto.ApiErrorResponse;
import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.LinkedCommitResponseDTO;
import com.planora.backend.dto.LinkedPrResponseDTO;
import com.planora.backend.dto.PatchTaskDatesRequest;
import com.planora.backend.dto.PageResponseDto;
import com.planora.backend.dto.ReorderTasksRequest;
import com.planora.backend.dto.TaskActivityResponseDTO;
import com.planora.backend.dto.TaskBranchUpdateDTO;
import com.planora.backend.dto.TaskGithubSummaryDTO;
import com.planora.backend.dto.TaskPageResponseDto;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.dto.TaskTemplateDTO;
import com.planora.backend.dto.UpdateAssigneesRequest;
import com.planora.backend.dto.UpdatePriorityRequest;
import com.planora.backend.dto.UpdateStatusRequest;

import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TaskActivityService;
import com.planora.backend.service.TaskGithubService;
import com.planora.backend.service.TaskService;
import com.planora.backend.service.TaskTemplateService;
import com.planora.backend.service.GithubTokenService;
import com.planora.backend.service.GithubIssuesSyncService;
import com.planora.backend.service.GithubNotificationService;
import com.planora.backend.dto.GithubIssueCreateRequestDTO;
import com.planora.backend.dto.GithubIssueDTO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.groups.Default;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;


import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
@Slf4j
public class TaskController {

    private final TaskService service;

    private final TaskActivityService activityService;

    private final TaskTemplateService templateService;

    private final TaskGithubService taskGithubService;

    private final GithubTokenService githubTokenService;

    private final GithubIssuesSyncService githubIssuesSyncService;

    private final GithubNotificationService githubNotificationService;

    // Spring's WebSocket messaging template used for real-time push notifications.
    private final SimpMessagingTemplate messagingTemplate;

    //Creates a new task and broadcasts the creation to all connected clients.
    @PostMapping
    public ResponseEntity<TaskResponseDTO> createTask(
            // @Validated enforces strict rules specifically for creation (e.g., Title is mandatory).
            @Validated({TaskRequestDTO.OnCreate.class, Default.class}) @RequestBody TaskRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        TaskResponseDTO task = service.createTask(request, currentUserId);

        // REAL-TIME PUSH: Tell everyone currently viewing this project's board that a new task appeared.
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_CREATED", "task", task));
        return new ResponseEntity<>(task, HttpStatus.CREATED);
    }

    /*
     * Fetches a single task and silently logs that the user viewed it
     * (used to populate their "Recently Viewed" dashboard).
     *
     * Optional GitHub enrichment: supply repoFullName query param
     * (e.g. "owner/repo") while authenticated with a connected GitHub account
     * to populate the
     * githubPrCount, ciStatus, linkedPrs, and recentCommits response fields.
     * Omitting either parameter returns the task with null GitHub fields —
     * fully backward-compatible with existing API consumers.
     */
    @GetMapping("/{taskId}")
    public ResponseEntity<TaskResponseDTO> getTaskById(
            @PathVariable Long taskId,
            @RequestParam(required = false) String repoFullName,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long currentUserId = currentUser.getUserId();
        String githubToken = null;
        try {
            githubToken = githubTokenService.getToken(currentUserId);
        } catch (Exception e) {
            log.warn("Failed to retrieve GitHub token for user {}: {}", currentUserId, e.getMessage());
        }
        TaskResponseDTO dto = (githubToken != null && repoFullName != null)
                ? service.getTaskById(taskId, repoFullName, githubToken, currentUserId)
                : service.getTaskById(taskId, currentUserId);
        try {
            service.recordTaskAccess(taskId, currentUserId);
        } catch (RuntimeException exception) {
            // Recently-viewed tracking is best-effort and must not break a task read.
            log.warn("Unable to record access to task {} for user {}", taskId, currentUserId, exception);
        }
        return new ResponseEntity<>(dto, HttpStatus.OK);
    }

    /**
     * Returns the full GitHub summary (PRs, commits, CI status, branch) for a task.
     *
     * Omit repoFullName to get the last cached data.
     *
     * GET /api/tasks/{taskId}/github
     *     ?repoFullName=owner/repo          (optional)
     */
    @GetMapping("/{taskId}/github")
    public ResponseEntity<TaskGithubSummaryDTO> getTaskGithubSummary(
            @PathVariable Long taskId,
            @RequestParam(required = false) String repoFullName,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        Long currentUserId = currentUser.getUserId();
        String githubToken = githubTokenService.getToken(currentUserId);
        TaskGithubSummaryDTO summary = (githubToken != null && repoFullName != null)
                ? taskGithubService.syncAndGetSummary(taskId, repoFullName, githubToken, currentUserId)
                : taskGithubService.getTaskGithubSummary(taskId, currentUserId);

        return ResponseEntity.ok(summary);
    }

    /**
     * Returns all pull requests linked to a task, sorted by most-recently-updated.
     *
     * GET /api/tasks/{taskId}/pull-requests
     *     ?repoFullName=owner/repo          (optional — triggers a fresh GitHub sync first)
     *
     * Without repo the endpoint returns the last cached PR data from the DB.
     * With repo it syncs fresh data from GitHub before responding.
     */
    @GetMapping("/{taskId}/pull-requests")
    public ResponseEntity<List<LinkedPrResponseDTO>> getLinkedPullRequests(
            @PathVariable Long taskId,
            @RequestParam(required = false) String repoFullName,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        Long currentUserId = currentUser.getUserId();
        String githubToken = githubTokenService.getToken(currentUserId);
        List<LinkedPrResponseDTO> prs = (githubToken != null && repoFullName != null)
                ? taskGithubService.syncAndGetLinkedPrs(taskId, repoFullName, githubToken, currentUserId)
                : taskGithubService.getLinkedPrs(taskId, currentUserId);

        return ResponseEntity.ok(prs);
    }

    /**
     * Returns commits linked to a task, sorted by committed_at descending.
     *
     * GET /api/tasks/{taskId}/commits
     *     ?limit=20                          (optional, 1-50, default 20)
     *     ?repoFullName=owner/repo           (optional — triggers a fresh GitHub sync first)
     *
     * Each commit includes:
     *   - sha (7-char), fullSha (40-char), message, author, committedAt, htmlUrl, ciStatus
     *   - referencedTaskNumbers: task project-numbers extracted from the commit message
     *     using the patterns "#<number>" and "TASK-<number>" (case-insensitive)
     *
     * Without repo the endpoint returns cached data from the DB.
     * With repo it syncs fresh data from GitHub before responding.
     */
    @GetMapping("/{taskId}/commits")
    public ResponseEntity<List<LinkedCommitResponseDTO>> getLinkedCommits(
            @PathVariable Long taskId,
            @RequestParam(required = false) String repoFullName,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        Long currentUserId = currentUser.getUserId();
        String githubToken = githubTokenService.getToken(currentUserId);
        List<LinkedCommitResponseDTO> commits = (githubToken != null && repoFullName != null)
                ? taskGithubService.syncAndGetLinkedCommits(taskId, repoFullName, githubToken, limit, currentUserId)
                : taskGithubService.getLinkedCommits(taskId, limit, currentUserId);

        return ResponseEntity.ok(commits);
    }

    @PostMapping("/{taskId}/github-issue")
    public ResponseEntity<?> createGithubIssue(
            @PathVariable Long taskId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String repoFullName = (String) body.get("repoFullName");
        String title = (String) body.get("title");
        String issueBody = (String) body.get("body");

        if (repoFullName == null || repoFullName.isBlank() || title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "repoFullName and title are required"));
        }

        String accessToken = githubTokenService.getToken(currentUser.getUserId());
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "GitHub account is not connected"));
        }

        GithubIssueCreateRequestDTO request = new GithubIssueCreateRequestDTO();
        request.setRepoFullName(repoFullName);
        request.setTitle(title);
        request.setBody(issueBody);
        request.setTaskId(taskId);

        GithubIssueDTO createdIssue = githubIssuesSyncService.createIssue(request, accessToken);

        service.linkGithubIssue(
                taskId,
                createdIssue.getNumber().longValue(),
                repoFullName,
                currentUser.getUserId());

        githubNotificationService.notifyIssueEvent(
                repoFullName,
                createdIssue.getNumber(),
                createdIssue.getTitle(),
                "opened",
                currentUser.getUsername(),
                createdIssue.getBody(),
                List.of());

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "issueNumber", createdIssue.getNumber(),
                "title", createdIssue.getTitle(),
                "htmlUrl", createdIssue.getHtmlUrl(),
                "state", createdIssue.getState()
        ));
    }

    /**
     * Manually sets or updates the GitHub branch linked to a task.
     *
     * PATCH /api/tasks/{taskId}/github/branch
     * Body: { "branch": "feature/my-branch" }
     *
     * Returns the refreshed TaskGithubSummaryDTO so the frontend can
     * update its state without a separate GET.
     */
    @PatchMapping("/{taskId}/github/branch")
    public ResponseEntity<TaskGithubSummaryDTO> updateTaskBranch(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskBranchUpdateDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        String actorName = (currentUser != null) ? currentUser.getUsername() : "System";
        TaskGithubSummaryDTO summary = taskGithubService.updateBranch(taskId, request.getBranch(), actorName);
        return ResponseEntity.ok(summary);
    }

    @PutMapping("/{taskId}")
    public ResponseEntity<TaskResponseDTO> updateTask(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        TaskResponseDTO task = service.updateTask(taskId, request, currentUserId);

        // REAL-TIME PUSH: Update the task card on everyone's screen.
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_UPDATED", "task", task));
        return new ResponseEntity<>(task, HttpStatus.OK);
    }

    @PatchMapping("/{taskId}")
    public ResponseEntity<TaskResponseDTO> patchTask(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        TaskResponseDTO task = service.updateTask(taskId, request, currentUserId);

        // REAL-TIME PUSH: Update the task card on everyone's screen.
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_UPDATED", "task", task));
        return new ResponseEntity<>(task, HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        Long projectId = service.deleteTask(taskId, currentUserId);

        // REAL-TIME PUSH: Make the task visually disappear for all connected users.
        messagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/tasks",
                Map.of("type", "TASK_DELETED", "taskId", taskId));
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    /*
     * The heavy-lifter endpoint for populating the main Kanban or List views.
     * Supports multiple optional filters via query parameters.
     */
    @GetMapping("/project/{projectId}")
    @ApiResponse(responseCode = "200", content = @Content(schema = @Schema(implementation = TaskPageResponseDto.class)))
    public ResponseEntity<?> getTasksByProject(
            @PathVariable Long projectId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false, defaultValue = "false") Boolean archived,
            HttpServletRequest servletRequest,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        if (!TaskService.isAllowedTaskSortField(sortBy)) {
            return badTaskSortRequest(
                    "Invalid sortBy '" + sortBy + "'. Allowed values: " + String.join(", ", TaskService.ALLOWED_SORT_FIELDS),
                    servletRequest);
        }
        if (!TaskService.isAllowedTaskSortDirection(sortDir)) {
            return badTaskSortRequest("Invalid sortDir '" + sortDir + "'. Allowed values: asc, desc", servletRequest);
        }
        Pageable pageable = PageRequest.of(page, size,
                sortDir.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() :
                        Sort.by(sortBy).descending());
        return ResponseEntity.ok(PageResponseDto.from(service.getTasksByProject(projectId,
                currentUser.getUserId(), pageable, archived)));
    }

    private ResponseEntity<ApiErrorResponse> badTaskSortRequest(String message, HttpServletRequest request) {
        ApiErrorResponse body = new ApiErrorResponse(
                LocalDateTime.now().toString(),
                HttpStatus.BAD_REQUEST.value(),
                "BAD_REQUEST",
                message,
                request.getRequestURI(),
                null
        );
        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    @GetMapping("/project/{projectId}/all")
    public ResponseEntity<List<TaskResponseDTO>> getAllTasksByProject(
            @PathVariable Long projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Long sprintId,
            @RequestParam(required = false) Long milestoneId,
            @RequestParam(required = false, defaultValue = "false") Boolean archived,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.getTasksByProject(projectId, currentUserId, status, assigneeId, priority, sprintId, milestoneId, archived), HttpStatus.OK);
    }

    @GetMapping("/project/{projectId}/archived")
    public ResponseEntity<List<TaskResponseDTO>> getArchivedTasks(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        return ResponseEntity.ok(service.getArchivedTasks(projectId, currentUser.getUserId()));
    }

    @PatchMapping("/{taskId}/archive")
    public ResponseEntity<TaskResponseDTO> archiveTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TaskResponseDTO task = service.archiveTask(taskId, currentUser.getUserId());
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_UPDATED", "task", task));
        return ResponseEntity.ok(task);
    }

    @PatchMapping("/{taskId}/unarchive")
    public ResponseEntity<TaskResponseDTO> unarchiveTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TaskResponseDTO task = service.unarchiveTask(taskId, currentUser.getUserId());
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_UPDATED", "task", task));
        return ResponseEntity.ok(task);
    }

    // ── DASHBOARD ENDPOINTS ─────────────────────────────────────────────────────

    @PostMapping("/{taskId}/access")
    public ResponseEntity<Void> recordTaskAccess(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser){
        service.recordTaskAccess(taskId, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @GetMapping("/recent")
    public ResponseEntity<List<TaskResponseDTO>> getRecentTasks(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "20") int limit){
        return new ResponseEntity<>(service.getRecentTasks(currentUser.getUserId(), limit), HttpStatus.OK);
    }

    @GetMapping("/assigned")
    public ResponseEntity<List<TaskResponseDTO>> getAssignedTasks(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "20") int limit){
        return new ResponseEntity<>(service.getAssignedTasks(currentUser.getUserId(), limit), HttpStatus.OK);
    }

    @GetMapping("/worked-on")
    public ResponseEntity<List<TaskResponseDTO>> getWorkedOnTasks(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "20") int limit){
        return new ResponseEntity<>(service.getWorkedOnTasks(currentUser.getUserId(), limit), HttpStatus.OK);
    }

    // ── SUBTASKS ────────────────────────────────────────────────────────────────

    @PostMapping("/{parentId}/subtasks")
    public ResponseEntity<TaskResponseDTO> createSubTask(
            @PathVariable Long parentId,
            @Validated({TaskRequestDTO.OnSubTaskCreate.class, Default.class}) @RequestBody TaskRequestDTO subTaskRequest,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.createSubTask(parentId, subTaskRequest, currentUserId), HttpStatus.OK);
    }

    // ── DEPENDENCIES ────────────────────────────────────────────────────────────

    @PostMapping("/{taskId}/dependencies/{blockerId}")
    public ResponseEntity<Void> addDependency(
            @PathVariable Long taskId,
            @PathVariable Long blockerId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.addDependency(taskId,blockerId,currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}/dependencies/{blockerId}")
    public ResponseEntity<Void> removeDependency(
            @PathVariable Long taskId,
            @PathVariable Long blockerId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.removeDependency(taskId, blockerId, currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    // ── LABELS ──────────────────────────────────────────────────────────────────

    @PostMapping("/{taskId}/label/{labelId}")
    public ResponseEntity<Void> addLabel(
            @PathVariable Long taskId,
            @PathVariable Long labelId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.addLabel(taskId, labelId, currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}/label/{labelId}")
    public ResponseEntity<Void> removeLabel(
            @PathVariable Long taskId,
            @PathVariable Long labelId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.removeLabel(taskId, labelId, currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    // ── COMMENTS ────────────────────────────────────────────────────────────────

    @PostMapping("/{taskId}/comments")
    public ResponseEntity<Void> addComment(
            @PathVariable Long taskId,
            @Valid @RequestBody CommentRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser
            ){
        Long currentUserId = currentUser.getUserId();
        service.addComment(taskId,request,currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @GetMapping("/{taskId}/comments")
    public ResponseEntity<List<com.planora.backend.dto.CommentResponseDTO>> getComments(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        return new ResponseEntity<>(service.getComments(taskId, currentUser.getUserId()), HttpStatus.OK);
    }

    // ── ASSIGNMENT ──────────────────────────────────────────────────────────────

    @PatchMapping("/{taskId}/assign/{userId}")
    public ResponseEntity<Void> assignUser(
            @PathVariable Long taskId,
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.assignUser(taskId, userId, currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}/assignee")
    public ResponseEntity<Void> unassignTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        service.unassignTask(taskId, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    /** PATCH /api/tasks/{taskId}/assignees — replace the multi-assignee list without requiring a full task body. */
    @PatchMapping("/{taskId}/assignees")
    public ResponseEntity<TaskResponseDTO> updateAssignees(
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateAssigneesRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TaskResponseDTO task = service.updateAssignees(taskId, request.getAssigneeIds(), currentUser.getUserId());
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_UPDATED", "task", task));
        return ResponseEntity.ok(task);
    }

    // ── BULK OPERATIONS ─────────────────────────────────────────────────────────

    @PatchMapping("/bulk/status")
    public ResponseEntity<Void> bulkUpdateStatus(
            @Valid @RequestBody BulkUpdateStatusRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        service.bulkUpdateStatus(request.getTaskIds(), request.getStatus(), currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @DeleteMapping("/bulk")
    public ResponseEntity<Void> bulkDelete(
            @Valid @RequestBody BulkDeleteTasksRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        service.bulkDelete(request.getTaskIds(), currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    // ── LIGHTWEIGHT UI PATCHES ──────────────────────────────────────────────────

    @PatchMapping("/{taskId}/priority")
    public ResponseEntity<TaskResponseDTO> updatePriority(
            @PathVariable Long taskId,
            @Valid @RequestBody UpdatePriorityRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.updatePriority(taskId, request.getPriority(), currentUserId), HttpStatus.OK);
    }

    /**
     * PATCH /api/tasks/{taskId}/status
     * Lightweight endpoint for Kanban drag-and-drop status changes.
     * Accepts { "status": "IN_PROGRESS" }.
     */
    @PatchMapping("/{taskId}/status")
    public ResponseEntity<TaskResponseDTO> updateStatus(
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        TaskResponseDTO task = service.updateStatus(taskId, request.getStatus(), currentUserId);
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of(
                    "type", "TASK_STATUS_CHANGED",
                    "taskId", task.getId(),
                    "status", task.getStatus(),
                    "projectId", task.getProjectId()
                ));
        return new ResponseEntity<>(task, HttpStatus.OK);
    }

    /**
     * PATCH /api/tasks/{taskId}/dates
     * Lightweight endpoint for calendar drag-and-drop date updates.
     * Accepts { startDate: "YYYY-MM-DD", dueDate: "YYYY-MM-DD" }.
     */
    @PatchMapping("/{taskId}/dates")
    public ResponseEntity<TaskResponseDTO> patchTaskDates(
            @PathVariable Long taskId,
            @Valid @RequestBody PatchTaskDatesRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TaskResponseDTO task = service.patchTaskDates(
                taskId,
                request.getStartDate(), request.isStartDateProvided(),
                request.getDueDate(), request.isDueDateProvided(),
                currentUser.getUserId());
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_UPDATED", "task", task));
        return new ResponseEntity<>(task, HttpStatus.OK);
    }

    @PatchMapping("/reorder")
    public ResponseEntity<Void> reorderTasks(
            @Valid @RequestBody ReorderTasksRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        service.reorderTasks(
                request.getProjectId(),
                request.getSprintId(),
                request.getOrderedTaskIds() != null ? request.getOrderedTaskIds() : List.of(),
                currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @GetMapping("/{taskId}/activities")
    public ResponseEntity<List<TaskActivityResponseDTO>> getActivities(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        return new ResponseEntity<>(activityService.getActivities(taskId, currentUser.getUserId()), HttpStatus.OK);
    }

    /** Save the task as a reusable template for the project. */
    @PostMapping("/{taskId}/save-as-template")
    public ResponseEntity<TaskTemplateDTO> saveAsTemplate(
            @PathVariable Long taskId,
            @RequestBody TaskTemplateDTO.SaveFromTaskRequest req,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        TaskTemplateDTO dto = templateService.saveTaskAsTemplate(taskId, req.getTemplateName(), currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }
}
