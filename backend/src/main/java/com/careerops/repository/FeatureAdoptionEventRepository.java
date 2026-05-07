package com.careerops.repository;

import com.careerops.model.FeatureAdoptionEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface FeatureAdoptionEventRepository extends JpaRepository<FeatureAdoptionEvent, UUID> {
}
