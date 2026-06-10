package com.careerops.repository;

import com.careerops.model.UserProfile;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserProfileRepository extends JpaRepository<UserProfile, UUID> {
    /** Not @Cacheable — caching JPA entities breaks optimistic locking on profile writes. */
    Optional<UserProfile> findByUserId(UUID userId);
    List<UserProfile> findAllByOnboardedTrue();

    /** Updates onboarding_delivery without loading a cached/detached entity (avoids optimistic-lock races). */
    @CacheEvict(value = "user-profile", key = "#userId")
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        UPDATE careerops.user_profiles
        SET onboarding_delivery = CAST(:json AS JSON)
        WHERE user_id = :userId
        """, nativeQuery = true)
    int patchOnboardingDelivery(@Param("userId") UUID userId, @Param("json") String json);

    @Query(value = """
        SELECT onboarding_delivery
        FROM careerops.user_profiles
        WHERE user_id = :userId
        """, nativeQuery = true)
    String findOnboardingDeliveryJson(@Param("userId") UUID userId);
}

