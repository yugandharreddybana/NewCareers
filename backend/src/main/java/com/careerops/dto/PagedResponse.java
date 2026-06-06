package com.careerops.dto;

import lombok.Value;
import org.springframework.data.domain.Page;

import java.util.List;

@Value
public class PagedResponse<T> {
    List<T> content;
    long totalElements;
    int totalPages;
    int pageNumber;

    public static <T> PagedResponse<T> of(Page<T> page) {
        return new PagedResponse<>(
                page.getContent(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.getNumber()
        );
    }

    public static <T> PagedResponse<T> of(List<T> content, long totalElements, int totalPages, int pageNumber) {
        return new PagedResponse<>(content, totalElements, totalPages, pageNumber);
    }
}
