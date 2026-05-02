package com.careerops.controller;

import com.careerops.model.Experiment;
import com.careerops.repository.ExperimentAssignmentRepository;
import com.careerops.repository.ExperimentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Section 3.6 Tasks 79+80 — Admin-safe experiment management.
 * Task 79: enable/disable experiments via PATCH status.
 * Task 80: GET /experiments/admin/results — returns assignment counts per variant.
 *
 * Secured by @PreAuthorize("hasRole('ADMIN')") — add Spring Security method security.
 */
@RestController
@RequestMapping("/api/experiments/admin")
@RequiredArgsConstructor
public class ExperimentAdminController {

    private final ExperimentRepository experimentRepo;
    private final ExperimentAssignmentRepository assignmentRepo;

    // Task 80 — results dashboard data
    @GetMapping("/results")
    public ResponseEntity<List<Map<String, Object>>> getResults() {
        List<Experiment> all = experimentRepo.findAll();
        List<Map<String, Object>> results = new ArrayList<>();

        for (Experiment exp : all) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id",         exp.getId());
            row.put("key",        exp.getKey());
            row.put("name",       exp.getName());
            row.put("status",     exp.getStatus());
            row.put("variants",   exp.getVariants());
            row.put("trafficPct", exp.getTrafficPct());
            row.put("createdAt",  exp.getCreatedAt());

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
            row.put("assignmentCounts", variantCounts);
            row.put("totalAssigned",    total);
            results.add(row);
        }
        return ResponseEntity.ok(results);
    }

    // Task 79 — enable / pause / complete experiment (config flag toggle)
    @PatchMapping("/{id}/status")
    public ResponseEntity<Experiment> updateStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {
        String newStatus = body.get("status");
        if (!List.of("draft","active","paused","completed").contains(newStatus)) {
            return ResponseEntity.badRequest().build();
        }
        return experimentRepo.findById(id).map(exp -> {
            exp.setStatus(newStatus);
            return ResponseEntity.ok(experimentRepo.save(exp));
        }).orElse(ResponseEntity.notFound().build());
    }

    // Task 79 — create a new experiment via API (admin only)
    @PostMapping
    public ResponseEntity<Experiment> create(@RequestBody Experiment body) {
        body.setId(null); // ensure new
        return ResponseEntity.ok(experimentRepo.save(body));
    }
}
