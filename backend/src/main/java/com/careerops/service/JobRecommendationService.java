package com.careerops.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Section 7 — Task 70
 * Recommends the top 5 jobs from the user's existing pipeline.
 *
 * Algorithm:
 *   1. Identify user's top 3 most-used skill types from skill_runs
 *   2. Query user_jobs WHERE kanban_column = 'Discovered'
 *      ORDER BY match_percent DESC, LIMIT 5
 *   3. Per job, generate a "whyRecommended" label:
 *        ≥ 90% match  → "Exceptional match — {pct}% profile fit"
 *        ≥ 75% match  → "Strong match — {pct}% profile fit"
 *        skill overlap → "Uses your top skill: {skill}"
 *        fallback      → "Recommended based on your profile"
 */
@Service
public class JobRecommendationService {

    private static final Logger log = LoggerFactory.getLogger(JobRecommendationService.class);

    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRecommendations(UUID userId) {
        List<String> topSkills = getTopSkills(userId, 3);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT uj.id, j.title, j.company, j.location,
                       uj.match_percent, uj.matched_skills,
                       j.salary_min, j.salary_max, j.currency,
                       j.source_url, j.source_name, j.posted_at
                FROM user_jobs uj
                JOIN jobs j ON j.id = uj.job_id
                WHERE uj.user_id    = :userId
                  AND uj.kanban_column = 'Discovered'
                  AND uj.match_percent IS NOT NULL
                ORDER BY uj.match_percent DESC
                LIMIT 5
                """)
                .setParameter("userId", userId)
                .getResultList();

        List<Map<String, Object>> results = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userJobId",      row[0]);
            item.put("title",          row[1]);
            item.put("company",        row[2]);
            item.put("location",       row[3]);
            item.put("matchPercent",   row[4] != null ? ((Number) row[4]).intValue() : 0);
            item.put("salaryMin",      row[6]);
            item.put("salaryMax",      row[7]);
            item.put("currency",       row[8]);
            item.put("sourceUrl",      row[9]);
            item.put("sourceName",     row[10]);
            item.put("postedAt",       row[11]);
            item.put("whyRecommended", buildReason(row, topSkills));
            results.add(item);
        }

        log.debug("Returning {} recommendations for user {}", results.size(), userId);
        return results;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<String> getTopSkills(UUID userId, int limit) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT skill, COUNT(*) AS cnt
                FROM skill_runs
                WHERE user_id = :userId
                GROUP BY skill
                ORDER BY cnt DESC
                LIMIT :limit
                """)
                .setParameter("userId", userId)
                .setParameter("limit",  limit)
                .getResultList();

        List<String> skills = new ArrayList<>();
        for (Object[] row : rows) {
            if (row[0] instanceof String s) skills.add(s);
        }
        return skills;
    }

    private String buildReason(Object[] row, List<String> topSkills) {
        int    pct          = row[4] != null ? ((Number) row[4]).intValue() : 0;
        String matchedRaw   = row[5] instanceof String s ? s.toLowerCase() : "";

        if (pct >= 90) return "Exceptional match — " + pct + "% profile fit";
        if (pct >= 75) return "Strong match — " + pct + "% profile fit";

        for (String skill : topSkills) {
            if (!skill.isBlank() && matchedRaw.contains(skill.toLowerCase())) {
                return "Uses your top skill: " + prettify(skill);
            }
        }

        return "Recommended for your profile — " + pct + "% match";
    }

    private static String prettify(String s) {
        String spaced = s.replace("-", " ");
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }
}
