package com.careerops.repository;

import com.careerops.model.CompanyReliabilityScore;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CompanyReliabilityScoreRepository extends JpaRepository<CompanyReliabilityScore, Long> {

    Optional<CompanyReliabilityScore> findByEmployerNameNormalised(String employerNameNormalised);

    Page<CompanyReliabilityScore> findByReliabilityTierOrderByReliabilityScoreDesc(
            String reliabilityTier,
            Pageable pageable);

    @Query("""
            SELECT crs FROM CompanyReliabilityScore crs
            WHERE LOWER(crs.canonicalName) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY crs.reliabilityScore DESC
            """)
    Page<CompanyReliabilityScore> searchByCanonicalName(@Param("q") String q, Pageable pageable);

    Page<CompanyReliabilityScore> findAllByOrderByReliabilityScoreDesc(Pageable pageable);

    @Query("""
            SELECT crs FROM CompanyReliabilityScore crs
            WHERE (:tier IS NULL OR crs.reliabilityTier = :tier)
            ORDER BY crs.reliabilityScore DESC
            """)
    Page<CompanyReliabilityScore> findTopScorers(
            @Param("tier") String tier,
            Pageable pageable);
}
