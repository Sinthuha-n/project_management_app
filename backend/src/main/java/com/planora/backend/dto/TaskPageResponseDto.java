package com.planora.backend.dto;

import java.util.List;

public class TaskPageResponseDto extends PageResponseDto<TaskResponseDTO> {
    public TaskPageResponseDto(
            List<TaskResponseDTO> content,
            long totalElements,
            int totalPages,
            int size,
            int number,
            boolean first,
            boolean last,
            boolean empty,
            int numberOfElements
    ) {
        super(content, totalElements, totalPages, size, number, first, last, empty, numberOfElements);
    }
}
