package com.careerops.repository;

import com.careerops.model.OutreachMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OutreachMessageRepository extends JpaRepository<OutreachMessage, UUID> {
    List<OutreachMessage> findByCampaignIdOrderByCreatedAtDesc(UUID campaignId);
    List<OutreachMessage> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<OutreachMessage> findByIdAndUserId(UUID id, UUID userId);
    long countByCampaignIdAndStatus(UUID campaignId, String status);
}
