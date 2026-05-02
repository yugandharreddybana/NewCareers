package com.careerops.repository;

import com.careerops.model.CareerMemory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CareerMemoryRepository extends JpaRepository<CareerMemory, UUID> {
    List<CareerMemory> findByUserIdOrderByCategoryAscKeyAsc(UUID userId);
    List<CareerMemory> findByUserIdAndCategoryOrderByKeyAsc(UUID userId, String category);
    Optional<CareerMemory> findByUserIdAndCategoryAndKey(UUID userId, String category, String key);
    Optional<CareerMemory> findByIdAndUserId(UUID id, UUID userId);
    void deleteByIdAndUserId(UUID id, UUID userId);
}
