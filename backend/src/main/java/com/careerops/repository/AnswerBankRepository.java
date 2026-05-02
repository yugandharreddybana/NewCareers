package com.careerops.repository;

import com.careerops.model.AnswerBank;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnswerBankRepository extends JpaRepository<AnswerBank, UUID> {
    List<AnswerBank> findByUserIdOrderByQuestionKeyAsc(UUID userId);
    Optional<AnswerBank> findByUserIdAndQuestionKey(UUID userId, String questionKey);
    Optional<AnswerBank> findByIdAndUserId(UUID id, UUID userId);
}
