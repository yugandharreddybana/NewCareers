package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "jobs", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Job {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;

    @Column(unique = true, nullable = false) private String fingerprint;
    @Column(nullable = false) private String title;
    @Column(nullable = false) private String company;
    private String location;

    @Column(name = "salary_min") private Integer salaryMin;
    @Column(name = "salary_max") private Integer salaryMax;
    private String currency;
    private Boolean sponsorship;

    @Lob private String description;

    @Column(name = "source_url")  private String sourceUrl;
    @Column(name = "source_name") private String sourceName;
    private String sector;

    @Column(name = "posted_at")  private Instant postedAt;
    @Column(name = "scraped_at") private Instant scrapedAt;

    @PrePersist void onCreate() {
        if (scrapedAt == null) scrapedAt = Instant.now();
        if (currency == null) currency = "EUR";
    }
}
