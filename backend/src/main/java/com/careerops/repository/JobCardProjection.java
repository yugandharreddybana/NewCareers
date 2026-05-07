package com.careerops.repository;

import java.time.Instant;
import java.util.UUID;

public interface JobCardProjection {
    UUID getId();
    String getTitle();
    String getCompany();
    String getLocation();
    Instant getPostedAt();
}
