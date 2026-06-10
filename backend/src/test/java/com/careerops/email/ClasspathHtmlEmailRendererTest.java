package com.careerops.email;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClasspathHtmlEmailRendererTest {

    @Test
    void substitutesPlaceholdersWhenTemplateExists() {
        String html = ClasspathHtmlEmailRenderer.render("smoke-test.html", Map.of(
                "firstName", "Alice",
                "appBaseUrl", "https://app.example"));

        assertTrue(html.contains("Alice"));
        assertTrue(html.contains("https://app.example"));
    }

    @Test
    void missingTemplateThrows() {
        assertThrows(IllegalStateException.class, () ->
                ClasspathHtmlEmailRenderer.render("does-not-exist.html", Map.of()));
    }
}
