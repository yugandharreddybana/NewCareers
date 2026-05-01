package com.careerops.repository;

import com.careerops.model.NetworkContact;
import com.careerops.model.NetworkContact.ContactType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Section 3.3 — Task 35 (repo layer)
 */
@Repository
public interface NetworkContactRepository extends JpaRepository<NetworkContact, UUID> {

    List<NetworkContact> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<NetworkContact> findByUserIdAndContactTypeOrderByCreatedAtDesc(
            UUID userId, ContactType contactType);

    Optional<NetworkContact> findByIdAndUserId(UUID id, UUID userId);
}
