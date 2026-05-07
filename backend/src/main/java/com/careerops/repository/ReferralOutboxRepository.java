package com.careerops.repository;

import com.careerops.model.ReferralOutbox;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ReferralOutboxRepository extends JpaRepository<ReferralOutbox, UUID> {
    List<ReferralOutbox> findByProcessedFalseOrderByCreatedAtAsc();
}
