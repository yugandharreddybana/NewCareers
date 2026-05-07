package com.careerops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ExperimentDTO {
    private UUID id;
    private String key;
    private String name;
    private String description;
    private String status;
    private List<String> variants;
    private Short trafficPct;
    private Instant createdAt;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ExperimentResultResponse {
        private UUID id;
        private String key;
        private String name;
        private String status;
        private List<String> variants;
        private Short trafficPct;
        private Instant createdAt;
        private Map<String, Integer> assignmentCounts;
        private int totalAssigned;
    }
}
