package com.careerops.repository;

import com.careerops.model.UserPermitWatchlist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserPermitWatchlistRepository extends JpaRepository<UserPermitWatchlist, Long> {

    List<UserPermitWatchlist> findByUserIdOrderByAddedAtDesc(UUID userId);

    boolean existsByUserIdAndEmployerNameNormalised(UUID userId, String employerNameNormalised);

    void deleteByUserIdAndEmployerNameNormalised(UUID userId, String employerNameNormalised);
}
