package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "daily_activity_log", schema = "careerops")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@IdClass(DailyActivity.DailyActivityId.class)
public class DailyActivity {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Id
    @Column(name = "activity_date", nullable = false)
    private LocalDate activityDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private java.time.Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = java.time.Instant.now();
        if (activityDate == null) activityDate = LocalDate.now();
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class DailyActivityId implements Serializable {
        private static final long serialVersionUID = 1L;
        private UUID userId;
        private LocalDate activityDate;
    }
}

