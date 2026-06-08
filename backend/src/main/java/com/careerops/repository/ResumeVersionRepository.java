package com.careerops.repository;

import com.careerops.model.ResumeVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ResumeVersionRepository extends JpaRepository<ResumeVersion, UUID> {
    List<ResumeVersion> findByUserIdOrderByVersionNumberDesc(UUID userId);
    Optional<ResumeVersion> findByIdAndUserId(UUID id, UUID userId);
    Optional<ResumeVersion> findByUserIdAndActiveTrue(UUID userId);
    int countByUserId(UUID userId);

    @Query("""
        SELECT COUNT(rv) FROM ResumeVersion rv
        WHERE rv.storagePath IS NOT NULL
        AND rv.userId IN (
            SELECT om.userId FROM OrgMember om
            WHERE om.orgId = :orgId AND om.status = 'active'
        )
        """)
    long countWithFileByOrgId(@Param("orgId") UUID orgId);
}
