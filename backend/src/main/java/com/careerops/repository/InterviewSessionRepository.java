package com.careerops.repository;

import com.careerops.model.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InterviewSessionRepository extends JpaRepository<InterviewSession, UUID> {
    List<InterviewSession> findByUserJobIdAndUserId(UUID userJobId, UUID userId);
    List<InterviewSession> findByUserId(UUID userId);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM InterviewSession s WHERE s.interviewTrackId = :trackId ORDER BY s.completedAt DESC")
    List<InterviewSession> findByTrackIdOrderByCompletedAtDesc(@org.springframework.data.repository.query.Param("trackId") UUID trackId);
}
