package com.careerops.billing;

import java.time.Instant;

public record StripeInvoiceRecord(
        String id,
        long amountDue,
        String currency,
        String status,
        Instant createdAt,
        String pdfUrl) {}
