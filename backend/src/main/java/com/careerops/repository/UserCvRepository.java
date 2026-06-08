package com.careerops.repository;

import com.careerops.model.UserCv;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserCvRepository extends JpaRepository<UserCv, UUID> {

    /** All CVs for a user, newest-first — used by CvController list endpoint */
    List<UserCv> findByUserIdOrderByUploadedAtDesc(UUID userId);

    /** Single active CV — used by AI matching / skill scoring services */
    Optional<UserCv> findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(UUID userId);

    void deleteByUserId(UUID userId);

    @Query("""
        SELECT COUNT(cv) FROM UserCv cv
        WHERE cv.userId IN (
            SELECT om.userId FROM OrgMember om
            WHERE om.orgId = :orgId AND om.status = 'active'
        )
        """)
    long countByOrgId(@Param("orgId") UUID orgId);
}
