package com.careerops.service;

import com.careerops.repository.SkillConversationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Background job that cleans up expired skill conversations.
 *
 * Runs every 15 minutes.
 * Deletes all skill_conversations rows where:
 *   - status = 'pending_answer'
 *   - expires_at < now()
 *
 * This prevents the table from growing indefinitely when users
 * abandon mid-skill conversations without answering.
 */
@Component
public class SkillConversationCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(SkillConversationCleanupJob.class);

    private final SkillConversationRepository repo;

    public SkillConversationCleanupJob(SkillConversationRepository repo) {
        this.repo = repo;
    }

    /**
     * Every 15 minutes, purge expired pending conversations.
     * fixedDelay = 15 * 60 * 1000 = 900_000 ms
     */
    @Scheduled(fixedDelay = 900_000)
    public void purgeExpired() {
        try {
            int deleted = repo.deleteAllExpired(Instant.now());
            if (deleted > 0) {
                log.debug("SkillConversationCleanup: deleted {} expired conversations", deleted);
            }
        } catch (Exception e) {
            // Never let cleanup failure crash the app
            log.warn("SkillConversationCleanup failed: {}", e.getMessage());
        }
    }
}
