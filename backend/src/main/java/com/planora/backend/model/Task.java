package com.planora.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString(exclude = {"project", "sprint", "kanbanColumn", "assignee", "assignees", "reporter", "parentTask", "subTasks", "labels", "comments", "dependencies", "dependents", "attachments"}) // Prevent infinite loops in logs
@Table(name = "tasks")
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(nullable = false, length = 255)
    @NotBlank(message = "Task title is required")
    @Size(max = 255, message = "Task title must be 255 characters or fewer")
    private String title;

    @Column(name = "project_task_number")
    private Long projectTaskNumber;

    @Column(length = 2000)
    private String description;

    @Column(name = "github_issue_number")
    private Long githubIssueNumber;

    @Column(name = "github_repo_full_name")
    private String githubRepoFullName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnore
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sprint_id")
    @JsonIgnore
    private Sprint sprint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kanban_column_id")
    @JsonIgnore
    private KanbanColumn kanbanColumn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    @JsonIgnore
    private TeamMember assignee;

    @BatchSize(size = 20)
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "task_assignees",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "member_id")
    )
    private Set<TeamMember> assignees = new HashSet<>();

    @Enumerated(EnumType.STRING)
    private Priority priority;

    private String status;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDate startDate;
    private LocalDate dueDate;
    @Column(name = "backlog_position")
    private Integer backlogPosition;
    @Column(name = "sprint_position")
    private Integer sprintPosition;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;

    @Column(nullable = false)
    private boolean archived = false;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id")
    @JsonIgnore
    private TeamMember reporter;

    private int storyPoint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_modified_by_id")
    @JsonIgnore
    private User lastModifiedBy;

    //The "Parent" (If this is null, It's th main taks. If ser, it's a subtask)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @JsonIgnore
    private Task parentTask;

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "parentTask" , cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Task> subTasks = new HashSet<>();

    @BatchSize(size = 20)
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "task_labels",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "label_id")
    )
    private Set<Label> labels = new HashSet<>();

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>();

    @BatchSize(size = 20)
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "task_dependencies",
            joinColumns = @JoinColumn(name = "blocked_task_id"),
            inverseJoinColumns = @JoinColumn(name = "blocker_task_id")
    )
    private Set<Task> dependencies = new HashSet<>();

    @BatchSize(size = 20)
    @ManyToMany(mappedBy = "dependencies", fetch = FetchType.LAZY)
    private Set<Task> dependents = new HashSet<>();

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<TaskAttachment> attachments = new HashSet<>();

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TaskAccess> taskAccess = new ArrayList<>();

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TaskActivity> taskActivities = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "milestone_id")
    @JsonIgnore
    private Milestone milestone;

    // GitHub branch linked to this task (V8 migration)
    @Column(name = "github_branch")
    private String githubBranch;

    // Recurring task fields (V7 migration)
    @Column(name = "recurrence_rule")
    private String recurrenceRule;   // DAILY | WEEKLY | MONTHLY | YEARLY

    @Column(name = "recurrence_end")
    private LocalDate recurrenceEnd;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurrence_parent_id")
    @JsonIgnore
    private Task recurrenceParent;

    @Column(name = "next_occurrence")
    private LocalDate nextOccurrence;

    @Column(name = "recurrence_active", nullable = false)
    private boolean recurrenceActive = true;

    @Column(name = "custom_interval")
    private Integer customInterval;

    @Column(name = "recurrence_limit")
    private Integer recurrenceLimit;

    @Column(name = "recurrence_count", nullable = false)
    private int recurrenceCount = 0;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Task task = (Task) o;
        return Objects.equals(id, task.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }





}
