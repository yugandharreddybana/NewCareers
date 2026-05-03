package com.careerops.repository;

import com.careerops.model.OrgMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrgMemberRepository extends JpaRepository<OrgMember, UUID> {
    List<OrgMember> findByOrgId(UUID orgId);
    List<OrgMember> findByUserId(UUID userId);
    Optional<OrgMember> findByOrgIdAndUserId(UUID orgId, UUID userId);
    boolean existsByOrgIdAndUserId(UUID orgId, UUID userId);
    int countByOrgId(UUID orgId);
}
