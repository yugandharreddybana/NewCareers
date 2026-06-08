package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "user_two_factor", schema = "careerops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserTwoFactor {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "secret_encrypted")
    private String secretEncrypted;

    @Column(name = "pending_secret_encrypted")
    private String pendingSecretEncrypted;

    @Column(name = "enabled_at")
    private Instant enabledAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "backup_codes_hash", columnDefinition = "jsonb")
    private List<String> backupCodesHash;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public boolean isEnabled() {
        return enabledAt != null && secretEncrypted != null && !secretEncrypted.isBlank();
    }
}
