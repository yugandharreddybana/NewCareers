package com.careerops.email;

import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Loads HTML email templates from {@code classpath:emails/} and substitutes {@code {{key}}} placeholders.
 */
public final class ClasspathHtmlEmailRenderer {

    private ClasspathHtmlEmailRenderer() {}

    public static String render(String templateFileName, Map<String, String> placeholders) {
        String template = loadTemplate(templateFileName);
        String html = template;
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            String value = entry.getValue() != null ? entry.getValue() : "";
            html = html.replace("{{" + entry.getKey() + "}}", value);
        }
        return html;
    }

    private static String loadTemplate(String templateFileName) {
        try {
            ClassPathResource resource = new ClassPathResource("emails/" + templateFileName);
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load email template: " + templateFileName, ex);
        }
    }
}
