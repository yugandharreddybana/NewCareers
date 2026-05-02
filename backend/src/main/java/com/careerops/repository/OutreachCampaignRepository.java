package com.careerops.repository;

import com.careerops.model.OutreachCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OutreachCampaignRepository extends JpaRepository<OutreachCampaign, UUID> {
    List<OutreachCampaign> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<OutreachCampaign> findByIdAndUserId(UUID id, UUID userId);
}
