package com.planora.backend.dto;

import java.util.List;

public record BurndownBreakdownDTO(
        List<BurndownBreakdownItemDTO> byStatus,
        List<BurndownBreakdownItemDTO> byPriority
) {}
