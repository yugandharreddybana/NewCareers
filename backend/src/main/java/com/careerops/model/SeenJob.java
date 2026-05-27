package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "seen_jobs", schema = "careerops",
       indexes = {
           @Index(name = "idx_seen_jobs_seen_at", columnList = "seen_at")
       })
@IdClass(SeenJob.PK.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SeenJob {
    @Id @Column(name = "user_id") private UUID userId;
    @Id private String fingerprint;
    @Column(name = "seen_at") private Instant seenAt;

    @PrePersist void onCreate() { if (seenAt == null) seenAt = Instant.now(); }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class PK implements Serializable {
        private static final long serialVersionUID = 1L;
        private UUID userId;
        private String fingerprint;
        @Override public boolean equals(Object o){
            if(!(o instanceof PK p))return false;
            return Objects.equals(userId,p.userId)&&Objects.equals(fingerprint,p.fingerprint);
        }
        @Override public int hashCode(){return Objects.hash(userId,fingerprint);}
    }
}

