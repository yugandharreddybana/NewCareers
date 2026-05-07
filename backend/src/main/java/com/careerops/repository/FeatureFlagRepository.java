package com.careerops.repository;

import com.careerops.model.FeatureFlag;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Task 134 — FeatureFlag repository.
 */
public interface FeatureFlagRepository extends JpaRepository<FeatureFlag, UUID> {
    @Cacheable(value = "feature-flags", key = "#flagKey")
    Optional<FeatureFlag> findByFlagKey(String flagKey);
    List<FeatureFlag> findAllByOrderByFlagKeyAsc();
}
