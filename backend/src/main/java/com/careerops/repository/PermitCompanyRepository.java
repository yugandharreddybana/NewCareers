package com.careerops.repository;

import com.careerops.model.PermitCompany;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface PermitCompanyRepository extends JpaRepository<PermitCompany, Long> {

    Page<PermitCompany> findBySnapshotIdOrderByGrandTotalDesc(Long snapshotId, Pageable pageable);

    @Query("""
            SELECT pc FROM PermitCompany pc
            WHERE pc.snapshotId = :snapshotId
              AND (
                :q IS NULL OR :q = ''
                OR LOWER(pc.employerName) LIKE LOWER(CONCAT('%', :q, '%'))
                OR pc.employerNameNormalised LIKE CONCAT('%', LOWER(:q), '%')
              )
            ORDER BY pc.grandTotal DESC
            """)
    Page<PermitCompany> searchByName(
            @Param("q") String q,
            @Param("snapshotId") Long snapshotId,
            Pageable pageable);

    @Query("""
            SELECT pc FROM PermitCompany pc
            LEFT JOIN CompanyReliabilityScore crs
              ON crs.employerNameNormalised = pc.employerNameNormalised
            WHERE pc.snapshotId = :snapshotId
              AND (
                :q IS NULL OR :q = ''
                OR LOWER(pc.employerName) LIKE LOWER(CONCAT('%', :q, '%'))
                OR pc.employerNameNormalised LIKE CONCAT('%', LOWER(:q), '%')
              )
              AND (:momentum IS NULL OR pc.momentum = :momentum)
              AND (:status IS NULL OR pc.status = :status)
              AND (:tier IS NULL OR crs.reliabilityTier = :tier)
              AND (:minReliability IS NULL OR crs.reliabilityScore >= :minReliability)
            ORDER BY pc.grandTotal DESC
            """)
    Page<PermitCompany> searchWithFilters(
            @Param("snapshotId") Long snapshotId,
            @Param("q") String q,
            @Param("momentum") String momentum,
            @Param("status") String status,
            @Param("tier") String tier,
            @Param("minReliability") BigDecimal minReliability,
            Pageable pageable);

    Optional<PermitCompany> findByEmployerNameNormalisedAndSourceYear(
            String employerNameNormalised,
            int year);

    List<PermitCompany> findByEmployerNameNormalisedAndSnapshotId(
            String employerNameNormalised,
            Long snapshotId);

    @Query("""
            SELECT COUNT(pc) FROM PermitCompany pc
            WHERE pc.snapshotId = :snapshotId AND pc.grandTotal > 0
            """)
    long countActiveInSnapshot(@Param("snapshotId") Long snapshotId);
}
