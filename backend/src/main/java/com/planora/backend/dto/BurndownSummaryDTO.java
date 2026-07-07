package com.planora.backend.dto;

public record BurndownSummaryDTO(
        int totalStoryPoints,
        int completedStoryPoints,
        int remainingStoryPoints,
        int totalTasks,
        int completedTasks,
        int remainingTasks,
        int progressPercent,
        long daysElapsed,
        long daysRemaining,
        int idealRemainingPoints,
        int variancePoints,
        double actualBurnRate,
        double requiredBurnRate,
        String projectedCompletionDate,
        String healthStatus
) {}
