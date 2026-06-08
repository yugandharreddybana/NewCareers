package com.careerops.service;

import com.careerops.model.User;
import com.careerops.model.UserProfile;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses CV header / contact preamble and builds Version 2.0 two-row HTML.
 */
public final class CvHeaderParser {

    private static final Pattern EMAIL = Pattern.compile(
        "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
    private static final Pattern PHONE = Pattern.compile(
        "(?i)(?:\\bT:|Tel:|Phone:|Mobile:)\\s*([+\\d\\s().\\-]{7,22})");
    private static final Pattern EMAIL_LABEL = Pattern.compile(
        "(?i)\\bE:\\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})");
    private static final Pattern BARE_URL = Pattern.compile(
        "(https?://[^\\s|<>\"']+|www\\.[^\\s|<>\"']+)",
        Pattern.CASE_INSENSITIVE);

    private CvHeaderParser() {}

    public record HeaderData(
        String displayName,
        String phone,
        String email,
        String location,
        String linkedInUrl,
        String githubUrl,
        String portfolioUrl
    ) {}

    public static HeaderData parse(String headerText, User user, UserProfile profile) {
        String text = headerText != null ? headerText.trim() : "";
        String displayName = "";
        String phone = "";
        String email = user != null && user.getEmail() != null ? user.getEmail().trim() : "";
        String location = profile != null && profile.getLocation() != null
            ? profile.getLocation().trim() : "";
        String linkedIn = "";
        String github = "";
        String portfolio = "";

        if (!text.isBlank()) {
            String[] lines = text.split("\\r?\\n");
            if (lines.length > 0) {
                String first = lines[0].strip();
                if (looksLikeName(first)) {
                    displayName = first;
                }
            }

            Matcher phoneM = PHONE.matcher(text);
            if (phoneM.find()) {
                phone = phoneM.group(1).trim();
            }

            Matcher emailLabel = EMAIL_LABEL.matcher(text);
            if (emailLabel.find()) {
                email = emailLabel.group(1).trim();
            } else {
                Matcher emailM = EMAIL.matcher(text);
                if (emailM.find()) {
                    email = emailM.group().trim();
                }
            }

            for (String line : lines) {
                String t = line.strip();
                if (t.contains("|") && (t.toLowerCase(Locale.ROOT).contains("t:")
                        || t.toLowerCase(Locale.ROOT).contains("e:")
                        || EMAIL.matcher(t).find())) {
                    String loc = extractLocationFromContactLine(t, email, phone);
                    if (!loc.isBlank()) {
                        location = loc;
                    }
                }
            }

            List<String> urls = extractUrls(text);
            mergePortfolioUrls(profile, urls);
            for (String url : urls) {
                String lower = url.toLowerCase(Locale.ROOT);
                if (lower.contains("linkedin.com") && linkedIn.isBlank()) {
                    linkedIn = normalizeUrl(url);
                } else if (lower.contains("github.com") && github.isBlank()) {
                    github = normalizeUrl(url);
                } else if (portfolio.isBlank() && !lower.contains("linkedin.com") && !lower.contains("github.com")) {
                    portfolio = normalizeUrl(url);
                }
            }
        }

        linkedIn = pickUrl(profile, "linkedin", linkedIn);
        github = pickUrl(profile, "github", github);
        portfolio = pickPortfolioUrl(profile, portfolio, linkedIn, github);

        return new HeaderData(displayName, phone, email, location, linkedIn, github, portfolio);
    }

    public static String resolveName(User user, HeaderData header) {
        if (user != null && user.getName() != null && !user.getName().isBlank()) {
            return user.getName().trim();
        }
        if (header != null && header.displayName() != null && !header.displayName().isBlank()) {
            return header.displayName().trim();
        }
        return "Candidate";
    }

    public static String resolveContactLine(String jobTitle, UserProfile profile) {
        if (jobTitle != null && !jobTitle.isBlank()) {
            return jobTitle.trim();
        }
        if (profile != null && profile.getGoalTitle() != null && !profile.getGoalTitle().isBlank()) {
            return profile.getGoalTitle().trim();
        }
        return "";
    }

    public static String buildPreambleHtml(HeaderData data) {
        if (data == null) {
            return "";
        }
        List<String> contactParts = new ArrayList<>();
        if (data.phone() != null && !data.phone().isBlank()) {
            contactParts.add("<strong>T:</strong> " + escape(data.phone()));
        }
        if (data.email() != null && !data.email().isBlank()) {
            contactParts.add("<strong>E:</strong> <a href=\"mailto:" + escapeAttr(data.email()) + "\">"
                + escape(data.email()) + "</a>");
        }
        if (data.location() != null && !data.location().isBlank()) {
            contactParts.add(escape(data.location()));
        }

        List<String> linkParts = new ArrayList<>();
        if (data.linkedInUrl() != null && !data.linkedInUrl().isBlank()) {
            linkParts.add(link("LinkedIn", data.linkedInUrl()));
        }
        if (data.githubUrl() != null && !data.githubUrl().isBlank()) {
            linkParts.add(link("GitHub", data.githubUrl()));
        }
        if (data.portfolioUrl() != null && !data.portfolioUrl().isBlank()) {
            linkParts.add(link("Portfolio", data.portfolioUrl()));
        }

        if (contactParts.isEmpty() && linkParts.isEmpty()) {
            return "";
        }

        StringBuilder html = new StringBuilder("<div class=\"header-preamble\">");
        if (!contactParts.isEmpty()) {
            html.append("<p class=\"contact-row\">")
                .append(String.join(" | ", contactParts))
                .append("</p>");
        }
        if (!linkParts.isEmpty()) {
            html.append("<p class=\"links-row\">")
                .append(String.join(" | ", linkParts))
                .append("</p>");
        }
        html.append("</div>");
        return html.toString();
    }

    private static String link(String label, String url) {
        return "<a href=\"" + escapeAttr(normalizeUrl(url)) + "\">" + escape(label) + "</a>";
    }

    private static boolean looksLikeName(String line) {
        if (line.isBlank()) return false;
        String lower = line.toLowerCase(Locale.ROOT);
        if (lower.contains("@") || lower.contains("http") || lower.startsWith("t:")
            || lower.startsWith("e:") || lower.contains("linkedin")
            || lower.contains("github") || lower.contains("portfolio")) {
            return false;
        }
        if (line.contains("|")) return false;
        return line.split("\\s+").length <= 6;
    }

    private static String extractLocationFromContactLine(String line, String email, String phone) {
        String t = line;
        if (email != null && !email.isBlank()) {
            t = t.replaceAll("(?i)\\bE:\\s*" + Pattern.quote(email), "");
            t = t.replace(email, "");
        }
        if (phone != null && !phone.isBlank()) {
            t = t.replaceAll("(?i)\\bT:\\s*" + Pattern.quote(phone), "");
            t = t.replace(phone, "");
        }
        t = t.replaceAll("(?i)\\bT:\\s*", "").replaceAll("(?i)\\bE:\\s*", "");
        String[] parts = t.split("\\|");
        for (int i = parts.length - 1; i >= 0; i--) {
            String seg = parts[i].trim();
            if (seg.isBlank()) continue;
            if (seg.contains("@") || seg.matches(".*\\d{3}.*\\d{4}.*")) continue;
            if (seg.length() >= 3 && seg.length() <= 80) {
                return seg;
            }
        }
        return "";
    }

    private static List<String> extractUrls(String text) {
        List<String> urls = new ArrayList<>();
        Matcher m = BARE_URL.matcher(text);
        while (m.find()) {
            urls.add(m.group(1).trim());
        }
        return urls;
    }

    private static void mergePortfolioUrls(UserProfile profile, List<String> urls) {
        if (profile == null || profile.getPortfolioItems() == null) return;
        for (UserProfile.PortfolioItem item : profile.getPortfolioItems()) {
            if (item.getUrl() != null && !item.getUrl().isBlank()) {
                urls.add(item.getUrl().trim());
            }
        }
    }

    private static String pickUrl(UserProfile profile, String kind, String fromHeader) {
        if (fromHeader != null && !fromHeader.isBlank()) {
            return fromHeader;
        }
        if (profile != null) {
            if ("linkedin".equals(kind) && profile.getLinkedInUrl() != null && !profile.getLinkedInUrl().isBlank()) {
                return normalizeUrl(profile.getLinkedInUrl());
            }
            if ("github".equals(kind) && profile.getGithubUrl() != null && !profile.getGithubUrl().isBlank()) {
                return normalizeUrl(profile.getGithubUrl());
            }
        }
        if (profile == null || profile.getPortfolioItems() == null) {
            return "";
        }
        for (UserProfile.PortfolioItem item : profile.getPortfolioItems()) {
            String url = item.getUrl();
            if (url == null || url.isBlank()) continue;
            String lower = url.toLowerCase(Locale.ROOT);
            if ("linkedin".equals(kind) && lower.contains("linkedin.com")) {
                return normalizeUrl(url);
            }
            if ("github".equals(kind) && lower.contains("github.com")) {
                return normalizeUrl(url);
            }
        }
        return "";
    }

    private static String pickPortfolioUrl(
            UserProfile profile,
            String fromHeader,
            String linkedIn,
            String github) {
        if (fromHeader != null && !fromHeader.isBlank()) {
            return fromHeader;
        }
        if (profile != null && profile.getWebsiteUrl() != null && !profile.getWebsiteUrl().isBlank()) {
            return normalizeUrl(profile.getWebsiteUrl());
        }
        if (profile == null || profile.getPortfolioItems() == null) {
            return "";
        }
        for (UserProfile.PortfolioItem item : profile.getPortfolioItems()) {
            String url = item.getUrl();
            if (url == null || url.isBlank()) continue;
            String lower = url.toLowerCase(Locale.ROOT);
            if (lower.contains("linkedin.com") || lower.contains("github.com")) continue;
            if (url.equals(linkedIn) || url.equals(github)) continue;
            return normalizeUrl(url);
        }
        return "";
    }

    private static String normalizeUrl(String url) {
        if (url == null || url.isBlank()) return "";
        String u = url.trim();
        if (u.startsWith("www.")) {
            return "https://" + u;
        }
        return u;
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttr(String s) {
        return escape(s).replace("\"", "&quot;");
    }
}
