package com.careerops.service;

import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Holds tailored resume HTML between {@code save_resume_html} (mid-agent) and
 * {@link SkillService} persisting the completed {@code tailor-resume} run.
 */
@Component
public class TailorResumePendingStore {

    private final ConcurrentHashMap<String, Pending> pending = new ConcurrentHashMap<>();

    public void put(UUID userId, UUID userJobId, String html, String storagePath) {
        if (userId == null || userJobId == null || html == null || html.isBlank()) {
            return;
        }
        pending.put(key(userId, userJobId), new Pending(html, storagePath));
    }

    public Pending take(UUID userId, UUID userJobId) {
        if (userId == null || userJobId == null) {
            return null;
        }
        return pending.remove(key(userId, userJobId));
    }

    private static String key(UUID userId, UUID userJobId) {
        return userId + ":" + userJobId;
    }

    public record Pending(String html, String storagePath) {}
}
