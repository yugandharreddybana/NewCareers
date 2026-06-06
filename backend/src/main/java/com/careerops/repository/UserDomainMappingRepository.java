package com.careerops.repository;

import com.careerops.model.UserDomainMapping;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserDomainMappingRepository extends JpaRepository<UserDomainMapping, Long> {

    List<UserDomainMapping> findByDomainKeyIgnoreCase(String domainKey);
}
