package com.careerops.repository;

import com.careerops.model.Job;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@org.springframework.stereotype.Repository
@org.springframework.transaction.annotation.Transactional(readOnly = true)
public interface JobRepository extends JpaRepository<Job, UUID> {
    Optional<Job> findByFingerprint(String fingerprint);
    Page<JobCardProjection> findAllProjectedBy(Pageable pageable);
    List<Job> findBySourceNameAndScrapedAtAfter(String sourceName, Instant scrapedAt);

    @Query("""
            SELECT j FROM Job j
            WHERE j.scrapedAt >= :cutoff
               OR (j.scrapedAt IS NULL AND j.postedAt >= :cutoff)
            ORDER BY j.scrapedAt DESC NULLS LAST, j.postedAt DESC NULLS LAST
            """)
    List<Job> findRecentByScrapedAtAfter(@Param("cutoff") Instant cutoff, Pageable page);

    @Query("""
            SELECT j FROM Job j
            WHERE j.id IN (
                SELECT uj.jobId FROM UserJob uj
                WHERE uj.userId = :userId AND uj.deletedAt IS NULL
            )
            """)
    List<Job> findAllOwnedByUser(@Param("userId") UUID userId);
}
