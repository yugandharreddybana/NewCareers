package com.careerops.repository;

import com.careerops.model.OrgTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrgTeamRepository extends JpaRepository<OrgTeam, UUID> {
    List<OrgTeam> findByOrgId(UUID orgId);
    boolean existsByOrgIdAndName(UUID orgId, String name);
}
