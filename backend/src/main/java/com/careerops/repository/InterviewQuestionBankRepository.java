package com.careerops.repository;

import com.careerops.model.InterviewQuestionBank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InterviewQuestionBankRepository extends JpaRepository<InterviewQuestionBank, UUID> {
    List<InterviewQuestionBank> findBySessionIdOrderByTurnNumberAsc(UUID sessionId);
    List<InterviewQuestionBank> findByUserJobIdOrderByCreatedAtDesc(UUID userJobId);
    List<InterviewQuestionBank> findByUserIdAndCompanyNameOrderByCreatedAtDesc(UUID userId, String companyName);
}
