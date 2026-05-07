package com.careerops.service;

import com.careerops.model.Experiment;
import com.careerops.model.ExperimentAssignment;
import com.careerops.repository.ExperimentAssignmentRepository;
import com.careerops.repository.ExperimentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Section 3.6 Task 77 — ExperimentAssignmentService
 * Deterministically assigns users to AB test variants.
 * Uses a seeded hash on (experimentId + userId) so assignments are
 * stable across restarts without persisting first, and then persists
 * on first call to ensure consistency going forward.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExperimentAssignmentService {

    private final ExperimentRepository experimentRepo;
    private final ExperimentAssignmentRepository assignmentRepo;

    /**
     * Returns the assigned variant for this user and experiment key.
     * If the experiment is inactive or the user is outside traffic %, returns "control".
     */
    @Transactional(timeout = 10)
    public String getVariant(UUID userId, String experimentKey) {
        Optional<Experiment> expOpt = experimentRepo.findByKey(experimentKey);
        if (expOpt.isEmpty() || !"active".equals(expOpt.get().getStatus())) {
            return "control";
        }

        Experiment exp = expOpt.get();

        // Check existing assignment
        Optional<ExperimentAssignment> existing =
                assignmentRepo.findByExperimentIdAndUserId(exp.getId(), userId);
        if (existing.isPresent()) {
            return existing.get().getVariant();
        }

        // Determine if user is in traffic bucket (0-99 hash)
        int bucket = Math.abs((userId.toString() + exp.getId().toString()).hashCode()) % 100;
        if (bucket >= exp.getTrafficPct()) {
            return "control";
        }

        // Assign variant from experiment variants array
        List<String> variants = exp.getVariants();
        if (variants == null || variants.isEmpty()) return "control";
        int variantIndex = Math.abs((userId.toString() + experimentKey).hashCode()) % variants.size();
        String assigned = variants.get(variantIndex);

        // Persist assignment
        ExperimentAssignment assignment = ExperimentAssignment.builder()
                .experimentId(exp.getId())
                .userId(userId)
                .variant(assigned)
                .build();
        assignmentRepo.save(assignment);

        log.info("[Experiment] user={} exp={} variant={}", userId, experimentKey, assigned);
        return assigned;
    }

    /**
     * Returns all active experiments and the user's assigned variant for each.
     * Used by frontend to load all experiment assignments in one call.
     */
    @Transactional(timeout = 10, readOnly = true)
    public java.util.Map<String, String> getAllVariants(UUID userId) {
        List<Experiment> active = experimentRepo.findByStatus("active");
        java.util.Map<String, String> result = new java.util.LinkedHashMap<>();
        for (Experiment exp : active) {
            result.put(exp.getKey(), getVariant(userId, exp.getKey()));
        }
        return result;
    }
}
