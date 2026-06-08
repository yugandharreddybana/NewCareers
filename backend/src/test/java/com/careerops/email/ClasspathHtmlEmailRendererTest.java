package com.careerops.email;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ClasspathHtmlEmailRendererTest {

    @Test
    void rendersWelcomeTemplateWithPlaceholders() {
        String html = ClasspathHtmlEmailRenderer.render("welcome-trial.html", Map.of(
                "firstName", "Alice",
                "trialEndsAt", "June 14, 2026",
                "daysRemaining", "7",
                "upgradeUrl", "https://app.example/pricing",
                "appBaseUrl", "https://app.example"));

        assertTrue(html.contains("Alice"));
        assertTrue(html.contains("June 14, 2026"));
        assertTrue(html.contains("7-day Pro trial"));
    }
}
