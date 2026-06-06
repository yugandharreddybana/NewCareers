package com.careerops.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class DeliveryErrorSanitizerTest {

    @Test
    void nullReturnsNull() {
        assertNull(DeliveryErrorSanitizer.forClient((String) null));
    }

    @Test
    void sqlStripped() {
        assertEquals(
                "Job matching hit a snag — try again from the dashboard.",
                DeliveryErrorSanitizer.forClient("duplicate key value violates unique constraint user_jobs_user_id_job_id_key"));
    }
}
