package com.careerops.util;

import java.nio.ByteBuffer;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.UUID;

/** Helpers for native SQL result rows (H2 may return UUID columns as byte[]). */
public final class NativeSqlUtil {

    private NativeSqlUtil() {}

    public static UUID coerceUuid(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof UUID uuid) {
            return uuid;
        }
        if (value instanceof byte[] bytes) {
            if (bytes.length != 16) {
                throw new IllegalArgumentException("Expected 16-byte UUID, got " + bytes.length);
            }
            ByteBuffer bb = ByteBuffer.wrap(bytes);
            return new UUID(bb.getLong(), bb.getLong());
        }
        if (value instanceof String s && !s.isBlank()) {
            return UUID.fromString(s.trim());
        }
        throw new IllegalArgumentException("Cannot coerce " + value.getClass().getName() + " to UUID");
    }

    /** Native queries may return timestamptz as Timestamp, Instant, or java.time types depending on DB/driver. */
    public static Instant coerceInstant(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof Timestamp ts) {
            return ts.toInstant();
        }
        if (value instanceof OffsetDateTime odt) {
            return odt.toInstant();
        }
        if (value instanceof ZonedDateTime zdt) {
            return zdt.toInstant();
        }
        if (value instanceof LocalDateTime ldt) {
            return ldt.atOffset(ZoneOffset.UTC).toInstant();
        }
        if (value instanceof java.util.Date d) {
            return d.toInstant();
        }
        throw new IllegalArgumentException("Cannot coerce " + value.getClass().getName() + " to Instant");
    }
}
