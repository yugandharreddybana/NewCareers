package com.careerops.repository;

import com.careerops.model.OutreachSequence;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface OutreachSequenceRepository extends JpaRepository<OutreachSequence, UUID> {
    List<OutreachSequence> findByCampaignIdOrderByStepNumberAsc(UUID campaignId);
    void deleteByCampaignId(UUID campaignId);
}
