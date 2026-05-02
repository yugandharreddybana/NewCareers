package com.careerops.repository;

import com.careerops.model.ResumeVersionAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ResumeVersionAssetRepository extends JpaRepository<ResumeVersionAsset, UUID> {
    List<ResumeVersionAsset> findByVersionId(UUID versionId);
    List<ResumeVersionAsset> findByUserId(UUID userId);
    void deleteByVersionId(UUID versionId);
}
