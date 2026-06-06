package com.careerops.permit;

import java.time.Instant;
import java.util.List;

/**
 * Published when the enterprise.gov.ie permit ingest script exits non-zero.
 */
public record PermitIngestionFailedEvent(
        int exitCode,
        List<String> args,
        String stderrTail,
        Instant failedAt
) {}
