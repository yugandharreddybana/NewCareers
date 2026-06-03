package com.careerops.util;

import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class NativeSqlUtilTest {

    @Test
    void coerceUuid_fromByteArray() {
        UUID expected = UUID.fromString("747317c4-7432-4d51-a629-72de054c8a90");
        byte[] bytes = uuidToBytes(expected);
        assertThat(NativeSqlUtil.coerceUuid(bytes)).isEqualTo(expected);
    }

    @Test
    void coerceUuid_fromString() {
        UUID expected = UUID.fromString("747317c4-7432-4d51-a629-72de054c8a90");
        assertThat(NativeSqlUtil.coerceUuid(expected.toString())).isEqualTo(expected);
    }

    @Test
    void coerceInstant_fromTimestampAndJavaTime() {
        Instant expected = Instant.parse("2026-01-15T12:00:00Z");
        assertThat(NativeSqlUtil.coerceInstant(Timestamp.from(expected))).isEqualTo(expected);
        assertThat(NativeSqlUtil.coerceInstant(expected)).isEqualTo(expected);
        assertThat(NativeSqlUtil.coerceInstant(OffsetDateTime.ofInstant(expected, ZoneOffset.UTC)))
            .isEqualTo(expected);
        assertThat(NativeSqlUtil.coerceInstant(LocalDateTime.of(2026, 1, 15, 12, 0)))
            .isEqualTo(expected);
    }

    private static byte[] uuidToBytes(UUID uuid) {
        byte[] bytes = new byte[16];
        long msb = uuid.getMostSignificantBits();
        long lsb = uuid.getLeastSignificantBits();
        for (int i = 0; i < 8; i++) bytes[i] = (byte) (msb >>> 8 * (7 - i));
        for (int i = 8; i < 16; i++) bytes[i] = (byte) (lsb >>> 8 * (15 - i));
        return bytes;
    }
}
