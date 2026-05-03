package com.careerops.repository;

import com.careerops.model.SsoProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SsoProviderRepository extends JpaRepository<SsoProvider, UUID> {
    List<SsoProvider> findByOrgId(UUID orgId);
    Optional<SsoProvider> findFirstByOrgId(UUID orgId);
}
