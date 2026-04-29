package com.careerops.repository;

import com.careerops.model.ApplicationCv;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ApplicationCvRepository extends JpaRepository<ApplicationCv, UUID> {
    List<ApplicationCv> findByUserJobId(UUID userJobId);
}
