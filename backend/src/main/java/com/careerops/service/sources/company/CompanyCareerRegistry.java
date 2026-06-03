package com.careerops.service.sources.company;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.*;

import com.careerops.service.sources.JsoupCompanySource;

/**
 * Company career page registry: merges {@link JsoupCompanySource} pages with YAML strategy overrides.
 */
@Component
public class CompanyCareerRegistry {

    public enum Strategy { AUTO, GREENHOUSE, LEVER, ASHBY, PLAYWRIGHT, JSOUP }

    public record Entry(String name, String url, Strategy strategy, String slug) {}

    private final List<Entry> entries;

    public CompanyCareerRegistry() {
        Map<String, Override> overrides = loadOverrides();
        List<Entry> list = new ArrayList<>();
        for (Map.Entry<String, String> row : JsoupCompanySource.careerPages().entrySet()) {
            String name = row.getKey();
            String url = row.getValue();
            Override o = overrides.get(normalizeKey(name));
            if (o != null) {
                String resolvedUrl = o.url != null && !o.url.isBlank() ? o.url : url;
                String slug = o.slug != null && !o.slug.isBlank() ? o.slug : detectSlug(resolvedUrl);
                list.add(new Entry(name, resolvedUrl, o.strategy, slug));
            } else {
                list.add(new Entry(name, url, detectAutoStrategy(url), detectSlug(url)));
            }
        }
        this.entries = List.copyOf(list);
    }

    public List<Entry> all() {
        return entries;
    }

    public Optional<Entry> find(String companyName) {
        String key = normalizeKey(companyName);
        return entries.stream()
            .filter(e -> normalizeKey(e.name()).equals(key))
            .findFirst();
    }

    public static Strategy detectAutoStrategy(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains("greenhouse.io") || lower.contains(".greenhouse.io")) {
            return Strategy.GREENHOUSE;
        }
        if (lower.contains("jobs.lever.co") || lower.contains("lever.co/")) {
            return Strategy.LEVER;
        }
        if (lower.contains("ashbyhq.com")) {
            return Strategy.ASHBY;
        }
        if (lower.contains("myworkdayjobs.com") || lower.contains("careers.ey.com")) {
            return Strategy.PLAYWRIGHT;
        }
        return Strategy.AUTO;
    }

    static String detectSlug(String url) {
        if (url == null || url.isBlank()) {
            return "";
        }
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains("boards.greenhouse.io/")) {
            return slugAfter(url, "boards.greenhouse.io/");
        }
        if (lower.contains(".greenhouse.io/")) {
            int idx = lower.indexOf(".greenhouse.io/");
            return slugAfter(url, url.substring(idx + ".greenhouse.io/".length() - url.length() + idx));
        }
        if (lower.contains("jobs.lever.co/")) {
            return slugAfter(url, "jobs.lever.co/");
        }
        if (lower.contains("jobs.ashbyhq.com/")) {
            return slugAfter(url, "jobs.ashbyhq.com/");
        }
        return "";
    }

    private static String slugAfter(String url, String marker) {
        int idx = url.toLowerCase(Locale.ROOT).indexOf(marker.toLowerCase(Locale.ROOT));
        if (idx < 0) {
            return "";
        }
        String rest = url.substring(idx + marker.length());
        int slash = rest.indexOf('/');
        int q = rest.indexOf('?');
        int end = rest.length();
        if (slash >= 0) {
            end = Math.min(end, slash);
        }
        if (q >= 0) {
            end = Math.min(end, q);
        }
        return rest.substring(0, end).trim();
    }

    private static String normalizeKey(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
    }

    private static Map<String, Override> loadOverrides() {
        Map<String, Override> map = new HashMap<>();
        try (InputStream in = new ClassPathResource("company-careers.yml").getInputStream()) {
            Object raw = new Yaml().load(in);
            if (!(raw instanceof Map<?, ?> root)) {
                return map;
            }
            Object companies = root.get("companies");
            if (!(companies instanceof List<?> list)) {
                return map;
            }
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> row)) {
                    continue;
                }
                String name = stringVal(row.get("name"));
                if (name.isBlank()) {
                    continue;
                }
                Override o = new Override();
                o.url = stringVal(row.get("url"));
                o.slug = stringVal(row.get("slug"));
                o.strategy = parseStrategy(stringVal(row.get("strategy")));
                map.put(normalizeKey(name), o);
            }
        } catch (Exception ignored) {
            // YAML overrides optional in tests
        }
        return map;
    }

    private static Strategy parseStrategy(String raw) {
        if (raw == null || raw.isBlank()) {
            return Strategy.AUTO;
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "greenhouse" -> Strategy.GREENHOUSE;
            case "lever" -> Strategy.LEVER;
            case "ashby" -> Strategy.ASHBY;
            case "playwright" -> Strategy.PLAYWRIGHT;
            case "jsoup" -> Strategy.JSOUP;
            default -> Strategy.AUTO;
        };
    }

    private static String stringVal(Object o) {
        return o == null ? "" : o.toString().trim();
    }

    private static final class Override {
        String url;
        String slug;
        Strategy strategy = Strategy.AUTO;
    }
}
