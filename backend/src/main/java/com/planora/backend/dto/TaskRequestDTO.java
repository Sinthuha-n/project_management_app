package com.planora.backend.dto;

import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskRequestDTO {

    public interface OnCreate {}
    public interface OnSubTaskCreate {}

    @NotBlank(message = "Task title is required", groups = {OnCreate.class, OnSubTaskCreate.class})
    @Size(max = 255, message = "Task title must be 255 characters or fewer")
    private String title;

    @Size(max = 2000, message = "Description must be 2000 characters or fewer")
    private String description;

    @Pattern(regexp = "^(LOW|NORMAL|MEDIUM|HIGH|URGENT)$",
             message = "Priority must be LOW, NORMAL, MEDIUM, HIGH, or URGENT")
    private String priority;
    
    @Size(max = 255, message = "Status must be 255 characters or fewer")
    private String status;

    @Min(value = 0, message = "Story points must be at least 0")
    @Max(value = 999, message = "Story points must not exceed 999")
    private Integer storyPoint;

    private LocalDate dueDate;
    private LocalDate startDate;

    @NotNull(message = "Project ID is required", groups = OnCreate.class)
    @Positive(message = "Project ID must be positive")
    private Long projectId;

    @Positive(message = "Assignee ID must be positive")
    private Long assigneeId;

    @Positive(message = "Reporter ID must be positive")
    private Long reporterId;

    private List<@Positive(message = "Assignee ID must be positive") Long> assigneeIds;   // multiple assignees (V4)

    @Positive(message = "Sprint ID must be positive")
    private Long sprintId;
    @JsonIgnore
    private boolean sprintIdProvided;

    @JsonSetter("sprintId")
    public void setSprintId(Long sprintId) {
        this.sprintId = sprintId;
        this.sprintIdProvided = true;
    }
    @Positive(message = "Kanban Column ID must be positive")
    private Long KanbanColumnId;

    @Positive(message = "Parent ID must be positive")
    private Long parentId;

    private List<@Positive(message = "Label ID must be positive") Long> labelIds;

    @Positive(message = "Milestone ID must be positive")
    private Long milestoneId;
    @JsonIgnore
    private boolean milestoneIdProvided;

    @JsonSetter("milestoneId")
    public void setMilestoneId(Long milestoneId) {
        this.milestoneId = milestoneId;
        this.milestoneIdProvided = true;
    }

    // Recurring task fields (V7)
    @Pattern(regexp = "^(DAILY|WEEKLY|MONTHLY|YEARLY|CUSTOM_DAYS|CUSTOM_WEEKS|CUSTOM_MONTHS|CUSTOM_YEARS)$",
             message = "Recurrence rule must be valid (DAILY, WEEKLY, MONTHLY, YEARLY, or CUSTOM_DAYS/WEEKS/MONTHS/YEARS)")
    private String recurrenceRule;    // DAILY | WEEKLY | MONTHLY | YEARLY | CUSTOM_...
    private java.time.LocalDate recurrenceEnd;
    private Boolean recurrenceActive;
    private Integer customInterval;
    private Integer recurrenceLimit;

    private Boolean archived;

    /**
     * Optional client-generated correlation token used to reconcile optimistic,
     * HTTP, WebSocket, cross-tab, and offline task creation events.
     */
    @Size(min = 8, max = 128, message = "Client mutation ID must be between 8 and 128 characters")
    @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "Client mutation ID contains invalid characters")
    private String clientMutationId;
}
