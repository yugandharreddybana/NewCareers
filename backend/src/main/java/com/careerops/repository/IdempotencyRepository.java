package com.careerops.repository;

import com.careerops.model.IdempotencyKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface IdempotencyRepository extends JpaRepository<IdempotencyKey, String> {
    Optional<IdempotencyKey> findByIdempotencyKey(String idempotencyKey);
    Optional<IdempotencyKey> findByIdempotencyKeyAndUserId(String idempotencyKey, UUID userId);
    void deleteByIdempotencyKey(String idempotencyKey);
}
