package com.careerops.repository;

import com.careerops.model.Referral;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Section 9 — Task 95.
 */
@Repository
public interface ReferralRepository extends JpaRepository<Referral, UUID> {

    /** All referrals sent by a given user, newest first. */
    List<Referral> findByReferrerIdOrderByCreatedAtDesc(UUID referrerId);

    /** Look up a referral by its unique invite token (used on signup page). */
    Optional<Referral> findByToken(UUID token);

    /**
     * Find ANY pending referral that matches a referee email.
     * Used by onRefereeSignup to credit the referrer.
     */
    @Query("SELECT r FROM Referral r WHERE r.refereeEmail = :email AND r.status = 'pending' ORDER BY r.createdAt ASC")
    Optional<Referral> findPendingByRefereeEmail(@Param("email") String email);

    /** General lookup by referee email regardless of status. */
    Optional<Referral> findByRefereeEmail(String refereeEmail);

    /** Count stats for the referrer dashboard. */
    long countByReferrerIdAndStatus(UUID referrerId, String status);
}
