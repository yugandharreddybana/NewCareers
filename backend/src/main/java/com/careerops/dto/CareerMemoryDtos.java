package com.careerops.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class CareerMemoryDtos {

    public record UpsertMemoryRequest(
        String category,
        String key,
        String value,
        String source,
        String whySuggested,
        Short confidence
    ) {}

    public record MemoryResponse(
        UUID id,
        String category,
        String key,
        String value,
        String source,
        String whySuggested,
        short confidence,
        boolean memoryEnabled,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record MemoryListResponse(List<MemoryResponse> memories, int total) {}

    public record ToggleMemoryRequest(boolean memoryEnabled) {}
}
