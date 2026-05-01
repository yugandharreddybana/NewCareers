package com.careerops.repository;

import com.careerops.model.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InterviewSessionRepository extends JpaRepository<InterviewSession, UUID> {

    List<InterviewSession> findByInterviewTrackIdOrderByStartedAtDesc(UUID interviewTrackId);

    List<InterviewSession> findByUserId(UUID userId);

    List<InterviewSession> findByInterviewTrackIdAndCompletedAtIsNotNull(UUID interviewTrackId);
}
