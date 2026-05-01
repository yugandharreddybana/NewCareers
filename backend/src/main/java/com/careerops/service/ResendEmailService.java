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

    public void sendOtp(String to, String otp) {
        if (isDevMode()) { log.info("[DEV] Reset OTP for {} = {}", to, otp); return; }
        send(to, "Your CareerOps password reset code",
            "<p>Your code: <b>" + otp + "</b> (valid 15 minutes)</p>");
    }

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

    public record DigestJob(
        String userJobId,
        String title,
        String company,
        String location,
        int    matchPercent,
        String humanSummary,
        String sourceUrl
    ) {}

    public void sendSkillCompleteEmail(UUID userId, String skillName, String jobTitle) {
        UserContact contact = resolveContact(userId);
        if (contact == null) return;
        if (isDevMode()) {
            log.info("[DEV] Skill-complete email for {} — skill='{}' job='{}'",
                     contact.email(), skillName, jobTitle);
            return;
        }
        String subject = "✨ " + skillName + " is ready for “" + jobTitle + "”";
        send(contact.email(), subject, buildSkillCompleteHtml(contact.firstName(), skillName, jobTitle));
    }

    public void sendInterviewReminderEmail(UUID userId, String jobTitle, String companyName) {
        UserContact contact = resolveContact(userId);
        if (contact == null) return;
        if (isDevMode()) {
            log.info("[DEV] Interview reminder for {} — job='{}' company='{}'",
                     contact.email(), jobTitle, companyName);
            return;
        }
        String subject = "📋 Interview stage: " + jobTitle + " @ " + companyName;
        send(contact.email(), subject, buildInterviewReminderHtml(contact.firstName(), jobTitle, companyName));
    }

    public void sendReferralInviteEmail(String referrerName, String refereeEmail, String referralLink) {
        if (refereeEmail == null || refereeEmail.isBlank()) return;
        if (isDevMode()) {
            log.info("[DEV] Referral invite to {} from {}", refereeEmail, referrerName);
            return;
        }
        String subject = referrerName + " invited you to join CareerOps 🎁";
        send(refereeEmail, subject, buildReferralInviteHtml(referrerName, referralLink));
    }

    public void sendReferralSuccessEmail(UUID referrerId, String refereeName) {
        UserContact contact = resolveContact(referrerId);
        if (contact == null) return;
        if (isDevMode()) {
            log.info("[DEV] Referral success email for {} — referee='{}'",
                     contact.email(), refereeName);
            return;
        }
        String subject = "🎉 " + refereeName + " joined CareerOps — you've earned a reward!";
        send(contact.email(), subject, buildReferralSuccessHtml(contact.firstName(), refereeName));
    }

    private boolean isDevMode() {
        return key == null || key.isBlank() || key.startsWith("YOUR_");
    }

    void send(String to, String subject, String html) {
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
            "<p style='font-size:14px;color:#475569;margin:20px 0'>Your AI analysis has finished. Head to your dashboard to review the insights and tailor your application.</p>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px'>CareerOps &mdash; AI-powered job search</p>" +
            "</div></div>";
    }

    private String buildInterviewReminderHtml(String name, String jobTitle, String companyName) {
        return "<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>" +
            "<div style='background:linear-gradient(135deg,#6366f1,#3b82f6);padding:32px 24px;border-radius:16px 16px 0 0'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px'>🌟 You've moved to Interview!</h1>" +
            "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0'>Great work, " + name + ". Here's what to prepare next.</p>" +
            "</div>" +
            "<div style='background:#f8fafc;padding:28px 24px;border-radius:0 0 16px 16px'>" +
            "<div style='background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;border-left:4px solid #6366f1'>" +
            "<p style='margin:0 0 4px;font-size:13px;color:#6366f1;font-weight:700;text-transform:uppercase;letter-spacing:.5px'>Interview stage</p>" +
            "<h2 style='margin:4px 0;font-size:18px;color:#1e293b'>" + jobTitle + "</h2>" +
            "<p style='margin:0;font-size:14px;color:#64748b'>at <strong>" + companyName + "</strong></p>" +
            "</div>" +
            "<div style='margin:20px 0;background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0'>" +
            "<p style='margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b'>📋 Interview prep checklist</p>" +
            "<ul style='margin:0;padding-left:20px;font-size:13px;color:#475569;line-height:1.8'>" +
            "<li>Run the Interview Prep skill in CareerOps for tailored Q&amp;As</li>" +
            "<li>Research " + companyName + "&rsquo;s recent news and culture</li>" +
            "<li>Review the job description against your matched skills</li>" +
            "<li>Prepare 3 strong STAR-format examples</li>" +
            "</ul></div>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px'>CareerOps &mdash; AI-powered job search</p>" +
            "</div></div>";
    }

    private String buildReferralInviteHtml(String referrerName, String referralLink) {
        return "<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>" +
            "<div style='background:linear-gradient(135deg,#f59e0b,#ef4444);padding:32px 24px;border-radius:16px 16px 0 0'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px'>🎁 You've been invited to CareerOps!</h1>" +
            "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0'>" + referrerName + " thinks you'd love it.</p>" +
            "</div>" +
            "<div style='background:#f8fafc;padding:28px 24px;border-radius:0 0 16px 16px'>" +
            "<p style='font-size:15px;color:#475569;margin:0 0 20px'>CareerOps is an AI-powered job search platform that matches you to roles, evaluates your CV, preps you for interviews, and tracks every application in one place.</p>" +
            "<div style='background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;margin-bottom:20px'>" +
            "<p style='margin:0 0 8px;font-size:13px;color:#64748b'>✓ AI-matched job recommendations</p>" +
            "<p style='margin:0 0 8px;font-size:13px;color:#64748b'>✓ Automated CV scoring &amp; improvement tips</p>" +
            "<p style='margin:0 0 8px;font-size:13px;color:#64748b'>✓ Interview prep with tailored Q&amp;As</p>" +
            "<p style='margin:0;font-size:13px;color:#64748b'>✓ Full application tracker with Kanban board</p>" +
            "</div>" +
            "<div style='text-align:center'>" +
            "<a href='" + referralLink + "' style='display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700'>Join CareerOps &rarr;</a>" +
            "</div>" +
            "<p style='text-align:center;font-size:12px;color:#94a3b8;margin-top:20px'>This invite link is personalised for you.<br/>Invited by " + referrerName + ".</p>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:12px'>CareerOps &mdash; AI-powered job search</p>" +
            "</div></div>";
    }

    private String buildReferralSuccessHtml(String referrerName, String refereeName) {
        return "<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>" +
            "<div style='background:linear-gradient(135deg,#10b981,#06b6d4);padding:32px 24px;border-radius:16px 16px 0 0'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px'>🎉 Your referral worked!</h1>" +
            "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0'>Hey " + referrerName + ", you've earned a reward!</p>" +
            "</div>" +
            "<div style='background:#f8fafc;padding:28px 24px;border-radius:0 0 16px 16px'>" +
            "<div style='background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;text-align:center;margin-bottom:20px'>" +
            "<div style='width:56px;height:56px;background:linear-gradient(135deg,#10b981,#06b6d4);border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:24px'>🏆</div>" +
            "<h2 style='margin:0 0 8px;font-size:18px;color:#1e293b'>" + refereeName + " joined CareerOps!</h2>" +
            "<p style='margin:0;font-size:14px;color:#64748b'>They signed up using your referral link. Your reward has been credited.</p>" +
            "</div>" +
            "<div style='background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #86efac;border-radius:12px;padding:16px;text-align:center'>" +
            "<p style='margin:0;font-size:14px;font-weight:600;color:#166534'>✓ Referral reward earned</p>" +
            "<p style='margin:4px 0 0;font-size:13px;color:#166534'>Keep referring friends to earn more!</p>" +
            "</div>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px'>CareerOps &mdash; AI-powered job search</p>" +
            "</div></div>";
    }

    private String buildDigestHtml(String name, List<DigestJob> jobs, String base) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>");
        sb.append("<div style='background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;border-radius:16px 16px 0 0'>");
        sb.append("<h1 style='color:#fff;margin:0;font-size:24px'>🚀 Your Daily Job Digest</h1>");
        sb.append("<p style='color:rgba(255,255,255,0.8);margin:8px 0 0'>Hey ").append(name).append(", here are today's top AI-matched roles</p>");
        sb.append("</div><div style='background:#f8fafc;padding:24px;border-radius:0 0 16px 16px'>");
        for (DigestJob j : jobs) {
            String mc = j.matchPercent() >= 80 ? "#10b981" : j.matchPercent() >= 60 ? "#f59e0b" : "#64748b";
            sb.append("<div style='background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0'>");
            sb.append("<div style='display:flex;justify-content:space-between;align-items:flex-start'><div>");
            sb.append("<h3 style='margin:0;font-size:16px'>").append(j.title()).append("</h3>");
            sb.append("<p style='margin:4px 0 0;color:#64748b;font-size:14px'>").append(j.company());
            if (j.location() != null) sb.append(" &bull; ").append(j.location());
            sb.append("</p></div><span style='background:").append(mc).append(";color:#fff;font-weight:700;font-size:13px;padding:4px 10px;border-radius:20px'>");
            sb.append(j.matchPercent()).append("% match</span></div>");
            if (j.humanSummary() != null && !j.humanSummary().isBlank())
                sb.append("<p style='margin:12px 0 0;font-size:13px;color:#475569;font-style:italic'>&ldquo;").append(j.humanSummary()).append("&rdquo;</p>");
            sb.append("<div style='margin-top:16px;display:flex;gap:8px'>");
            sb.append("<a href='").append(base).append("/jobs/").append(j.userJobId()).append("' style='background:#6366f1;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600'>View AI Analysis</a>");
            if (j.sourceUrl() != null)
                sb.append("<a href='").append(j.sourceUrl()).append("' style='background:#f1f5f9;color:#1e293b;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600'>Apply Now &rarr;</a>");
            sb.append("</div></div>");
        }
        sb.append("<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px'>");
        sb.append("<a href='").append(base).append("/dashboard' style='color:#6366f1'>Open Dashboard</a>");
        sb.append(" &bull; <a href='").append(base).append("/profile' style='color:#6366f1'>Update Preferences</a>");
        sb.append("</p></div></div>");
        return sb.toString();
    }
}
