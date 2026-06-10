package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Post-fetch gates for the job delivery pipeline: recency, Ireland/remote location,
 * and strict alignment of job titles to the user's desired {@code targetRoles}.
 */
public final class JobDeliveryFilters {

    private static final Set<String> IRELAND_LOCATION_HINTS = Set.of(
            "ireland", "dublin", "cork", "galway", "limerick", "belfast", "waterford",
            "kilkenny", "kildare", "wicklow", "wexford", "meath", "louth", "mayo", "sligo",
            "tipperary", "donegal", "clare", "kerry", "laois", "leitrim", "longford",
            "monaghan", "offaly", "roscommon", "cavan", "carlow", "westmeath", "bray",
            "drogheda", "letterkenny", "naas", "athlone", "remote", "hybrid", "wfh",
            "work from home", "anywhere"
    );

    private static final Set<String> TITLE_STOP_WORDS = Set.of(
            "a", "an", "the", "and", "or", "of", "in", "at", "for", "to", "with", "on",
            "ii", "iii", "iv", "sr", "jr");

    /** Locale hub labels mistaken for roles (e.g. Zendesk search-results page). */
    private static final Pattern LANGUAGE_OR_LOCALE_TITLE = Pattern.compile(
            "^(?i)(deutsch|français|francais|español|espanol|english|nederlands|português|portuguese|"
                    + "italiano|polski|日本語|中文|한국어|latam)(\\s*\\([^)]+\\))?$");

    private static final Pattern NORMALIZE = Pattern.compile("[^a-z0-9]+");

    private JobDeliveryFilters() {}

    public static List<Job> filterByMaxAge(List<Job> jobs, int maxAgeDays) {
        if (jobs == null || jobs.isEmpty() || maxAgeDays <= 0) {
            return jobs == null ? List.of() : jobs;
        }
        Instant cutoff = Instant.now().minus(maxAgeDays, ChronoUnit.DAYS);
        List<Job> out = new ArrayList<>(jobs.size());
        for (Job job : jobs) {
            if (job == null) continue;
            Instant posted = job.getPostedAt();
            if (posted == null || !posted.isBefore(cutoff)) {
                out.add(job);
            }
        }
        return out;
    }

    public static List<Job> filterByLocation(List<Job> jobs, UserProfile profile) {
        if (jobs == null || jobs.isEmpty() || profile == null) return List.of();
        List<Job> out = new ArrayList<>(jobs.size());
        for (Job job : jobs) {
            if (job == null) continue;
            if (isLocationMatch(job.getLocation(), profile)) {
                out.add(job);
            }
        }
        return out;
    }

    public static List<Job> filterByIrelandOrRemote(List<Job> jobs) {
        if (jobs == null || jobs.isEmpty()) return List.of();
        List<Job> out = new ArrayList<>(jobs.size());
        for (Job job : jobs) {
            if (job == null) continue;
            if (isIrelandOrRemote(job.getLocation())) {
                out.add(job);
            }
        }
        return out;
    }

    public static List<Job> filterPlausibleJobTitles(List<Job> jobs) {
        if (jobs == null || jobs.isEmpty()) return List.of();
        List<Job> out = new ArrayList<>(jobs.size());
        for (Job job : jobs) {
            if (job == null) continue;
            if (isPlausibleJobTitle(job.getTitle())) {
                out.add(job);
            }
        }
        return out;
    }

    /** Basic scrape sanity only — desired-role strictness is enforced separately. */
    public static boolean isPlausibleJobTitle(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        String trimmed = title.trim();
        if (trimmed.length() < 4) {
            return false;
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (LANGUAGE_OR_LOCALE_TITLE.matcher(trimmed).matches()) {
            return false;
        }
        return !lower.contains("search result")
                && !lower.contains("all jobs")
                && !lower.equals("careers")
                && !lower.equals("jobs")
                && !lower.startsWith("careers");
    }

    /**
     * Keeps only jobs whose title strictly matches at least one entry in {@code targetRoles}
     * (not headline — search may use headline, but delivery titles must match desired roles).
     */
    public static List<Job> filterByDesiredRoles(List<Job> jobs, UserProfile profile) {
        if (jobs == null || jobs.isEmpty() || profile == null) {
            return List.of();
        }
        List<Job> out = new ArrayList<>(jobs.size());
        for (Job job : jobs) {
            if (job == null) continue;
            if (titleMatchesDesiredRoles(profile, job.getTitle())) {
                out.add(job);
            }
        }
        return out;
    }

    /**
     * Strict gate against the user's desired {@code targetRoles}, with tight engineering-family
     * equivalents (e.g. Full Stack Developer also allows Software Engineer titles).
     * Sales/non-tech titles such as Account Executive still fail.
     */
    public static boolean titleMatchesDesiredRoles(UserProfile profile, String title) {
        if (profile == null || title == null || title.isBlank()) {
            return false;
        }
        if (profile.getTargetRoles() == null || profile.getTargetRoles().length == 0) {
            return false;
        }
        String titleNorm = normalize(title);
        if (titleNorm.isBlank()) {
            return false;
        }
        if (isExcludedNonTechTitle(titleNorm)) {
            return false;
        }

        for (String role : expandedDesiredRoles(profile)) {
            if (titleStrictlyMatchesRolePhrase(titleNorm, role)) {
                return true;
            }
        }
        return false;
    }

    /** Roles used for title matching: desired roles + developer/engineer swap + full-stack ↔ software engineering. */
    static List<String> expandedDesiredRoles(UserProfile profile) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        for (String role : profile.getTargetRoles()) {
            if (role == null || role.isBlank()) {
                continue;
            }
            addDesiredRoleVariant(out, seen, role.trim());
            String lower = role.toLowerCase(Locale.ROOT);
            if (lower.contains(" developer")) {
                addDesiredRoleVariant(out, seen, role.replaceAll("(?i) developer", " Engineer"));
            } else if (lower.contains(" engineer")) {
                addDesiredRoleVariant(out, seen, role.replaceAll("(?i) engineer", " Developer"));
            }
            String roleNorm = normalize(role);
            if (roleNorm.contains("fullstack")
                    || (roleNorm.contains("full") && roleNorm.contains("stack"))) {
                addDesiredRoleVariant(out, seen, "Software Engineer");
                addDesiredRoleVariant(out, seen, "Software Developer");
            } else if (roleNorm.contains("software")
                    && (roleNorm.contains("engineer") || roleNorm.contains("developer"))) {
                addDesiredRoleVariant(out, seen, "Full Stack Developer");
                addDesiredRoleVariant(out, seen, "Full Stack Engineer");
            }
        }
        return out;
    }

    private static void addDesiredRoleVariant(List<String> out, Set<String> seen, String role) {
        String key = role.toLowerCase(Locale.ROOT);
        if (seen.add(key)) {
            out.add(role);
        }
    }

    private static boolean titleStrictlyMatchesRolePhrase(String titleNorm, String role) {
        String roleNorm = normalize(role);
        if (roleNorm.isBlank()) {
            return false;
        }
        if (titleNorm.contains(roleNorm)) {
            return true;
        }
        List<String> tokens = significantRoleTokens(roleNorm);
        return !tokens.isEmpty() && allRoleTokensInTitle(titleNorm, tokens);
    }

    private static boolean isExcludedNonTechTitle(String titleNorm) {
        return titleNorm.contains("account executive")
                || titleNorm.contains("sales representative")
                || titleNorm.contains("business development")
                || titleNorm.contains("account manager")
                || titleNorm.startsWith("account opening");
    }

    /** @deprecated use {@link #titleMatchesDesiredRoles} */
    @Deprecated
    public static boolean titleMatchesTargetRoles(UserProfile profile, String title) {
        return titleMatchesDesiredRoles(profile, title);
    }

    /** @deprecated use {@link #filterByDesiredRoles} */
    @Deprecated
    public static List<Job> filterByTargetRoles(List<Job> jobs, UserProfile profile) {
        return filterByDesiredRoles(jobs, profile);
    }

    public static List<Job> applyPipelineFilters(List<Job> jobs, int maxAgeDays, UserProfile profile) {
        List<Job> filtered = filterPlausibleJobTitles(
                filterByLocation(filterByMaxAge(jobs, maxAgeDays), profile));
        return filterByDesiredRoles(filtered, profile);
    }

    /**
     * Same as {@link #applyPipelineFilters} but skips strict desired-role gate — for sparse
     * profiles with no {@code targetRoles} when serving from the cached job pool.
     */
    public static List<Job> applyPipelineFiltersRelaxed(List<Job> jobs, int maxAgeDays, UserProfile profile) {
        return filterPlausibleJobTitles(
                filterByLocation(filterByMaxAge(jobs, maxAgeDays), profile));
    }

    public static boolean isLocationMatch(String jobLocation, UserProfile profile) {
        if (jobLocation == null || jobLocation.isBlank()) {
            return true;
        }
        String loc = jobLocation.toLowerCase(Locale.ROOT);
        
        if (Boolean.TRUE.equals(profile.getOpenToRemote()) && (loc.contains("remote") || loc.contains("anywhere") || loc.contains("wfh") || loc.contains("work from home") || loc.contains("hybrid"))) {
            return true;
        }

        String userLoc = profile.getLocation() != null ? profile.getLocation().toLowerCase(Locale.ROOT) : "";
        if (userLoc.isBlank()) {
            return isIrelandOrRemote(jobLocation);
        }

        String[] parts = userLoc.split("[^a-z0-9]+");
        for (String part : parts) {
            if (part.length() > 2 && loc.contains(part)) {
                return true;
            }
        }

        if ((userLoc.contains("ireland") && isIrelandOrRemote(jobLocation)) ||
            (loc.contains("ireland") && isIrelandOrRemote(userLoc))) {
            return true;
        }

        return false;
    }

    public static boolean isIrelandOrRemote(String location) {
        if (location == null || location.isBlank()) {
            return true;
        }
        String loc = location.toLowerCase(Locale.ROOT);
        for (String hint : IRELAND_LOCATION_HINTS) {
            if (loc.contains(hint)) {
                return true;
            }
        }
        if (loc.contains("uk") || loc.contains("united kingdom") || loc.contains("england")
                || loc.contains("scotland") || loc.contains("wales") || loc.contains("london")) {
            return false;
        }
        return loc.contains("ireland");
    }

    private static String normalize(String text) {
        return NORMALIZE.matcher(text.toLowerCase(Locale.ROOT)).replaceAll(" ").trim()
                .replaceAll("\\s+", " ");
    }

    private static List<String> significantRoleTokens(String roleNorm) {
        List<String> tokens = new ArrayList<>();
        for (String token : roleNorm.split(" ")) {
            if (token.isBlank() || token.length() <= 2 || TITLE_STOP_WORDS.contains(token)) {
                continue;
            }
            tokens.add(token);
        }
        return tokens;
    }

    private static boolean allRoleTokensInTitle(String titleNorm, List<String> roleTokens) {
        for (String token : roleTokens) {
            if (!tokenPresentInTitle(titleNorm, token)) {
                return false;
            }
        }
        return true;
    }

    private static boolean tokenPresentInTitle(String titleNorm, String roleToken) {
        if (titleNorm.contains(roleToken)) {
            return true;
        }
        if ("developer".equals(roleToken)) {
            return titleNorm.contains("engineer");
        }
        if ("engineer".equals(roleToken)) {
            return titleNorm.contains("developer");
        }
        if ("fullstack".equals(roleToken)) {
            return titleNorm.contains("full stack");
        }
        if ("stack".equals(roleToken) && roleToken.length() > 2) {
            return titleNorm.contains("fullstack");
        }
        return false;
    }
}
