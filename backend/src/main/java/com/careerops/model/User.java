package com.careerops.model;

import com.careerops.persistence.FieldEncryptionListener;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

/**
 * The application user.
 *
 * Pass 6 #6.005: the {@code role} column exists in V1 but was previously not
 * mapped on the entity. It is now exposed so {@code /auth/me} can return it
 * to the frontend's {@code AdminRoute} guard.
 *
 * Pass 6 #10.004: the {@code username} column is added by V38 with a
 * deterministic backfill so existing rows continue to validate.
 */
@Entity
@EntityListeners({AuditEntityListener.class, FieldEncryptionListener.class})
@Table(name = "users", schema = "careerops")
@org.hibernate.annotations.SQLRestriction("deleted_at IS NULL")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    /** Application-level role. Promotion to ADMIN happens out-of-band. */
    public enum Role { USER, ADMIN }

    /** How the user authenticates. */
    public enum AuthProvider { LOCAL, GOOGLE }

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false) private String name;
    @Column(unique = true, nullable = false) private String username;
    @Column(unique = true, nullable = false) private String email;
    @Column(name = "password_hash") private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "auth_provider", nullable = false)
    @Builder.Default
    private AuthProvider authProvider = AuthProvider.LOCAL;

    @Column(name = "google_sub", unique = true)
    private String googleSub;
    @Column(name = "created_at") private Instant createdAt;

    /**
     * Role mapped from the existing {@code role VARCHAR} column.
     * Stored as a String so the DB-level CHECK constraint (added in V38)
     * controls the value-set rather than a JPA enum mapping that could
     * silently accept new values from a future codepath.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Role role = Role.USER;

    // Task 136 — soft-delete: set by AdminService.softDeleteUser(), never hard-deleted
    @Column(name = "deleted_at")
    private Instant deletedAt;

    // 3.002 — Brute-force protection
    @Column(name = "failed_login_attempts", nullable = false)
    @Builder.Default
    private int failedLoginAttempts = 0;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "locale", length = 10)
    @Builder.Default
    private String locale = "en";

    @Column(name = "last_login_at")
    private Instant lastLoginAt;
 
    @Column(name = "ai_processing_consent", nullable = false)
    @Builder.Default
    private boolean aiProcessingConsent = true;

    /** Preferred org for subscription/billing when the user belongs to multiple orgs. */
    @Column(name = "primary_billing_organization_id")
    private UUID primaryBillingOrganizationId;

    @PrePersist void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (role == null)      role      = Role.USER;
        if (locale == null)    locale    = "en";
        if (email != null)     email     = email.toLowerCase();
    }

    @PreUpdate void onUpdate() {
        if (email != null)     email     = email.toLowerCase();
    }
}

