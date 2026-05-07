package com.careerops.email;

import java.util.List;

/**
 * Section 8 — Task 91
 * WeeklyDigestEmailTemplate
 *
 * Fully styled responsive HTML email template using inline CSS.
 * Renders a weekly summary with:
 *   - Hero header with personalised greeting
 *   - Stats row: jobs matched | skills run | applications sent
 *   - Top 3 matched new jobs with match-score pill
 *   - Motivational footer with CTA
 *
 * All styles are inline for maximum email client compatibility.
 */
public final class WeeklyDigestEmailTemplate {

    private WeeklyDigestEmailTemplate() {}

    // ── Data carrier ────────────────────────────────────────────────────

    public record WeekStats(
        int jobsMatched,
        int skillsRun,
        int applicationsSent
    ) {}

    public record TopJob(
        String userJobId,
        String title,
        String company,
        String location,
        int    matchPercent
    ) {}

    // ── Builder ───────────────────────────────────────────────────────

    /**
     * Renders the complete HTML email.
     *
     * @param firstName    Recipient first name for personalisation.
     * @param stats        Week statistics.
     * @param topJobs      Up to 3 top-matched jobs from the past week.
     * @param appBaseUrl   Frontend base URL, e.g. https://app.careerops.io
     */
    public static String render(String firstName, WeekStats stats,
                                List<TopJob> topJobs, String appBaseUrl) {
        StringBuilder sb = new StringBuilder(2_000);

        // ─ Wrapper
        sb.append("<!DOCTYPE html><html lang='en'><head>");
        sb.append("<meta charset='UTF-8'>");
        sb.append("<meta name='viewport' content='width=device-width,initial-scale=1'>");
        sb.append("<title>Your Weekly CareerOps Digest</title>");
        sb.append("</head><body style='margin:0;padding:16px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif'>");
        sb.append("<div style='max-width:600px;margin:0 auto'>");

        // ─ Hero header
        sb.append("<div style='background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#3b82f6 100%);");
        sb.append("padding:36px 28px;border-radius:20px 20px 0 0;text-align:center'>");
        sb.append("<p style='margin:0 0 8px;font-size:28px'>📅</p>");
        sb.append("<h1 style='margin:0 0 8px;font-size:24px;font-weight:800;color:#fff'>");
        sb.append("Your Weekly Career Digest</h1>");
        sb.append("<p style='margin:0;font-size:15px;color:rgba(255,255,255,0.85)'>");
        sb.append("Hey ").append(escape(firstName)).append(", here&rsquo;s what happened in your job search this week.</p>");
        sb.append("</div>");

        // ─ Stats row
        sb.append("<div style='background:#fff;padding:24px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0'>");
        sb.append("<table style='width:100%;border-collapse:collapse'><tr>");
        sb.append(statCell("🎯", String.valueOf(stats.jobsMatched()), "Jobs Matched"));
        sb.append(statCell("⚡", String.valueOf(stats.skillsRun()), "Skills Run"));
        sb.append(statCell("📨", String.valueOf(stats.applicationsSent()), "Applications"));
        sb.append("</tr></table>");
        sb.append("</div>");

        // ─ Top jobs section
        sb.append("<div style='background:#f8fafc;padding:24px 28px;");
        sb.append("border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0'>");

        if (topJobs.isEmpty()) {
            sb.append("<p style='text-align:center;color:#94a3b8;font-size:14px;margin:0'>");
            sb.append("No new jobs matched this week. Your profile will keep scanning 🔍</p>");
        } else {
            sb.append("<h2 style='margin:0 0 16px;font-size:15px;font-weight:700;color:#1e293b'>");
            sb.append("\uD83D\uDD25 Top matched jobs this week</h2>");

            for (TopJob job : topJobs) {
                String matchColor = job.matchPercent() >= 80 ? "#10b981"
                                  : job.matchPercent() >= 60 ? "#f59e0b" : "#64748b";

                sb.append("<div style='background:#fff;border-radius:12px;padding:18px;margin-bottom:12px;border:1px solid #e2e8f0'>");
                sb.append("<div style='display:flex;justify-content:space-between;align-items:flex-start'>");
                sb.append("<div style='flex:1;min-width:0'>");
                sb.append("<h3 style='margin:0 0 4px;font-size:15px;font-weight:700;color:#1e293b'>");
                sb.append(escape(job.title())).append("</h3>");
                sb.append("<p style='margin:0;font-size:13px;color:#64748b'>");
                sb.append(escape(job.company()));
                if (job.location() != null && !job.location().isBlank()) {
                    sb.append(" &bull; ").append(escape(job.location()));
                }
                sb.append("</p></div>");
                sb.append("<span style='margin-left:12px;background:").append(matchColor);
                sb.append(";color:#fff;font-size:12px;font-weight:800;padding:4px 10px;border-radius:20px;white-space:nowrap'>");
                sb.append(job.matchPercent()).append("% match</span>");
                sb.append("</div>");

                sb.append("<div style='margin-top:14px'>");
                sb.append("<a href='").append(appBaseUrl).append("/jobs/").append(job.userJobId());
                sb.append("' style='display:inline-block;background:#6366f1;color:#fff;font-size:13px;font-weight:600;");
                sb.append("padding:8px 16px;border-radius:8px;text-decoration:none'>View Analysis &rarr;</a>");
                sb.append("</div></div>");
            }
        }
        sb.append("</div>");

        // ─ Footer
        sb.append("<div style='background:#fff;padding:24px 28px;border-radius:0 0 20px 20px;");
        sb.append("border:1px solid #e2e8f0;border-top:none;text-align:center'>");
        sb.append("<a href='").append(appBaseUrl).append("/dashboard' ");
        sb.append("style='display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);");
        sb.append("color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none'>");
        sb.append("Open Dashboard \uD83D\uDE80</a>");
        sb.append("<p style='margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.5'>");
        sb.append("CareerOps &mdash; AI-powered job search<br/>");
        sb.append("123 Digital Hub, Dublin 8, Ireland<br/>");
        sb.append("To unsubscribe, please update your <a href='").append(appBaseUrl).append("/profile' style='color:#6366f1;text-decoration:underline'>preferences</a>");
        sb.append("</p></div>");

        sb.append("</div></body></html>");
        return sb.toString();
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private static String statCell(String emoji, String value, String label) {
        return "<td style='text-align:center;padding:8px'>" +
            "<div style='font-size:24px;margin-bottom:6px'>" + emoji + "</div>" +
            "<div style='font-size:28px;font-weight:800;color:#1e293b;line-height:1'>" + value + "</div>" +
            "<div style='font-size:12px;color:#64748b;margin-top:4px;font-weight:600'>" + label + "</div>" +
            "</td>";
    }

    /** Minimal HTML-escape to prevent XSS from user-supplied strings. */
    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
