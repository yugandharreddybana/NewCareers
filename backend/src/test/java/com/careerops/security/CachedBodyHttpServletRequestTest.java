package com.careerops.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Part;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class CachedBodyHttpServletRequestTest {

    @Test
    @DisplayName("replayed multipart body exposes file part after HMAC read")
    void replayedMultipartExposesFilePart() throws Exception {
        Path resources = Path.of("src/test/resources");
        byte[] body = Files.readAllBytes(resources.resolve("probe-multipart.bin"));
        JsonNode meta = new ObjectMapper().readTree(resources.resolve("probe-multipart.meta.json").toFile());
        String contentType = meta.get("contentType").asText();

        MockHttpServletRequest original = new MockHttpServletRequest("POST", "/profile/cv");
        original.setServletPath("/profile/cv");
        original.setContentType(contentType);

        CachedBodyHttpServletRequest replayable = new CachedBodyHttpServletRequest(original, body);

        Part filePart = replayable.getPart("file");
        assertThat(filePart).isNotNull();
        assertThat(filePart.getSubmittedFileName()).isEqualTo("t.pdf");
        assertThat(filePart.getSize()).isPositive();
    }
}
