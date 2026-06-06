package com.careerops.service;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Converts CV date range strings (e.g. "Sept 2024 – Present") into YYYY-MM fields
 * used by onboarding MonthYearField.
 */
final class CvDateRangeParser {

    private static final Map<String, String> MONTH_TO_ISO = Map.ofEntries(
        Map.entry("jan", "01"), Map.entry("january", "01"),
        Map.entry("feb", "02"), Map.entry("february", "02"),
        Map.entry("mar", "03"), Map.entry("march", "03"),
        Map.entry("apr", "04"), Map.entry("april", "04"),
        Map.entry("may", "05"),
        Map.entry("jun", "06"), Map.entry("june", "06"),
        Map.entry("jul", "07"), Map.entry("july", "07"),
        Map.entry("aug", "08"), Map.entry("august", "08"),
        Map.entry("sep", "09"), Map.entry("sept", "09"), Map.entry("september", "09"),
        Map.entry("oct", "10"), Map.entry("october", "10"),
        Map.entry("nov", "11"), Map.entry("november", "11"),
        Map.entry("dec", "12"), Map.entry("december", "12")
    );

    private static final Pattern MONTH_YEAR = Pattern.compile(
        "(?i)\\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
            + "Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+(\\d{4})"
    );

    private static final Pattern YEAR_ONLY = Pattern.compile("\\b(\\d{4})\\b");

    private static final Pattern PRESENT = Pattern.compile(
        "(?i)^(present|current|now|ongoing)$"
    );

    private CvDateRangeParser() {}

    record ParsedDateRange(String startDate, String endDate, boolean current) {}

    static ParsedDateRange parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return new ParsedDateRange("", "", false);
        }
        String normalized = raw.strip()
            .replace('—', '-')
            .replace('–', '-')
            .replaceAll("\\s*-\\s*", " - ")
            .trim();

        String[] parts = normalized.split("\\s+-\\s+", 2);
        String startPart = parts[0].trim();
        String endPart = parts.length > 1 ? parts[1].trim() : "";

        boolean current = endPart.isBlank() || PRESENT.matcher(endPart).matches();
        String startDate = toYearMonth(startPart);
        String endDate = current ? "" : toYearMonth(endPart);
        if (!current && endDate.isBlank() && !endPart.isBlank()) {
            current = PRESENT.matcher(endPart).matches();
        }
        return new ParsedDateRange(startDate, endDate, current);
    }

    private static String toYearMonth(String token) {
        if (token == null || token.isBlank()) {
            return "";
        }
        if (PRESENT.matcher(token.trim()).matches()) {
            return "";
        }
        Matcher monthYear = MONTH_YEAR.matcher(token);
        if (monthYear.find()) {
            String monthKey = monthYear.group(1).toLowerCase(Locale.ROOT).replace(".", "");
            String year = monthYear.group(2);
            String month = MONTH_TO_ISO.getOrDefault(monthKey, "");
            if (!month.isBlank()) {
                return year + "-" + month;
            }
        }
        Matcher yearOnly = YEAR_ONLY.matcher(token);
        if (yearOnly.find()) {
            return yearOnly.group(1) + "-01";
        }
        return "";
    }
}
