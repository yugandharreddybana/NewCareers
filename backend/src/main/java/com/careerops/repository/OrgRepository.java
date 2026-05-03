package com.careerops.repository;

import com.careerops.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrgRepository extends JpaRepository<Organization, UUID> {
    Optional<Organization> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
