package com.planora.backend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class SprintVelocityDTO {

    private Long sprintId;
    private String sprintName;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDateTime completedAt;
    private int committedPoints;
    private int completedPoints;
    private boolean commitmentCaptured;

    public SprintVelocityDTO(Long sprintId,
                             String sprintName,
                             LocalDate startDate,
                             LocalDate endDate,
                             LocalDateTime completedAt,
                             int committedPoints,
                             int completedPoints,
                             boolean commitmentCaptured) {
        this.sprintId = sprintId;
        this.sprintName = sprintName;
        this.startDate = startDate;
        this.endDate = endDate;
        this.completedAt = completedAt;
        this.committedPoints = committedPoints;
        this.completedPoints = completedPoints;
        this.commitmentCaptured = commitmentCaptured;
    }

    public Long getSprintId() { return sprintId; }
    public String getSprintName() { return sprintName; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public int getCommittedPoints() { return committedPoints; }
    public int getCompletedPoints() { return completedPoints; }
    public boolean isCommitmentCaptured() { return commitmentCaptured; }
}
