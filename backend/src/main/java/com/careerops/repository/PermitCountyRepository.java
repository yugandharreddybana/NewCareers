package com.careerops.repository;

import com.careerops.model.PermitCounty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PermitCountyRepository extends JpaRepository<PermitCounty, Long> {

    List<PermitCounty> findAllBySnapshotIdOrderByIssuedDesc(Long snapshotId);

    Optional<PermitCounty> findFirstBySnapshotIdOrderByIssuedDesc(Long snapshotId);
}
