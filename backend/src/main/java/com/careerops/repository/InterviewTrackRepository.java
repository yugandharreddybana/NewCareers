package com.careerops.repository;

import com.careerops.model.InterviewTrack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InterviewTrackRepository extends JpaRepository<InterviewTrack, UUID> {
    List<InterviewTrack> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<InterviewTrack> findByUserJobIdAndUserId(UUID userJobId, UUID userId);
}
