package com.careerops.repository;

import com.careerops.model.MemoryEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface MemoryEmbeddingRepository extends JpaRepository<MemoryEmbedding, UUID> {
    List<MemoryEmbedding> findByMemoryId(UUID memoryId);
    List<MemoryEmbedding> findByUserId(UUID userId);
    void deleteByMemoryId(UUID memoryId);
}
