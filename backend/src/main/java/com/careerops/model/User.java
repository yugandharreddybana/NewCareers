package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false) private String name;
    @Column(unique = true, nullable = false) private String username;
    @Column(unique = true, nullable = false) private String email;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(name = "created_at") private Instant createdAt;

    @PrePersist void onCreate() { if (createdAt == null) createdAt = Instant.now(); }
}
