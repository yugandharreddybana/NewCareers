package com.careerops.repository;

import com.careerops.model.InterviewQuestionBank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InterviewQuestionBankRepository extends JpaRepository<InterviewQuestionBank, UUID> {
    List<InterviewQuestionBank> findByUserJobId(UUID userJobId);

    @org.springframework.data.jpa.repository.Query("SELECT b FROM InterviewQuestionBank b WHERE b.interviewTrackId = :trackId")
    List<InterviewQuestionBank> findByTrackId(@org.springframework.data.repository.query.Param("trackId") UUID trackId);
}
