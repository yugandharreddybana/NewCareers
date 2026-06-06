package com.careerops.repository;

import com.careerops.model.PermitSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PermitSnapshotRepository extends JpaRepository<PermitSnapshot, Long> {

    @Query("""
            SELECT ps FROM PermitSnapshot ps
            WHERE ps.sourceYear = :year AND ps.active = true
            """)
    Optional<PermitSnapshot> findActiveByYear(int year);

    @Query("""
            SELECT DISTINCT ps.sourceYear FROM PermitSnapshot ps
            WHERE ps.active = true
            ORDER BY ps.sourceYear DESC
            """)
    List<Integer> findAllActiveYears();
}
