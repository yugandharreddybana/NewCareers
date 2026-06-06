package com.careerops.model;

import lombok.Data;

import java.time.Instant;

/** Lightweight scraped job row before persistence as {@link Job}. */
@Data
public class JobListing {
    private String title;
    private String company;
    private String location;
    private String url;
    private String source;
    private String description;
    private Instant postedAt;
    private Integer matchScore;
}
