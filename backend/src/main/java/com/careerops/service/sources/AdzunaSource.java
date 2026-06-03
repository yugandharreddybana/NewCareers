package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Adzuna job source.
 *
 * Tries user profile roles (up to 3), applies profile location hints,
 * and prioritizes Ireland-friendly queries when the profile indicates Ireland.
 */
@Component
public class AdzunaSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(AdzunaSource.class);

    private final WebClient client;
    private final String appId;
    private final String appKey;
    private final String countryCode;
    private final int dailyLimit;
    private final AtomicInteger todayCalls = new AtomicInteger(0);
    private final AtomicReference<LocalDate> budgetDay =
        new AtomicReference<>(LocalDate.now(ZoneOffset.UTC));

    private static final int MAX_ROLES = 3;
    private static final int RESULTS_PER_PAGE = 30;

    private static final Set<String> IRELAND_LOCATION_HINTS = Set.of(
        "dublin", "cork", "galway", "limerick", "waterford", "kilkenny",
        "kildare", "wicklow", "wexford", "meath", "louth", "mayo", "sligo",
        "tipperary", "donegal", "clare", "kerry", "laois", "leitrim",
        "longford", "monaghan", "offaly", "roscommon", "cavan", "carlow",
        "westmeath", "bray", "drogheda", "letterkenny", "naas", "athlone"
    );

    private static final Set<String> NON_REPUBLIC_IRELAND_HINTS = Set.of(
        "northern ireland", "england", "scotland", "wales",
        "united kingdom", ", uk", "uk,",
        "county antrim", "county armagh", "county down",
        "county londonderry", "county tyrone", "county fermanagh",
        "belfast"
    );

    public AdzunaSource(JobApiHttpClient httpClient,
                        @Value("${adzuna.app.id:}") String appId,
                        @Value("${adzuna.app.key:}") String appKey,
                        @Value("${adzuna.country.code:gb}") String countryCode,
                        @Value("${adzuna.daily.limit:250}") int limit) {
        this.client = httpClient.createClient("https://api.adzuna.com");
        this.appId = appId;
        this.appKey = appKey;
        this.countryCode = normalizeCountry(countryCode);
        this.dailyLimit = limit;
    }

    @Override
    public String name() {
        return "adzuna";
    }

    @Override
    public boolean hasBudget() {
        if (!hasCredentials()) {
            return false;
        }
        resetBudgetIfNeeded();
        return todayCalls.get() < dailyLimit;
    }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        if (!hasCredentials()) {
            log.warn("Adzuna skipped: missing credentials (set ADZUNA_APP_ID and ADZUNA_APP_KEY)");
            return out;
        }
        if (!hasBudget()) return out;

        boolean irelandProfile = prefersIreland(profile);
        List<String> countries = resolveCountryOrder(countryCode, irelandProfile);
        List<String> whereCandidates = resolveWhereCandidates(profile, irelandProfile);
        String[] roles = resolveRoles(profile);
        int maxDays = Math.max(1, (profile.getFreshnessHours() == null ? 96 : profile.getFreshnessHours()) / 24);

        for (int r = 0; r < Math.min(roles.length, MAX_ROLES) && hasBudget(); r++) {
            String role = roles[r];
            int roleCount = 0;

            for (String roleQuery : roleVariants(role)) {
                if (roleCount > 0) break;
                for (String country : countries) {
                if (!hasBudget()) break;
                boolean foundForCountry = false;

                for (String where : whereCandidates) {
                    if (!hasBudget()) break;
                    List<Job> fetched = fetchForRoleAndCountry(roleQuery, maxDays, country, where, irelandProfile);
                    if (fetched.isEmpty()) continue;

                    out.addAll(fetched);
                    roleCount += fetched.size();
                    foundForCountry = true;
                    break; // first successful location for this country wins
                }

                if (foundForCountry) {
                    break; // no need to keep trying additional countries for this role
                }
            }
            }

            log.info("Adzuna fetched {} jobs for role '{}'", roleCount, role);
        }
        return out;
    }

    private List<Job> fetchForRoleAndCountry(
            String role, int maxDays, String country, String where, boolean irelandProfile) {
        List<Job> out = new ArrayList<>();
        UriComponentsBuilder uri = UriComponentsBuilder
            .fromUriString("/v1/api/jobs/" + country + "/search/1")
            .queryParam("app_id", appId)
            .queryParam("app_key", appKey)
            .queryParam("results_per_page", RESULTS_PER_PAGE)
            .queryParam("what", role)
            .queryParam("max_days_old", maxDays);
        if (where != null && !where.isBlank()) {
            uri.queryParam("where", where);
        }

        String url = uri.toUriString();
        try {
            JsonNode root = client.get().uri(url).retrieve().bodyToMono(JsonNode.class).block();
            registerApiCall();
            if (root == null) return out;

            for (JsonNode r2 : root.path("results")) {
                String location = r2.path("location").path("display_name").asText("");
                if (irelandProfile && "ie".equalsIgnoreCase(country) && !isRepublicOfIrelandLocation(location)) {
                    continue;
                }

                Job j = Job.builder()
                    .title(r2.path("title").asText())
                    .company(r2.path("company").path("display_name").asText("Unknown"))
                    .location(location)
                    .salaryMin(r2.path("salary_min").isNumber() ? r2.path("salary_min").asInt() : null)
                    .salaryMax(r2.path("salary_max").isNumber() ? r2.path("salary_max").asInt() : null)
                    .description(r2.path("description").asText())
                    .sourceUrl(r2.path("redirect_url").asText())
                    .sourceName("Adzuna")
                    .sector(r2.path("category").path("label").asText(null))
                    .currency(currencyForCountry(country))
                    .postedAt(parseDate(r2.path("created").asText()))
                    .build();
                j.setFingerprint(FingerprintUtil.of(
                    j.getCompany(), j.getTitle(), j.getLocation(), j.getSalaryMin(), j.getSalaryMax()));
                out.add(j);
            }
        } catch (Exception e) {
            log.warn("Adzuna fetch failed (role='{}', country='{}', where='{}'): {}",
                role, country, where, e.getMessage());
        }
        return out;
    }

    static List<String> resolveCountryOrder(String configuredCountryCode, boolean irelandProfile) {
        String normalized = normalizeCountry(configuredCountryCode);
        LinkedHashSet<String> order = new LinkedHashSet<>();
        if (irelandProfile) {
            order.add("ie");
            order.add("gb");
        }
        order.add(normalized);
        return new ArrayList<>(order);
    }

    static boolean prefersIreland(UserProfile profile) {
        if (profile == null) return false;
        String location = joinLocations(profile);
        if (location.isBlank()) return false;
        String s = location.toLowerCase(Locale.ROOT);
        if (s.contains("ireland")) return true;
        return IRELAND_LOCATION_HINTS.stream().anyMatch(s::contains);
    }

    static boolean isRepublicOfIrelandLocation(String location) {
        if (location == null || location.isBlank()) return false;
        String s = location.toLowerCase(Locale.ROOT).trim();
        if (NON_REPUBLIC_IRELAND_HINTS.stream().anyMatch(s::contains)) return false;

        if (s.contains("remote") && s.contains("ireland")) return true;
        if (IRELAND_LOCATION_HINTS.stream().anyMatch(s::contains)) return true;
        if (s.equals("ireland") || s.equals("republic of ireland")) return true;
        if (s.contains("ireland")) {
            // "Ireland, Shefford" is a UK place-name false-positive, so only accept
            // "Ireland, ..." when we have an explicit Republic-of-Ireland city/county hint.
            return !s.contains("ireland,");
        }
        return false;
    }

    private static String joinLocations(UserProfile profile) {
        if (profile == null) return "";
        String goal = profile.getGoalLocation() == null ? "" : profile.getGoalLocation().trim();
        String base = profile.getLocation() == null ? "" : profile.getLocation().trim();
        return (goal + " " + base).trim();
    }

    private static List<String> resolveWhereCandidates(UserProfile profile, boolean irelandProfile) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (profile.getGoalLocation() != null && !profile.getGoalLocation().isBlank()) {
            String goal = profile.getGoalLocation().trim();
            out.add(firstLocationToken(goal));
            out.add(goal);
        } else if (profile.getLocation() != null && !profile.getLocation().isBlank()) {
            String base = profile.getLocation().trim();
            out.add(firstLocationToken(base));
            out.add(base);
        }
        if (irelandProfile) {
            out.add("Republic of Ireland");
            out.add("Ireland");
        }
        out.removeIf(s -> s != null && s.isBlank());
        out.add(null); // broad fallback if strict location queries return nothing
        return new ArrayList<>(out);
    }

    private static String[] resolveRoles(UserProfile p) {
        if (p.getTargetRoles() != null && p.getTargetRoles().length > 0) return p.getTargetRoles();
        if (p.getGoalTitle() != null && !p.getGoalTitle().isBlank()) {
            return new String[]{p.getGoalTitle().trim()};
        }
        return new String[]{"software engineer"};
    }

    private static List<String> roleVariants(String role) {
        LinkedHashSet<String> queries = new LinkedHashSet<>();
        if (role != null && !role.isBlank()) {
            String clean = role.trim();
            queries.add(clean);
            String simplified = clean
                .replaceAll("(?i)\\b(senior|staff|principal|lead|junior|mid|sr|jr)\\b", "")
                .replaceAll("\\s+", " ")
                .trim();
            if (!simplified.isBlank()) queries.add(simplified);

            String lower = clean.toLowerCase(Locale.ROOT);
            if (lower.contains("full stack") || lower.contains("fullstack")) {
                queries.add("full stack developer");
                queries.add("full stack engineer");
                queries.add("full stack");
            }
            if (lower.contains("developer") && !lower.contains("engineer")) {
                queries.add(clean.replaceAll("(?i)developer", "engineer"));
            }
            if (lower.contains("engineer") && !lower.contains("developer")) {
                queries.add(clean.replaceAll("(?i)engineer", "developer"));
            }
        }
        queries.add("software engineer");
        return new ArrayList<>(queries);
    }

    private static String firstLocationToken(String location) {
        String trimmed = location.trim();
        int comma = trimmed.indexOf(',');
        return (comma > 0 ? trimmed.substring(0, comma) : trimmed).trim();
    }

    private static String currencyForCountry(String country) {
        return "ie".equalsIgnoreCase(country) ? "EUR" : "GBP";
    }

    private static String normalizeCountry(String raw) {
        return (raw == null || raw.isBlank()) ? "gb" : raw.toLowerCase(Locale.ROOT);
    }

    private boolean hasCredentials() {
        return appId != null && !appId.isBlank() && appKey != null && !appKey.isBlank();
    }

    private void registerApiCall() {
        resetBudgetIfNeeded();
        todayCalls.incrementAndGet();
    }

    private void resetBudgetIfNeeded() {
        LocalDate now = LocalDate.now(ZoneOffset.UTC);
        LocalDate seen = budgetDay.get();
        if (!now.equals(seen) && budgetDay.compareAndSet(seen, now)) {
            todayCalls.set(0);
        }
    }

    private static Instant parseDate(String s) {
        try { return s == null || s.isBlank() ? Instant.now() : Instant.parse(s); }
        catch (Exception e) { return Instant.now(); }
    }
}
