package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts salary min/max/currency/display label from job descriptions, HTML, and JSON-LD.
 */
public final class JobSalaryExtractor {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final Pattern LABELED_RANGE = Pattern.compile(
            "(?i)(?:salary|compensation|pay|remuneration)\\s*:\\s*"
                    + "((?:€|EUR|£|GBP|\\$|USD)\\s*[\\d,]+(?:\\.\\d+)?(?:\\s*k)?"
                    + "\\s*(?:[-–—]|to|and)\\s*(?:€|EUR|£|GBP|\\$|USD)?\\s*[\\d,]+(?:\\.\\d+)?(?:\\s*k)?"
                    + "|(?:€|EUR|£|GBP|\\$|USD)\\s*[\\d,]+(?:\\.\\d+)?(?:\\s*k)?(?:\\s*(?:per\\s+)?(?:annum|year|pa))?)",
            Pattern.MULTILINE);

    private static final Pattern BARE_EUR_RANGE = Pattern.compile(
            "(?i)(?:€|EUR)\\s*([\\d,]+(?:\\.\\d+)?)(?:\\s*k)?\\s*(?:[-–—]|to)\\s*(?:€|EUR)?\\s*([\\d,]+(?:\\.\\d+)?)(?:\\s*k)?");

    private static final Pattern BARE_SINGLE_EUR = Pattern.compile(
            "(?i)(?:€|EUR)\\s*([\\d,]+(?:\\.\\d+)?)(?:\\s*k)?(?:\\s*(?:per\\s+)?(?:annum|year|pa))?");

    private static final Pattern PRELOADED_MARKER =
            Pattern.compile("window\\.__PRELOADED_STATE__\\[\"([^\"]+)\"\\]\\s*=\\s*");

    private JobSalaryExtractor() {}

    public record SalaryInfo(Integer min, Integer max, String currency, String displayLabel) {
        public boolean hasStructured() {
            return min != null || max != null;
        }

        public boolean hasDisplay() {
            return displayLabel != null && !displayLabel.isBlank();
        }
    }

    public static SalaryInfo parse(String text) {
        if (text == null || text.isBlank()) {
            return empty();
        }
        SalaryInfo fromText = parseFromText(text);
        if (fromText.hasStructured() || fromText.hasDisplay()) {
            return fromText;
        }
        return empty();
    }

    public static SalaryInfo parseFromHtml(String html) {
        if (html == null || html.isBlank()) {
            return empty();
        }
        SalaryInfo fromJsonLd = parseJsonLd(html);
        if (fromJsonLd.hasStructured()) {
            return fromJsonLd;
        }
        SalaryInfo fromPreloaded = parsePreloadedState(html);
        if (fromPreloaded.hasStructured() || fromPreloaded.hasDisplay()) {
            return fromPreloaded;
        }
        SalaryInfo fromSelectors = parseSalarySelectors(html);
        if (fromSelectors.hasDisplay()) {
            return fromSelectors;
        }
        return empty();
    }

    public static SalaryInfo merge(SalaryInfo primary, SalaryInfo secondary) {
        if (primary == null || !primary.hasStructured() && !primary.hasDisplay()) {
            return secondary == null ? empty() : secondary;
        }
        if (secondary == null || !secondary.hasStructured() && !secondary.hasDisplay()) {
            return primary;
        }
        Integer min = primary.min() != null ? primary.min() : secondary.min();
        Integer max = primary.max() != null ? primary.max() : secondary.max();
        String currency = primary.currency() != null ? primary.currency() : secondary.currency();
        String label = primary.hasDisplay() ? primary.displayLabel() : secondary.displayLabel();
        return new SalaryInfo(min, max, currency, label);
    }

    private static SalaryInfo empty() {
        return new SalaryInfo(null, null, null, null);
    }

    private static SalaryInfo parseFromText(String text) {
        Matcher labeled = LABELED_RANGE.matcher(text);
        if (labeled.find()) {
            String snippet = labeled.group(1).trim();
            if (isVagueSalaryLabel(snippet)) {
                return empty();
            }
            return parseAmountSnippet(snippet);
        }
        Matcher range = BARE_EUR_RANGE.matcher(text);
        if (range.find()) {
            Integer min = parseAmount(range.group(1), range.group(0));
            Integer max = parseAmount(range.group(2), range.group(0));
            String label = formatRangeLabel(min, max, "EUR");
            return new SalaryInfo(min, max, "EUR", label);
        }
        Matcher single = BARE_SINGLE_EUR.matcher(text);
        if (single.find()) {
            Integer min = parseAmount(single.group(1), single.group(0));
            String label = min != null ? formatSingleLabel(min, "EUR") : single.group(0).trim();
            return new SalaryInfo(min, null, "EUR", label);
        }
        return empty();
    }

    private static SalaryInfo parseAmountSnippet(String snippet) {
        Matcher range = BARE_EUR_RANGE.matcher(snippet);
        if (range.find()) {
            Integer min = parseAmount(range.group(1), snippet);
            Integer max = parseAmount(range.group(2), snippet);
            String currency = detectCurrency(snippet);
            return new SalaryInfo(min, max, currency, snippet.trim());
        }
        Matcher single = BARE_SINGLE_EUR.matcher(snippet);
        if (single.find()) {
            Integer min = parseAmount(single.group(1), snippet);
            String currency = detectCurrency(snippet);
            return new SalaryInfo(min, null, currency, snippet.trim());
        }
        return new SalaryInfo(null, null, detectCurrency(snippet), snippet.trim());
    }

    private static SalaryInfo parseJsonLd(String html) {
        try {
            Document doc = Jsoup.parse(html);
            for (Element script : doc.select("script[type=application/ld+json]")) {
                String json = script.data();
                if (json.isBlank()) continue;
                JsonNode root = MAPPER.readTree(json);
                SalaryInfo info = walkJsonLd(root);
                if (info.hasStructured()) {
                    return info;
                }
            }
        } catch (Exception ignored) {
            // best-effort
        }
        return empty();
    }

    private static SalaryInfo walkJsonLd(JsonNode node) {
        if (node == null || node.isNull()) {
            return empty();
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                SalaryInfo info = walkJsonLd(child);
                if (info.hasStructured()) return info;
            }
            return empty();
        }
        JsonNode baseSalary = node.get("baseSalary");
        if (baseSalary != null) {
            SalaryInfo fromBase = parseBaseSalaryNode(baseSalary);
            if (fromBase.hasStructured()) return fromBase;
        }
        var fields = node.fields();
        while (fields.hasNext()) {
            var entry = fields.next();
            SalaryInfo nested = walkJsonLd(entry.getValue());
            if (nested.hasStructured()) return nested;
        }
        return empty();
    }

    private static SalaryInfo parseBaseSalaryNode(JsonNode baseSalary) {
        String currency = textOrNull(baseSalary.get("currency"));
        JsonNode value = baseSalary.get("value");
        if (value == null) {
            return empty();
        }
        Integer min = intOrNull(value.get("minValue"));
        Integer max = intOrNull(value.get("maxValue"));
        if (min == null) min = intOrNull(value.get("value"));
        if (currency == null) currency = textOrNull(value.get("currency"));
        if (currency == null) currency = "EUR";
        String label = (min != null || max != null) ? formatRangeLabel(min, max, currency) : null;
        return new SalaryInfo(min, max, currency, label);
    }

    private static SalaryInfo parsePreloadedState(String html) {
        SalaryBuilder builder = new SalaryBuilder();
        Matcher marker = PRELOADED_MARKER.matcher(html);
        while (marker.find()) {
            String json = extractJsonObjectAfter(html, marker.end());
            if (json == null || json.isBlank()) continue;
            try {
                walkSalaryKeys(MAPPER.readTree(json), builder);
            } catch (Exception ignored) {
                // try next preloaded chunk
            }
        }
        return builder.toInfo();
    }

    private static String extractJsonObjectAfter(String html, int fromIndex) {
        if (html == null || fromIndex < 0 || fromIndex >= html.length()) return null;
        String chunk = html.substring(fromIndex);
        int braceStart = chunk.indexOf('{');
        if (braceStart < 0) return null;
        int depth = 0;
        boolean inString = false;
        for (int i = braceStart; i < chunk.length(); i++) {
            char c = chunk.charAt(i);
            if (inString) {
                if (c == '\\' && i + 1 < chunk.length()) {
                    i++;
                    continue;
                }
                if (c == '"') inString = false;
                continue;
            }
            if (c == '"') {
                inString = true;
            } else if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0) {
                    return chunk.substring(braceStart, i + 1);
                }
            }
        }
        return null;
    }

    private static boolean isVagueSalaryLabel(String label) {
        if (label == null || label.isBlank()) return true;
        String lower = label.toLowerCase(Locale.ROOT).trim();
        if (lower.contains("€") || lower.contains("eur") || lower.contains("£") || lower.contains("$")) {
            return false;
        }
        return lower.equals("competitive")
                || lower.equals("negotiable")
                || lower.equals("doe")
                || lower.equals("tbc")
                || lower.equals("n/a")
                || lower.startsWith("competitive ")
                || lower.contains("not disclosed")
                || lower.contains("salary on application");
    }

    private static boolean looksLikeSalaryLabel(String label) {
        if (label == null || label.isBlank() || isVagueSalaryLabel(label)) return false;
        if (label.contains("€") || label.toUpperCase(Locale.ROOT).contains("EUR")
                || label.contains("£") || label.contains("$")) {
            return true;
        }
        return label.matches(".*\\d[\\d,]*(?:\\s*k)?(?:\\s*(?:-|–|—|to)\\s*\\d[\\d,]*(?:\\s*k)?)?.*");
    }

    private static void absorbSalaryObject(JsonNode obj, SalaryBuilder builder) {
        if (obj == null || !obj.isObject()) return;
        builder.min = coalesce(builder.min, intOrNull(obj.get("min")));
        builder.max = coalesce(builder.max, intOrNull(obj.get("max")));
        builder.min = coalesce(builder.min, intOrNull(obj.get("minimum")));
        builder.max = coalesce(builder.max, intOrNull(obj.get("maximum")));
        builder.min = coalesce(builder.min, intOrNull(obj.get("salaryMin")));
        builder.max = coalesce(builder.max, intOrNull(obj.get("salaryMax")));
        builder.min = coalesce(builder.min, intOrNull(obj.get("from")));
        builder.max = coalesce(builder.max, intOrNull(obj.get("to")));
        if (obj.has("currency") && obj.get("currency").isTextual()) {
            builder.currency = obj.get("currency").asText();
        }
        for (String displayKey : new String[]{
                "displayValue", "displayName", "formatted", "formattedValue", "label", "text", "range"
        }) {
            JsonNode display = obj.get(displayKey);
            if (display == null || !display.isTextual() || display.asText().isBlank()) continue;
            String text = display.asText().trim();
            if (!looksLikeSalaryLabel(text)) continue;
            builder.displayLabel = coalesceLabel(builder.displayLabel, text);
            SalaryInfo parsed = parseFromText(text);
            if (parsed.hasStructured()) {
                builder.min = coalesce(builder.min, parsed.min());
                builder.max = coalesce(builder.max, parsed.max());
                if (builder.currency == null) builder.currency = parsed.currency();
            }
        }
    }

    private static void walkSalaryKeys(JsonNode node, SalaryBuilder builder) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            var it = node.fields();
            while (it.hasNext()) {
                var e = it.next();
                String key = e.getKey().toLowerCase(Locale.ROOT);
                JsonNode val = e.getValue();
                switch (key) {
                    case "salarymin", "min_salary", "minimumsalary", "salaryfrom" ->
                            builder.min = coalesce(builder.min, intOrNull(val));
                    case "salarymax", "max_salary", "maximumsalary", "salaryto" ->
                            builder.max = coalesce(builder.max, intOrNull(val));
                    case "currency", "salarycurrency" -> {
                        if (val.isTextual()) builder.currency = val.asText();
                    }
                    case "salary", "salarylabel", "salarydisplay", "remuneration", "compensation",
                         "basesalary", "salaryrange" -> {
                        if (val.isObject()) {
                            absorbSalaryObject(val, builder);
                        } else if (val.isTextual() && !val.asText().isBlank()) {
                            String text = val.asText().trim();
                            if (looksLikeSalaryLabel(text)) {
                                builder.displayLabel = coalesceLabel(builder.displayLabel, text);
                                SalaryInfo parsed = parseFromText(text);
                                if (parsed.hasStructured()) {
                                    builder.min = coalesce(builder.min, parsed.min());
                                    builder.max = coalesce(builder.max, parsed.max());
                                    if (builder.currency == null) builder.currency = parsed.currency();
                                }
                            }
                        }
                        walkSalaryKeys(val, builder);
                    }
                    case "displayvalue", "displayname", "formattedvalue", "formatted", "range" -> {
                        if (val.isTextual() && looksLikeSalaryLabel(val.asText())) {
                            builder.displayLabel = coalesceLabel(builder.displayLabel, val.asText().trim());
                            SalaryInfo parsed = parseFromText(val.asText());
                            if (parsed.hasStructured()) {
                                builder.min = coalesce(builder.min, parsed.min());
                                builder.max = coalesce(builder.max, parsed.max());
                            }
                        }
                    }
                    default -> walkSalaryKeys(val, builder);
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) walkSalaryKeys(child, builder);
        }
    }

    private static SalaryInfo parseSalarySelectors(String html) {
        Document doc = Jsoup.parse(html);
        String[] selectors = {
                "[data-at=salary-info]",
                "[data-testid=salary]",
                "[class*=salary i]",
                "[class*=Salary]",
                "[itemprop=baseSalary]"
        };
        for (String sel : selectors) {
            Elements els = doc.select(sel);
            for (Element el : els) {
                String text = el.text().trim();
                if (text.isBlank() || text.length() > 120) continue;
                if (!looksLikeSalary(text)) continue;
                SalaryInfo info = parseFromText(text);
                if (info.hasStructured() || info.hasDisplay()) {
                    return info;
                }
                return new SalaryInfo(null, null, detectCurrency(text), text);
            }
        }
        return empty();
    }

    private static boolean looksLikeSalary(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.contains("competitive") && !text.contains("€") && !text.contains("EUR")) {
            return false;
        }
        return text.contains("€") || text.contains("EUR") || lower.contains("salary")
                || lower.contains("£") || text.contains("$");
    }

    private static Integer parseAmount(String raw, String context) {
        if (raw == null || raw.isBlank()) return null;
        String digits = raw.replaceAll("[^0-9.]", "");
        if (digits.isBlank()) return null;
        try {
            double val = Double.parseDouble(digits);
            boolean hasK = raw.toLowerCase(Locale.ROOT).contains("k")
                    || context.toLowerCase(Locale.ROOT).contains("k");
            if (hasK && val < 1000) {
                val *= 1000;
            } else if (!hasK && val < 1000 && digits.length() <= 3) {
                val *= 1000;
            }
            return (int) Math.round(val);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String detectCurrency(String text) {
        if (text == null) return "EUR";
        if (text.contains("£") || text.toUpperCase(Locale.ROOT).contains("GBP")) return "GBP";
        if (text.contains("$") || text.toUpperCase(Locale.ROOT).contains("USD")) return "USD";
        return "EUR";
    }

    private static String formatRangeLabel(Integer min, Integer max, String currency) {
        String sym = symbolFor(currency);
        if (min != null && max != null) {
            return sym + formatK(min) + " – " + sym + formatK(max);
        }
        if (min != null) return sym + formatK(min) + "+";
        if (max != null) return "Up to " + sym + formatK(max);
        return null;
    }

    private static String formatSingleLabel(int amount, String currency) {
        return symbolFor(currency) + formatK(amount) + "+";
    }

    private static String formatK(int amount) {
        if (amount >= 1000 && amount % 1000 == 0) {
            return (amount / 1000) + "k";
        }
        return String.format(Locale.ROOT, "%,d", amount);
    }

    private static String symbolFor(String currency) {
        if (currency == null) return "€";
        return switch (currency.toUpperCase(Locale.ROOT)) {
            case "GBP" -> "£";
            case "USD" -> "$";
            default -> "€";
        };
    }

    private static Integer intOrNull(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isInt() || node.isLong()) return node.asInt();
        if (node.isTextual()) {
            return parseAmount(node.asText(), node.asText());
        }
        return null;
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isNull() || !node.isTextual()) return null;
        String t = node.asText().trim();
        return t.isEmpty() ? null : t;
    }

    private static Integer coalesce(Integer a, Integer b) {
        return a != null ? a : b;
    }

    private static String coalesceLabel(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    private static final class SalaryBuilder {
        Integer min;
        Integer max;
        String currency;
        String displayLabel;

        SalaryInfo toInfo() {
            if (min == null && max == null && (displayLabel == null || displayLabel.isBlank())) {
                return empty();
            }
            if (currency == null) currency = "EUR";
            String label = displayLabel;
            if ((label == null || label.isBlank()) && (min != null || max != null)) {
                label = formatRangeLabel(min, max, currency);
            }
            return new SalaryInfo(min, max, currency, label);
        }
    }
}
