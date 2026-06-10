package com.careerops.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InternalHmacSignerTest {

    private static final byte[] SECRET =
            "test-internal-trust-secret-minimum-32-characters-long".getBytes(StandardCharsets.UTF_8);

    private InternalHmacSigner signer;

    @BeforeEach
    void setUp() {
        signer = InternalHmacSigner.forTest(SECRET);
    }

    @Test
    @DisplayName("sign and verify round-trip")
    void roundTrip() {
        long ts = 1_700_000_000_000L;
        byte[] body = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
        String sig = signer.sign(ts, "POST", "/jobs/fetch", body);
        assertThat(signer.verify(ts, "POST", "/jobs/fetch", body, sig)).isTrue();
    }

    @Test
    @DisplayName("tampered body fails verification")
    void tamperedBody() {
        long ts = System.currentTimeMillis();
        String sig = signer.sign(ts, "GET", "/profile", new byte[0]);
        assertThat(signer.verify(ts, "GET", "/profile", "{\"x\":1}".getBytes(StandardCharsets.UTF_8), sig))
                .isFalse();
    }

    @Test
    @DisplayName("rejects stale timestamps outside replay window")
    void replayWindow() {
        long stale = System.currentTimeMillis() - InternalHmacSigner.DEFAULT_MAX_SKEW_MS - 1;
        assertThat(signer.isTimestampFresh(stale)).isFalse();
        assertThat(signer.isTimestampFresh(System.currentTimeMillis())).isTrue();
    }

    @Test
    @DisplayName("rejects secrets shorter than 32 characters")
    void shortSecret() {
        assertThatThrownBy(() -> InternalHmacSigner.forTest("short".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Node-generated multipart probe verifies with ISO-8859-1")
    void nodeGeneratedMultipartProbe() throws Exception {
        Path resources = Path.of("src/test/resources");
        byte[] body = Files.readAllBytes(resources.resolve("probe-multipart.bin"));
        JsonNode meta = new ObjectMapper().readTree(resources.resolve("probe-multipart.meta.json").toFile());
        long ts = meta.get("timestamp").asLong();
        String sig = meta.get("signature").asText();

        assertThat(signer.verify(ts, "POST", "/profile/cv", body, sig)).isTrue();
        assertThat(signer.verifyLegacyUtf8Body(ts, "POST", "/profile/cv", body, sig)).isFalse();
    }

    @Test
    @DisplayName("binary multipart body matches middleware latin1 signing")
    void binaryBodyMatchesMiddlewareLatin1() {
        long ts = 1_700_000_000_000L;
        byte[] body = new byte[] {(byte) 0xFF, (byte) 0xFE, 0x61};
        String sig = signer.sign(ts, "POST", "/profile/cv", body);
        assertThat(sig).isEqualTo("e35fc74380536ed1b9be9fd7cb6386ccc1cbad3d4f6aad6e561c374002d2c642");
        assertThat(signer.verify(ts, "POST", "/profile/cv", body, sig)).isTrue();
    }
}
