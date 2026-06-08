package com.careerops.repository;

import com.careerops.model.ApplicationRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationRunRepository extends JpaRepository<ApplicationRun, UUID> {
    List<ApplicationRun> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<ApplicationRun> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, com.careerops.model.ApplicationRunStatus status);
    Optional<ApplicationRun> findByIdAndUserId(UUID id, UUID userId);
    List<ApplicationRun> findByUserJobId(UUID userJobId);
    boolean existsByUserIdAndUserJobIdAndStatusIn(UUID userId, UUID userJobId, java.util.Collection<com.careerops.model.ApplicationRunStatus> statuses);

    @Query("""
        SELECT COUNT(ar) FROM ApplicationRun ar
        WHERE ar.userId IN (
            SELECT om.userId FROM OrgMember om
            WHERE om.orgId = :orgId AND om.status = 'active'
        ) AND ar.createdAt >= :since
        """)
    long countByOrgIdAndCreatedAtAfter(@Param("orgId") UUID orgId, @Param("since") Instant since);
}
