package com.careerops.controller;

import com.careerops.model.Experiment;
import com.careerops.repository.ExperimentAssignmentRepository;
import com.careerops.repository.ExperimentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Section 3.6 Tasks 79+80 — Admin-safe experiment management.
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/experiments/admin")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ExperimentAdminController {

    private final ExperimentRepository experimentRepo;
    private final ExperimentAssignmentRepository assignmentRepo;

    public record CreateExperimentRequest(
        @jakarta.validation.constraints.NotBlank(message = "Key is required")
        @jakarta.validation.constraints.Pattern(regexp = "^[a-z0-9_-]{1,64}$", message = "Invalid key format")
        String key,
        @jakarta.validation.constraints.NotBlank(message = "Name is required")
        String name,
        String description,
        @jakarta.validation.constraints.NotBlank(message = "Status is required")
        String status,
        @jakarta.validation.constraints.NotEmpty(message = "Variants are required")
        @jakarta.validation.constraints.Size(max = 10, message = "Maximum 10 variants allowed")
        @io.swagger.v3.oas.annotations.media.Schema(description = "List of experiment variants, capped at 10 items")
        List<String> variants,
        @jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(100)
        Short trafficPct
    ) {}

    // Task 80 — results dashboard data
    @GetMapping("/results")
    public List<com.careerops.dto.ExperimentDTO.ExperimentResultResponse> getResults() {
        List<Experiment> all = experimentRepo.findAll();
        List<com.careerops.dto.ExperimentDTO.ExperimentResultResponse> results = new ArrayList<>();

        for (Experiment exp : all) {
            // Count assignments per variant
            List<Object[]> counts = assignmentRepo.countByVariantForExperiment(exp.getId());
            Map<String, Integer> variantCounts = new LinkedHashMap<>();
            int total = 0;
            for (Object[] row2 : counts) {
                String variant = (String) row2[0];
                int count = ((Number) row2[1]).intValue();
                variantCounts.put(variant, count);
                total += count;
            }

            results.add(com.careerops.dto.ExperimentDTO.ExperimentResultResponse.builder()
                    .id(exp.getId())
                    .key(exp.getKey())
                    .name(exp.getName())
                    .status(exp.getStatus())
                    .variants(exp.getVariants())
                    .trafficPct(exp.getTrafficPct())
                    .createdAt(exp.getCreatedAt())
                    .assignmentCounts(variantCounts)
                    .totalAssigned(total)
                    .build());
        }
        return results;
    }

    public record UpdateExperimentStatusRequest(
        @jakarta.validation.constraints.NotBlank(message = "status is required") String status
    ) {}

    // Task 79 — enable / pause / complete experiment (config flag toggle)
    @PatchMapping("/{id}/status")
    public com.careerops.dto.ExperimentDTO updateStatus(
            @PathVariable UUID id,
            @jakarta.validation.Valid @RequestBody UpdateExperimentStatusRequest req) {
        String newStatus = req.status();
        if (!List.of("draft","active","paused","completed").contains(newStatus)) {
            throw com.careerops.exception.ApiException.badRequest("Invalid status");
        }
        Experiment exp = experimentRepo.findById(id)
            .orElseThrow(() -> com.careerops.exception.ApiException.notFound("Experiment not found"));
        exp.setStatus(newStatus);
        return toDTO(experimentRepo.save(exp));
    }

    // Task 79 — create a new experiment via API (admin only)
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public com.careerops.dto.ExperimentDTO create(
            @jakarta.validation.Valid @RequestBody CreateExperimentRequest req) {
        if (req.variants() != null && req.variants().size() > 10) {
            throw com.careerops.exception.ApiException.badRequest("Maximum 10 variants allowed");
        }
        Experiment exp = Experiment.builder()
            .key(req.key())
            .name(req.name())
            .description(req.description())
            .status(req.status())
            .variants(req.variants())
            .trafficPct(req.trafficPct() != null ? req.trafficPct() : 100)
            .build();
        Experiment saved = experimentRepo.save(exp);
        return toDTO(saved);
    }

    private com.careerops.dto.ExperimentDTO toDTO(Experiment exp) {
        return com.careerops.dto.ExperimentDTO.builder()
                .id(exp.getId())
                .key(exp.getKey())
                .name(exp.getName())
                .description(exp.getDescription())
                .status(exp.getStatus())
                .variants(exp.getVariants())
                .trafficPct(exp.getTrafficPct())
                .createdAt(exp.getCreatedAt())
                .build();
    }
}
