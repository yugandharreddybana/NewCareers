package com.careerops.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ResendEmailService {
    private static final Logger log = LoggerFactory.getLogger(ResendEmailService.class);

    @PersistenceContext
    private EntityManager em;

    private final WebClient client;
    private final String key;
    private final String from;

    public ResendEmailService(WebClient.Builder b,
                              @Value("${resend.api.key}") String key,
                              @Value("${resend.from}") String from) {
        this.key  = key;
        this.from = from;
        this.client = b.baseUrl("https://api.resend.com").build();
    }

    // ────────────────────────────────────────────────────────────────────────
    // OTP email (existing)
    // ────────────────────────────────────────────────────────────────────────

    public void sendOtp(String to, String otp) {
        if (isDevMode()) { log.info("[DEV] Reset OTP for {} = {}", to, otp); return; }
        send(to, "Your CareerOps password reset code",
            "<p>Your code: <b>" + otp + "</b> (valid 15 minutes)</p>");
    }

    // ────────────────────────────────────────────────────────────────────────
    // Daily job digest email (existing)
    // ────────────────────────────────────────────────────────────────────────

    public void sendJobDigest(String to, String userName,
                              List<DigestJob> jobs, String appBaseUrl) {
        if (isDevMode()) {
            log.info("[DEV] Digest for {} — {} jobs", to, jobs.size());
            return;
        }
        if (jobs.isEmpty()) return;

        String html = buildDigestHtml(userName, jobs, appBaseUrl);
        send(to,
            jobs.size() + " new AI-matched job" + (jobs.size() == 1 ? "" : "s") + " found for you today \uD83D\uDE80",
            html);
    }

    public record DigestJob(
        String userJobId,
        String title,
        String company,
        String location,
        int    matchPercent,
        String humanSummary,
        String sourceUrl
    ) {}

    // ────────────────────────────────────────────────────────────────────────
    // Section 8 — Task 88
    // Skill-complete transactional email
    // Sent when a long-running AI skill (e.g. CV analysis, interview prep)
    // finishes processing for a specific job.
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @param userId    User who ran the skill.
     * @param skillName Human-readable skill name, e.g. "CV Tailoring".
     * @param jobTitle  Job the skill was run against, e.g. "Senior Java Engineer".
     */
    public void sendSkillCompleteEmail(UUID userId, String skillName, String jobTitle) {
        UserContact contact = resolveContact(userId);
        if (contact == null) return;

        if (isDevMode()) {
            log.info("[DEV] Skill-complete email for {} — skill='{}' job='{}'",
                     contact.email(), skillName, jobTitle);
            return;
        }

        String subject = "✨ " + skillName + " is ready for “" + jobTitle + "”";
        String html    = buildSkillCompleteHtml(contact.firstName(), skillName, jobTitle);
        send(contact.email(), subject, html);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Section 8 — Task 89
    // Interview reminder transactional email
    // Triggered when the user moves a Kanban card to the Interview column.
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @param userId      User who moved the card.
     * @param jobTitle    Title of the job being interviewed for.
     * @param companyName Company running the interview.
     */
    public void sendInterviewReminderEmail(UUID userId, String jobTitle, String companyName) {
        UserContact contact = resolveContact(userId);
        if (contact == null) return;

        if (isDevMode()) {
            log.info("[DEV] Interview reminder for {} — job='{}' company='{}'",
                     contact.email(), jobTitle, companyName);
            return;
        }

        String subject = "\uD83D\uDCCB Interview stage: " + jobTitle + " @ " + companyName;
        String html    = buildInterviewReminderHtml(contact.firstName(), jobTitle, companyName);
        send(contact.email(), subject, html);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Internals
    // ────────────────────────────────────────────────────────────────────────

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
                    "to",      new String[]{ to },
                    "subject", subject,
                    "html",    html
                ))
                .retrieve().bodyToMono(String.class).block();
        } catch (Exception e) {
            log.warn("Resend failed to {}: {}", to, e.getMessage());
        }
    }

    /**
     * Resolves email + first_name for a userId from the users table.
     * Returns null if the user cannot be found (e.g. deleted account).
     */
    private UserContact resolveContact(UUID userId) {
        try {
            Object[] row = (Object[]) em.createNativeQuery(
                    "SELECT email, first_name FROM career_operations.users WHERE id = :userId")
                    .setParameter("userId", userId)
                    .getSingleResult();
            String email     = row[0] instanceof String s ? s : null;
            String firstName = row[1] instanceof String n ? n : "there";
            if (email == null || email.isBlank()) return null;
            return new UserContact(email, firstName);
        } catch (NoResultException e) {
            log.warn("resolveContact: no user found for id={}", userId);
            return null;
        } catch (Exception e) {
            log.warn("resolveContact failed for userId={}: {}", userId, e.getMessage());
            return null;
        }
    }

    private record UserContact(String email, String firstName) {}

    // ────────────────────────────────────────────────────────────────────────
    // HTML builders — inline CSS, max-width 600px, consistent brand colours
    // ────────────────────────────────────────────────────────────────────────

    private String buildSkillCompleteHtml(String name, String skillName, String jobTitle) {
        return "<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>" +
            "<div style='background:linear-gradient(135deg,#8b5cf6,#6366f1);padding:32px 24px;border-radius:16px 16px 0 0'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px'>✨ Your AI skill is ready!</h1>" +
            "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0'>Hey " + name + ", results are waiting for you.</p>" +
            "</div>" +
            "<div style='background:#f8fafc;padding:28px 24px;border-radius:0 0 16px 16px'>" +
            "<div style='background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0'>" +
            "<p style='margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px'>Skill completed</p>" +
            "<h2 style='margin:0 0 4px;font-size:18px;color:#1e293b'>" + skillName + "</h2>" +
            "<p style='margin:0;font-size:14px;color:#64748b'>for <strong>" + jobTitle + "</strong></p>" +
            "</div>" +
            "<p style='font-size:14px;color:#475569;margin:20px 0'>" +
            "Your AI analysis has finished. Head to your dashboard to review the insights and tailor your application." +
            "</p>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px'>CareerOps &mdash; AI-powered job search</p>" +
            "</div></div>";
    }

    private String buildInterviewReminderHtml(String name, String jobTitle, String companyName) {
        return "<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>" +
            "<div style='background:linear-gradient(135deg,#6366f1,#3b82f6);padding:32px 24px;border-radius:16px 16px 0 0'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px'>\uD83C\uDF1F You\'ve moved to Interview!</h1>" +
            "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0'>Great work, " + name + ". Here\'s what to prepare next.</p>" +
            "</div>" +
            "<div style='background:#f8fafc;padding:28px 24px;border-radius:0 0 16px 16px'>" +
            "<div style='background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;border-left:4px solid #6366f1'>" +
            "<p style='margin:0 0 4px;font-size:13px;color:#6366f1;font-weight:700;text-transform:uppercase;letter-spacing:.5px'>Interview stage</p>" +
            "<h2 style='margin:4px 0;font-size:18px;color:#1e293b'>" + jobTitle + "</h2>" +
            "<p style='margin:0;font-size:14px;color:#64748b'>at <strong>" + companyName + "</strong></p>" +
            "</div>" +
            "<div style='margin:20px 0;background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0'>" +
            "<p style='margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b'>\uD83D\uDCCB Interview prep checklist</p>" +
            "<ul style='margin:0;padding-left:20px;font-size:13px;color:#475569;line-height:1.8'>" +
            "<li>Run the Interview Prep skill in CareerOps for tailored Q&amp;As</li>" +
            "<li>Research " + companyName + "&rsquo;s recent news and culture</li>" +
            "<li>Review the job description against your matched skills</li>" +
            "<li>Prepare 3 strong STAR-format examples</li>" +
            "</ul>" +
            "</div>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px'>CareerOps &mdash; AI-powered job search</p>" +
            "</div></div>";
    }

    private String buildDigestHtml(String name, List<DigestJob> jobs, String base) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>");
        sb.append("<div style='background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;border-radius:16px 16px 0 0'>");
        sb.append("<h1 style='color:#fff;margin:0;font-size:24px'>\uD83D\uDE80 Your Daily Job Digest</h1>");
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
            sb.append("</p></div>");
            sb.append("<span style='background:").append(matchColor).append(";color:#fff;font-weight:700;font-size:13px;padding:4px 10px;border-radius:20px'>");
            sb.append(j.matchPercent()).append("% match</span></div>");
            if (j.humanSummary() != null && !j.humanSummary().isBlank()) {
                sb.append("<p style='margin:12px 0 0;font-size:13px;color:#475569;font-style:italic'>&ldquo;").append(j.humanSummary()).append("&rdquo;</p>");
            }
            sb.append("<div style='margin-top:16px;display:flex;gap:8px'>");
            sb.append("<a href='").append(base).append("/jobs/").append(j.userJobId()).append("' ");
            sb.append("style='background:#6366f1;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600'>View AI Analysis</a>");
            if (j.sourceUrl() != null) {
                sb.append("<a href='").append(j.sourceUrl()).append("' style='background:#f1f5f9;color:#1e293b;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600'>Apply Now &rarr;</a>");
            }
            sb.append("</div></div>");
        }

        sb.append("<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px'>");
        sb.append("<a href='").append(base).append("/dashboard' style='color:#6366f1'>Open Dashboard</a>");
        sb.append(" &bull; <a href='").append(base).append("/profile' style='color:#6366f1'>Update Preferences</a>");
        sb.append("</p></div></div>");
        return sb.toString();
    }
}
