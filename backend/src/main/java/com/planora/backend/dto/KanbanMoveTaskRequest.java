package com.planora.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

/**
 * Request body for PATCH /api/tasks/kanban/move.
 *
 * Atomically moves a task to a new status column and rewrites the
 * {@code backlogPosition} for every task in the destination column,
 * so drag-and-drop order is persisted in a single locked transaction.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KanbanMoveTaskRequest {

    /**
     * The project that owns the task. Required.
     */
    @NotNull(message = "projectId must not be null")
    @Positive(message = "projectId must be a positive number")
    private Long projectId;

    /**
     * The task being moved. Required.
     */
    @NotNull(message = "taskId must not be null")
    @Positive(message = "taskId must be a positive number")
    private Long taskId;

    /**
     * The destination column status (e.g. TODO, IN_PROGRESS, IN_REVIEW, DONE).
     * May equal the task's current status when performing a same-column reorder.
     */
    @NotBlank(message = "status must not be blank")
    private String status;

    /**
     * Ordered list of task IDs for the entire destination column after the drag,
     * including the moved task at its new position. Must not be null; may be empty.
     */
    @NotNull(message = "orderedTaskIds must not be null — send an empty list [] for a no-op")
    private List<@NotNull @Positive(message = "Each task ID must be a positive number") Long> orderedTaskIds;
}
