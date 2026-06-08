package com.careerops.repository;

import com.careerops.model.RevokedJwtJti;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RevokedJwtJtiRepository extends JpaRepository<RevokedJwtJti, String> {
    boolean existsByJti(String jti);
}
