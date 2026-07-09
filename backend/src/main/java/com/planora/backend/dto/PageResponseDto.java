package com.planora.backend.dto;

import java.util.List;

import org.springframework.data.domain.Page;

import lombok.Getter;

@Getter
public class PageResponseDto<T> {
    private final List<T> content;
    private final long totalElements;
    private final int totalPages;
    private final int size;
    private final int number;
    private final boolean first;
    private final boolean last;
    private final boolean empty;
    private final int numberOfElements;

    public PageResponseDto(
            List<T> content,
            long totalElements,
            int totalPages,
            int size,
            int number,
            boolean first,
            boolean last,
            boolean empty,
            int numberOfElements
    ) {
        this.content = content;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.size = size;
        this.number = number;
        this.first = first;
        this.last = last;
        this.empty = empty;
        this.numberOfElements = numberOfElements;
    }

    public static <T> PageResponseDto<T> from(Page<T> page) {
        return new PageResponseDto<>(
                page.getContent(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.getSize(),
                page.getNumber(),
                page.isFirst(),
                page.isLast(),
                page.isEmpty(),
                page.getNumberOfElements()
        );
    }
}
