package com.careerops.repository;

import com.careerops.model.OrgInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrgInvitationRepository extends JpaRepository<OrgInvitation, UUID> {
    List<OrgInvitation> findByOrgId(UUID orgId);
    Optional<OrgInvitation> findByTokenHash(String tokenHash);
    boolean existsByOrgIdAndEmailAndStatus(UUID orgId, String email, String status);
}
