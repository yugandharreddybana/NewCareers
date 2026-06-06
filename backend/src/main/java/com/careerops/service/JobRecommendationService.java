package com.careerops.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.careerops.util.NativeSqlUtil;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Section 7 — Task 70
 * Recommends top 5 jobs from the user's Discovered pipeline.
 *
 * Scoring algorithm (higher = more recommended):
 *
 *   Base score   = user_jobs.match_percent
 *
 *   Profile bonuses (added to base score):
 *     +10  sponsorship bonus   — user needs sponsorship AND job offers it
 *     + 8  location bonus      — job location contains user's preferred location
 *     + 6  target role bonus   — job title matches one of user's target roles
 *     + 5  salary bonus        — job salary_min ≥ user's salary_min preference
 *
 *   Behavioural signal:
 *     + 4  already-evaluated skills bonus — job matches skills seen in
 *          Applied/Interview/Offer stage jobs (indicates user has a track record)
 *
 *   Salary hard filter:
 *     Excludes jobs where salary_max is known AND salary_max < user salary_min
 *
 * The query fetches up to 20 candidates from 'Discovered', applies the Java-side
 * scoring, re-sorts, and returns the top 5 with a human-readable whyRecommended label.
 */
@Service
public class JobRecommendationService {

    private static final Logger log = LoggerFactory.getLogger(JobRecommendationService.class);

    @PersistenceContext
    private EntityManager em;

    // ── Public API ───────────────────────────────────────────────────────────────

    @Transactional(timeout = 10, readOnly = true)
    public List<com.careerops.dto.JobDtos.RecommendationResponse> getRecommendations(UUID userId) {
        // Step 1 — User profile preferences
        ProfileData profile  = loadProfile(userId);

        // Step 2 — Top skills from skill_runs (behavioural signal)
        List<String> topSkills = getTopSkills(userId, 5);

        // Step 3 — Skills appearing in already-evaluated (applied+) jobs
        Set<String> evaluatedSkills = getEvaluatedSkills(userId);

        // Step 4 — Fetch candidate Discovered jobs (salary hard-filter applied in SQL)
        List<Object[]> rows = queryCandidates(userId, profile);

        // Step 5 — Score each candidate using profile + behavioural signals
        record Scored(Object[] row, int score, String reason) {}

        List<Scored> scored = rows.stream()
            .map(row -> {
                int base   = row[4] != null ? ((Number) row[4]).intValue() : 0;
                int bonus  = 0;
                String reason;

                // Sponsorship bonus
                boolean jobSponsors = Boolean.TRUE.equals(row[12]);
                if (Boolean.TRUE.equals(profile.sponsorshipRequired()) && jobSponsors) {
                    bonus += 10;
                }

                // Location bonus
                if (profile.location() != null && row[3] instanceof String loc
                        && loc.toLowerCase().contains(profile.location().toLowerCase())) {
                    bonus += 8;
                }

                // Target role bonus
                if (profile.targetRoles() != null && row[1] instanceof String title) {
                    String titleL = title.toLowerCase();
                    for (String role : profile.targetRoles()) {
                        if (role != null && !role.isBlank()
                                && titleL.contains(role.toLowerCase())) {
                            bonus += 6;
                            break;
                        }
                    }
                }

                // Salary bonus
                if (profile.salaryMin() != null && row[6] instanceof Number sMin
                        && sMin.intValue() >= profile.salaryMin()) {
                    bonus += 5;
                }

                // Already-evaluated skills bonus
                String matchedRaw = matchedSkillsToDelimitedString(row[5]);
                if (!evaluatedSkills.isEmpty() && !matchedRaw.isBlank()) {
                    String matchedL = matchedRaw.toLowerCase();
                    boolean hasEvalSkill = evaluatedSkills.stream()
                        .anyMatch(sk -> matchedL.contains(sk.toLowerCase()));
                    if (hasEvalSkill) bonus += 4;
                }

                reason = buildReason(base + bonus, row, topSkills, profile,
                                     jobSponsors, evaluatedSkills);
                return new Scored(row, base + bonus, reason);
            })
            .sorted(Comparator.comparingInt(Scored::score).reversed())
            .limit(5)
            .collect(Collectors.toList());

        // Step 6 — Map to output
        List<com.careerops.dto.JobDtos.RecommendationResponse> results = new ArrayList<>();
        for (Scored s : scored) {
            Object[] row  = s.row();
            results.add(new com.careerops.dto.JobDtos.RecommendationResponse(
                NativeSqlUtil.coerceUuid(row[0]),
                (String) row[1],
                (String) row[2],
                (String) row[3],
                row[4] != null ? ((Number) row[4]).intValue() : 0,
                row[6] != null ? ((Number) row[6]).intValue() : null,
                row[7] != null ? ((Number) row[7]).intValue() : null,
                (String) row[8],
                (String) row[9],
                (String) row[10],
                NativeSqlUtil.coerceInstant(row[11]),
                (Boolean) row[12],
                s.reason()
            ));
        }

        log.debug("Returning {} recommendations for user {}", results.size(), userId);
        return results;
    }

    // ── Database queries ───────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Object[]> queryCandidates(UUID userId, ProfileData profile) {
        // Salary hard-filter: exclude jobs where salary_max is known AND below user's minimum
        int salaryMin = profile.salaryMin() != null ? profile.salaryMin() : 0;
        int minMatch = profile.minMatchPercent() != null && profile.minMatchPercent() > 0
                ? profile.minMatchPercent()
                : com.careerops.model.UserProfile.DEFAULT_MIN_MATCH_PERCENT;
        return em.createNativeQuery("""
                SELECT uj.id, j.title, j.company, j.location,
                       uj.match_percent, uj.matched_skills,
                       j.salary_min, j.salary_max, j.currency,
                       j.source_url, j.source_name, j.posted_at, j.sponsorship
                FROM careerops.user_jobs uj
                JOIN careerops.jobs j ON j.id = uj.job_id
                WHERE uj.user_id         = :userId
                  AND uj.deleted_at      IS NULL
                  AND uj.kanban_column   = 'Discovered'
                  AND uj.match_percent   IS NOT NULL
                  AND uj.match_percent   >= :minMatch
                  AND (:salaryMin        = 0
                       OR j.salary_max   IS NULL
                       OR j.salary_max   >= :salaryMin)
                ORDER BY uj.match_percent DESC
                LIMIT 20
                """)
                .setParameter("userId",    userId)
                .setParameter("salaryMin", salaryMin)
                .setParameter("minMatch",  minMatch)
                .getResultList();
    }

    private List<String> getTopSkills(UUID userId, int limit) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT skill, COUNT(*) AS cnt
                FROM careerops.skill_runs
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

    /**
     * Returns the union of matched_skills from all Applied/Interview/Offer jobs.
     * Used as a behavioural signal: if a Discovered job matches skills the user
     * has already pursued, it is a stronger recommendation.
     */
    @SuppressWarnings("unchecked")
    private Set<String> getEvaluatedSkills(UUID userId) {
        List<Object> rows = em.createNativeQuery("""
                SELECT uj.matched_skills
                FROM careerops.user_jobs uj
                WHERE uj.user_id       = :userId
                  AND uj.kanban_column IN ('Applied', 'Interview', 'Offer')
                  AND uj.matched_skills IS NOT NULL
                """)
                .setParameter("userId", userId)
                .getResultList();
        Set<String> skills = new HashSet<>();
        for (Object raw : rows) {
            String delimited = matchedSkillsToDelimitedString(raw);
            if (delimited.isBlank()) continue;
            for (String sk : delimited.split(",")) {
                String trimmed = sk.trim();
                if (!trimmed.isBlank()) skills.add(trimmed);
            }
        }
        return skills;
    }

    /**
     * Loads profile preferences for scoring.
     * Uses array_to_string() to avoid Java-side sql.Array handling of text[] columns.
     */
    private ProfileData loadProfile(UUID userId) {
        try {
            Object[] row = (Object[]) em.createNativeQuery("""
                    SELECT location,
                           salary_min,
                           sponsorship_required,
                           array_to_string(target_roles, ','),
                           min_match_percent
                    FROM careerops.user_profiles
                    WHERE user_id = :userId
                    """)
                    .setParameter("userId", userId)
                    .getSingleResult();

            String   location    = row[0] instanceof String  s ? s       : null;
            Integer  salaryMin   = row[1] instanceof Number  n ? n.intValue() : null;
            Boolean  sponsorship = row[2] instanceof Boolean b ? b       : null;
            String[] targetRoles = row[3] instanceof String  t && !t.isBlank()
                                   ? t.split(",") : new String[0];
            Integer  minMatch    = row[4] instanceof Number  m ? m.intValue() : null;

            return new ProfileData(location, salaryMin, sponsorship, targetRoles, minMatch);
        } catch (Exception e) {
            log.warn("Could not load profile for user {}: {}", userId, e.getMessage());
            return new ProfileData(null, null, null, new String[0],
                    com.careerops.model.UserProfile.DEFAULT_MIN_MATCH_PERCENT);
        }
    }

    // ── Reason label ────────────────────────────────────────────────────────────

    private String buildReason(int totalScore, Object[] row, List<String> topSkills,
                               ProfileData profile, boolean jobSponsors,
                               Set<String> evaluatedSkills) {
        int    basePct     = row[4] != null ? ((Number) row[4]).intValue() : 0;
        String matchedRaw  = matchedSkillsToDelimitedString(row[5]);
        String title       = row[1] instanceof String t ? t : "";

        // Highest priority: sponsorship match (most specific signal)
        if (Boolean.TRUE.equals(profile.sponsorshipRequired()) && jobSponsors) {
            return "Offers visa sponsorship — " + basePct + "% match";
        }

        // Target role match
        if (profile.targetRoles() != null) {
            for (String role : profile.targetRoles()) {
                if (role != null && !role.isBlank()
                        && title.toLowerCase().contains(role.toLowerCase())) {
                    return "Matches your target role: " + prettify(role);
                }
            }
        }

        // Exceptional / strong match
        if (basePct >= 90) return "Exceptional match — " + basePct + "% profile fit";
        if (basePct >= 75) return "Strong match — " + basePct + "% profile fit";

        // Evaluated skills overlap
        if (!evaluatedSkills.isEmpty() && !matchedRaw.isBlank()) {
            String matchedL = matchedRaw.toLowerCase();
            for (String sk : evaluatedSkills) {
                if (matchedL.contains(sk.toLowerCase())) {
                    return "Aligns with your applied jobs: " + prettify(sk);
                }
            }
        }

        // Top skill from skill_runs
        if (!matchedRaw.isBlank()) {
            String matchedL = matchedRaw.toLowerCase();
            for (String skill : topSkills) {
                if (!skill.isBlank() && matchedL.contains(skill.toLowerCase())) {
                    return "Uses your top skill: " + prettify(skill);
                }
            }
        }

        // Location match
        if (profile.location() != null && row[3] instanceof String loc
                && loc.toLowerCase().contains(profile.location().toLowerCase())) {
            return "In your preferred location — " + basePct + "% match";
        }

        return "Recommended for your profile — " + basePct + "% match";
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static String prettify(String s) {
        String spaced = s.trim().replace("-", " ");
        return spaced.isEmpty() ? s :
               Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    /** H2/PostgreSQL native queries may return text[] as String, String[], or Object[]. */
    static String matchedSkillsToDelimitedString(Object raw) {
        if (raw == null) return "";
        if (raw instanceof String s) {
            return s.replaceAll("[\\[\\]\"]", "").trim();
        }
        if (raw instanceof String[] arr) {
            return String.join(", ", arr);
        }
        if (raw instanceof Object[] arr) {
            StringBuilder sb = new StringBuilder();
            for (Object item : arr) {
                if (item == null) continue;
                if (sb.length() > 0) sb.append(", ");
                sb.append(item.toString().trim());
            }
            return sb.toString();
        }
        return raw.toString().replaceAll("[\\[\\]\"]", "").trim();
    }

    // ── Profile data record ─────────────────────────────────────────────────────

    private record ProfileData(
        String   location,
        Integer  salaryMin,
        Boolean  sponsorshipRequired,
        String[] targetRoles,
        Integer  minMatchPercent
    ) {}
}
