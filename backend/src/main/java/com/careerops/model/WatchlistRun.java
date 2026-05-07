package com.careerops.model;

import com.fasterxml.jackson.databind.JsonNode;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "watchlist_runs", schema = "career_operations",
       indexes = {
           @Index(name = "idx_watchlist_runs_user", columnList = "user_id")
       })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WatchlistRun {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "watchlist_id", nullable = false)
    private UUID watchlistId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Builder.Default
    @Column(name = "matched_count", nullable = false)
    private int matchedCount = 0;

    @Builder.Default
    @Column(name = "new_count", nullable = false)
    private int newCount = 0;

    @Builder.Default
    @Type(JsonType.class)
    @Column(name = "job_ids", columnDefinition = "jsonb", nullable = false)
    private JsonNode jobIds = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();

    @Column(name = "run_at", nullable = false, updatable = false)
    private Instant runAt;

    @PrePersist
    void prePersist() {
        if (runAt == null) runAt = Instant.now();
    }
}
