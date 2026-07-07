package com.planora.backend.dto;

public record BurndownBreakdownItemDTO(
        String name,
        int taskCount,
        int storyPoints
) {}
