package com.careerops.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

@Service
public class ResendEmailService {
    private static final Logger log = LoggerFactory.getLogger(ResendEmailService.class);

    private final WebClient client;
    private final String key;
    private final String from;

    public ResendEmailService(WebClient.Builder b,
                              @Value("${resend.api.key}") String key,
                              @Value("${resend.from}") String from) {
        this.key = key; this.from = from;
        this.client = b.baseUrl("https://api.resend.com").build();
    }

    // ────────────────────────────────────────────────────────────────────
    // OTP email (existing)
    // ────────────────────────────────────────────────────────────────────
    public void sendOtp(String to, String otp) {
        if (isDevMode()) { log.info("[DEV] Reset OTP for {} = {}", to, otp); return; }
        send(to, "Your CareerOps password reset code",
            "<p>Your code: <b>" + otp + "</b> (valid 15 minutes)</p>");
    }

    // ────────────────────────────────────────────────────────────────────
    // Daily job digest email (new)
    // ────────────────────────────────────────────────────────────────────
    /**
     * Sends the daily job digest to a user.
     *
     * @param to          recipient email
     * @param userName    first name for personalisation
     * @param jobs        list of DigestJob items to include
     * @param appBaseUrl  base URL of the frontend app (for deep links)
     */
    public void sendJobDigest(String to, String userName,
                              List<DigestJob> jobs, String appBaseUrl) {
        if (isDevMode()) {
            log.info("[DEV] Digest for {} — {} jobs", to, jobs.size());
            return;
        }
        if (jobs.isEmpty()) return;

        String html = buildDigestHtml(userName, jobs, appBaseUrl);
        send(to,
            jobs.size() + " new AI-matched job" + (jobs.size() == 1 ? "" : "s") + " found for you today 🚀",
            html);
    }

    /** Simple record to carry per-job digest data. */
    public record DigestJob(
        String userJobId,
        String title,
        String company,
        String location,
        int    matchPercent,
        String humanSummary,
        String sourceUrl
    ) {}

    // ────────────────────────────────────────────────────────────────────
    // Internals
    // ────────────────────────────────────────────────────────────────────
    private boolean isDevMode() {
        return key == null || key.isBlank() || key.startsWith("YOUR_");
    }

    private void send(String to, String subject, String html) {
        try {
            client.post().uri("/emails")
                .header("Authorization", "Bearer " + key)
                .header("Content-Type", "application/json")
                .bodyValue(Map.of(
                    "from",    from,
                    "to",      new String[]{to},
                    "subject", subject,
                    "html",    html
                ))
                .retrieve().bodyToMono(String.class).block();
        } catch (Exception e) {
            log.warn("Resend failed to {}: {}", to, e.getMessage());
        }
    }

    private String buildDigestHtml(String name, List<DigestJob> jobs, String base) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>");
        sb.append("<div style='background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;border-radius:16px 16px 0 0'>");
        sb.append("<h1 style='color:#fff;margin:0;font-size:24px'>🚀 Your Daily Job Digest</h1>");
        sb.append("<p style='color:rgba(255,255,255,0.8);margin:8px 0 0'>Hey ").append(name).append(", here are today's top AI-matched roles</p>");
        sb.append("</div>");
        sb.append("<div style='background:#f8fafc;padding:24px;border-radius:0 0 16px 16px'>");

        for (DigestJob j : jobs) {
            String matchColor = j.matchPercent() >= 80 ? "#10b981" : j.matchPercent() >= 60 ? "#f59e0b" : "#64748b";
            sb.append("<div style='background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0'>");
            sb.append("<div style='display:flex;justify-content:space-between;align-items:flex-start'>");
            sb.append("<div>");
            sb.append("<h3 style='margin:0;font-size:16px'>").append(j.title()).append("</h3>");
            sb.append("<p style='margin:4px 0 0;color:#64748b;font-size:14px'>").append(j.company());
            if (j.location() != null) sb.append(" &bull; ").append(j.location());
            sb.append("</p>");
            sb.append("</div>");
            sb.append("<span style='background:").append(matchColor).append(";color:#fff;font-weight:700;font-size:13px;padding:4px 10px;border-radius:20px'>");
            sb.append(j.matchPercent()).append("% match</span>");
            sb.append("</div>");
            if (j.humanSummary() != null && !j.humanSummary().isBlank()) {
                sb.append("<p style='margin:12px 0 0;font-size:13px;color:#475569;font-style:italic'>&ldquo;").append(j.humanSummary()).append("&rdquo;</p>");
            }
            sb.append("<div style='margin-top:16px;display:flex;gap:8px'>");
            sb.append("<a href='").append(base).append("/jobs/").append(j.userJobId()).append("' ");
            sb.append("style='background:#6366f1;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600'>View AI Analysis</a>");
            if (j.sourceUrl() != null) {
                sb.append("<a href='").append(j.sourceUrl()).append("' ");
                sb.append("style='background:#f1f5f9;color:#1e293b;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600'>Apply Now &rarr;</a>");
            }
            sb.append("</div>");
            sb.append("</div>");
        }

        sb.append("<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px'>");
        sb.append("<a href='").append(base).append("/dashboard' style='color:#6366f1'>Open Dashboard</a>");
        sb.append(" &bull; <a href='").append(base).append("/profile' style='color:#6366f1'>Update Preferences</a>");
        sb.append("</p></div></div>");
        return sb.toString();
    }
}
