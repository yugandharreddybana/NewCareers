package com.careerops.repository;

import com.careerops.model.ApplicationCv;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ApplicationCvRepository extends JpaRepository<ApplicationCv, UUID> {
    List<ApplicationCv> findByUserJobId(UUID userJobId);

    @Query("""
        SELECT COUNT(ac) FROM ApplicationCv ac
        WHERE ac.userJobId IN (
            SELECT uj.id FROM UserJob uj
            WHERE uj.userId IN (
                SELECT om.userId FROM OrgMember om
                WHERE om.orgId = :orgId AND om.status = 'active'
            )
        )
        """)
    long countByOrgId(@Param("orgId") UUID orgId);
}
