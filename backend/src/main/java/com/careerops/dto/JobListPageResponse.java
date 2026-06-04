package com.careerops.dto;

import com.careerops.repository.JobCardProjection;
import lombok.Value;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Paginated wrapper returned by all job-list endpoints.
 * Clients get totalElements and totalPages so they can render pagination controls
 * without a separate count call.
 */
@Value
public class JobListPageResponse {
    List<JobCardProjection> content;
    int  page;
    int  size;
    long totalElements;
    int  totalPages;
    boolean last;

    public static JobListPageResponse of(Page<JobCardProjection> p) {
        return new JobListPageResponse(
                p.getContent(),
                p.getNumber(),
                p.getSize(),
                p.getTotalElements(),
                p.getTotalPages(),
                p.isLast()
        );
    }
}
