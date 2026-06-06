package com.careerops.repository;

import com.careerops.model.PermitSector;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PermitSectorRepository extends JpaRepository<PermitSector, Long> {

    List<PermitSector> findAllBySnapshotIdOrderByGrandTotalDesc(Long snapshotId);

    @Query("""
            SELECT ps FROM PermitSector ps
            WHERE ps.snapshotId = :snapshotId
              AND ps.sectorCode IN :codes
            ORDER BY ps.grandTotal DESC
            """)
    List<PermitSector> findByCodesAndSnapshot(
            @Param("codes") List<String> codes,
            @Param("snapshotId") Long snapshotId);

    @Query("""
            SELECT COALESCE(SUM(ps.grandTotal), 0) FROM PermitSector ps
            WHERE ps.snapshotId = :snapshotId
            """)
    long sumGrandTotal(@Param("snapshotId") Long snapshotId);

    Optional<PermitSector> findFirstBySnapshotIdOrderByGrandTotalDesc(Long snapshotId);

    List<PermitSector> findAllBySnapshotIdAndSourceYearOrderByGrandTotalDesc(
            Long snapshotId,
            int sourceYear);
}
