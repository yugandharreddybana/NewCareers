package com.careerops.service;

import org.jspecify.annotations.Nullable;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.util.HtmlUtils;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.jsoup.Jsoup;

import com.careerops.email.OnboardingEmailVerificationOtpEmail;
import com.careerops.email.PasswordResetOtpEmail;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ResendEmailService {
    private static final Logger log = LoggerFactory.getLogger(ResendEmailService.class);

    @PersistenceContext
    private EntityManager em;

    private final RestClient client;
    private final String key;
    private final String from;
    private final boolean devMode; // 3.036
    private final com.careerops.repository.UserRepository userRepository;
    private final io.micrometer.core.instrument.MeterRegistry meterRegistry;
    private final String appBaseUrl;

    public ResendEmailService(RestClient.Builder b,
                              @Value("${resend.api.key}") String key,
                              @Value("${resend.from}") String from,
                              @Value("${resend.dev-mode:false}") boolean devMode,
                              @Value("${app.base-url:http://localhost:5173}") String appBaseUrl,
                              com.careerops.repository.UserRepository userRepository,
                              io.micrometer.core.instrument.MeterRegistry meterRegistry) {
        this.key  = key;
        this.from = from;
        this.devMode = devMode;
        this.appBaseUrl = appBaseUrl;
        this.userRepository = userRepository;
        this.meterRegistry = meterRegistry;
        this.client = b.baseUrl("https://api.resend.com").build();
    }

    public void sendOtp(String to, String otp, @Nullable String firstName) {
        if (isDevMode()) {
            log.info("[DEV] Reset OTP for {} = {} (firstName={})", to, otp, firstName);
            return;
        }
        send(to, PasswordResetOtpEmail.subject(),
                PasswordResetOtpEmail.render(otp, firstName, appBaseUrl));
    }

    public void sendOnboardingVerificationOtp(String to, String otp, @Nullable String firstName) {
        if (isDevMode()) {
            log.info("[DEV] Onboarding verification OTP for {} = {} (firstName={})", to, otp, firstName);
            return;
        }
        send(to, OnboardingEmailVerificationOtpEmail.subject(),
                OnboardingEmailVerificationOtpEmail.render(otp, firstName, appBaseUrl));
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
            jobs.size() + " new AI-matched job" + (jobs.size() == 1 ? "" : "s") + " found for you today",
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
        String subject = skillName + " is ready for “" + jobTitle + "”";
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
        String subject = "Interview stage: " + jobTitle + " @ " + companyName;
        send(contact.email(), subject, buildInterviewReminderHtml(contact.firstName(), jobTitle, companyName));
    }

    public void sendReferralInviteEmail(String referrerName, String refereeEmail, String referralLink) {
        if (refereeEmail == null || refereeEmail.isBlank()) return;
        if (isDevMode()) {
            log.info("[DEV] Referral invite to {} from {}", refereeEmail, referrerName);
            return;
        }
        String subject = referrerName + " invited you to join NewCareers";
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
        String subject = refereeName + " joined NewCareers — you've earned a reward!";
        send(contact.email(), subject, buildReferralSuccessHtml(contact.firstName(), refereeName));
    }

    private boolean isDevMode() {
        // 3.036 — Explicit dev-mode flag or placeholder key
        return devMode || key == null || key.isBlank() || key.contains("YOUR_RESEND_KEY");
    }

    @CircuitBreaker(name = "resendEmail", fallbackMethod = "sendFallback")
    void send(String to, String subject, String html) {
        try {
            // 3.038 — Generate plain-text alternative to improve deliverability
            String text = Jsoup.parse(html).text();
 
            meterRegistry.timer("email.resend.send").record(() ->
                client.post().uri("/emails")
                    .header("Authorization", "Bearer " + key)
                    .header("Content-Type", "application/json")
                    .body(Map.of(
                        "from",    from,
                        "to",      new String[]{ to },
                        "subject", subject,
                        "html",    html,
                        "text",    text // 3.038
                    ))
                    .retrieve().body(String.class)
            );
        } catch (Exception e) {
            log.error("Resend delivery failed to {}: {}", to, e.getMessage());
            throw e; // Rethrow for circuit breaker to track
        }
    }

    void sendFallback(String to, String subject, String html, Throwable t) {
        log.warn("Resend circuit breaker OPEN or failed. Email suppressed to {}: {}", to, t.getMessage());
    }

    private @Nullable UserContact resolveContact(UUID userId) {
        return userRepository.findById(userId)
                .map(u -> new UserContact(u.getEmail(), u.getName() != null ? u.getName().split(" ")[0] : "there"))
                .orElseGet(() -> {
                    log.warn("resolveContact: no user found for id={}", userId);
                    return null;
                });
    }

    private record UserContact(String email, String firstName) {}

    private String buildSkillCompleteHtml(String name, String skillName, String jobTitle) {
        String eName      = HtmlUtils.htmlEscape(name);
        String eSkill     = HtmlUtils.htmlEscape(skillName);
        String eJob       = HtmlUtils.htmlEscape(jobTitle);
        return "<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>" +
            "<div style='background:linear-gradient(135deg,#8b5cf6,#6366f1);padding:32px 24px;border-radius:16px 16px 0 0'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px'>✨ Your AI skill is ready!</h1>" +
            "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0'>Hey " + eName + ", results are waiting for you.</p>" +
            "</div>" +
            "<div style='background:#f8fafc;padding:28px 24px;border-radius:0 0 16px 16px'>" +
            "<div style='background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0'>" +
            "<p style='margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px'>Skill completed</p>" +
            "<h2 style='margin:0 0 4px;font-size:18px;color:#1e293b'>" + eSkill + "</h2>" +
            "<p style='margin:0;font-size:14px;color:#64748b'>for <strong>" + eJob + "</strong></p>" +
            "</div>" +
            "<p style='font-size:14px;color:#475569;margin:20px 0'>Your AI analysis has finished. Head to your dashboard to review the insights and tailor your application.</p>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;line-height:1.5'>" +
            "NewCareers &mdash; AI-powered job search<br/>" +
            "123 Digital Hub, Dublin 8, Ireland<br/>" +
            "To unsubscribe, please update your <a href='https://app.careerops.io/profile' style='color:#6366f1;text-decoration:underline'>preferences</a>" +
            "</p>" +
            "</div></div>";
    }

    private String buildInterviewReminderHtml(String name, String jobTitle, String companyName) {
        String eName    = HtmlUtils.htmlEscape(name);
        String eJob     = HtmlUtils.htmlEscape(jobTitle);
        String eCompany = HtmlUtils.htmlEscape(companyName);
        return "<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>" +
            "<div style='background:linear-gradient(135deg,#6366f1,#3b82f6);padding:32px 24px;border-radius:16px 16px 0 0'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px'>🌟 You've moved to Interview!</h1>" +
            "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0'>Great work, " + eName + ". Here's what to prepare next.</p>" +
            "</div>" +
            "<div style='background:#f8fafc;padding:28px 24px;border-radius:0 0 16px 16px'>" +
            "<div style='background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;border-left:4px solid #6366f1'>" +
            "<p style='margin:0 0 4px;font-size:13px;color:#6366f1;font-weight:700;text-transform:uppercase;letter-spacing:.5px'>Interview stage</p>" +
            "<h2 style='margin:4px 0;font-size:18px;color:#1e293b'>" + eJob + "</h2>" +
            "<p style='margin:0;font-size:14px;color:#64748b'>at <strong>" + eCompany + "</strong></p>" +
            "</div>" +
            "<div style='margin:20px 0;background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0'>" +
            "<p style='margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b'>📋 Interview prep checklist</p>" +
            "<ul style='margin:0;padding-left:20px;font-size:13px;color:#475569;line-height:1.8'>" +
            "<li>Run the Interview Prep skill in NewCareers for tailored Q&amp;As</li>" +
            "<li>Research " + eCompany + "&rsquo;s recent news and culture</li>" +
            "<li>Review the job description against your matched skills</li>" +
            "<li>Prepare 3 strong STAR-format examples</li>" +
            "</ul></div>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;line-height:1.5'>" +
            "NewCareers &mdash; AI-powered job search<br/>" +
            "123 Digital Hub, Dublin 8, Ireland<br/>" +
            "To unsubscribe, please update your <a href='https://app.careerops.io/profile' style='color:#6366f1;text-decoration:underline'>preferences</a>" +
            "</p>" +
            "</div></div>";
    }

    private String buildReferralInviteHtml(String referrerName, String referralLink) {
        String eReferrer = HtmlUtils.htmlEscape(referrerName);
        return "<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>" +
            "<div style='background:linear-gradient(135deg,#f59e0b,#ef4444);padding:32px 24px;border-radius:16px 16px 0 0'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px'>🎁 You've been invited to NewCareers!</h1>" +
            "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0'>" + eReferrer + " thinks you'd love it.</p>" +
            "</div>" +
            "<div style='background:#f8fafc;padding:28px 24px;border-radius:0 0 16px 16px'>" +
            "<p style='font-size:15px;color:#475569;margin:0 0 20px'>NewCareers is an AI-powered job search platform that matches you to roles, evaluates your CV, preps you for interviews, and tracks every application in one place.</p>" +
            "<div style='background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;margin-bottom:20px'>" +
            "<p style='margin:0 0 8px;font-size:13px;color:#64748b'>✓ AI-matched job recommendations</p>" +
            "<p style='margin:0 0 8px;font-size:13px;color:#64748b'>✓ Automated CV scoring &amp; improvement tips</p>" +
            "<p style='margin:0 0 8px;font-size:13px;color:#64748b'>✓ Interview prep with tailored Q&amp;As</p>" +
            "<p style='margin:0;font-size:13px;color:#64748b'>✓ Full application tracker with Kanban board</p>" +
            "</div>" +
            "<div style='text-align:center'>" +
            "<a href='" + HtmlUtils.htmlEscape(referralLink) + "' style='display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700'>Join NewCareers &rarr;</a>" +
            "</div>" +
            "<p style='text-align:center;font-size:12px;color:#94a3b8;margin-top:20px'>This invite link is personalised for you.<br/>Invited by " + eReferrer + ".</p>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:12px;line-height:1.5'>" +
            "NewCareers &mdash; AI-powered job search<br/>" +
            "123 Digital Hub, Dublin 8, Ireland<br/>" +
            "To unsubscribe, please update your <a href='https://app.careerops.io/profile' style='color:#6366f1;text-decoration:underline'>preferences</a>" +
            "</p>" +
            "</div></div>";
    }

    private String buildReferralSuccessHtml(String referrerName, String refereeName) {
        String eReferrer = HtmlUtils.htmlEscape(referrerName);
        String eReferee  = HtmlUtils.htmlEscape(refereeName);
        return "<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>" +
            "<div style='background:linear-gradient(135deg,#10b981,#06b6d4);padding:32px 24px;border-radius:16px 16px 0 0'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px'>🎉 Your referral worked!</h1>" +
            "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0'>Hey " + eReferrer + ", you've earned a reward!</p>" +
            "</div>" +
            "<div style='background:#f8fafc;padding:28px 24px;border-radius:0 0 16px 16px'>" +
            "<div style='background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;text-align:center;margin-bottom:20px'>" +
            "<div style='width:56px;height:56px;background:linear-gradient(135deg,#10b981,#06b6d4);border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:24px'>🏆</div>" +
            "<h2 style='margin:0 0 8px;font-size:18px;color:#1e293b'>" + eReferee + " joined NewCareers!</h2>" +
            "<p style='margin:0;font-size:14px;color:#64748b'>They signed up using your referral link. Your reward has been credited.</p>" +
            "</div>" +
            "<div style='background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #86efac;border-radius:12px;padding:16px;text-align:center'>" +
            "<p style='margin:0;font-size:14px;font-weight:600;color:#166534'>✓ Referral reward earned</p>" +
            "<p style='margin:4px 0 0;font-size:13px;color:#166534'>Keep referring friends to earn more!</p>" +
            "</div>" +
            "<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;line-height:1.5'>" +
            "NewCareers &mdash; AI-powered job search<br/>" +
            "123 Digital Hub, Dublin 8, Ireland<br/>" +
            "To unsubscribe, please update your <a href='https://app.careerops.io/profile' style='color:#6366f1;text-decoration:underline'>preferences</a>" +
            "</p>" +
            "</div></div>";
    }

    private String buildDigestHtml(String name, List<DigestJob> jobs, String base) {
        String eName = HtmlUtils.htmlEscape(name);
        StringBuilder sb = new StringBuilder();
        sb.append("<div style='font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b'>");
        sb.append("<div style='background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;border-radius:16px 16px 0 0'>");
        sb.append("<h1 style='color:#fff;margin:0;font-size:24px'>🚀 Your Daily Job Digest</h1>");
        sb.append("<p style='color:rgba(255,255,255,0.8);margin:8px 0 0'>Hey ").append(eName).append(", here are today's top AI-matched roles</p>");
        sb.append("</div><div style='background:#f8fafc;padding:24px;border-radius:0 0 16px 16px'>");
        for (DigestJob j : jobs) {
            String mc = j.matchPercent() >= 80 ? "#10b981" : j.matchPercent() >= 60 ? "#f59e0b" : "#64748b";
            String eTitle   = HtmlUtils.htmlEscape(j.title());
            String eCompany = HtmlUtils.htmlEscape(j.company());
            String eLoc     = j.location() != null ? HtmlUtils.htmlEscape(j.location()) : null;
            String eSum     = j.humanSummary() != null ? HtmlUtils.htmlEscape(j.humanSummary()) : null;

            sb.append("<div style='background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0'>");
            sb.append("<div style='display:flex;justify-content:space-between;align-items:flex-start'><div>");
            sb.append("<h3 style='margin:0;font-size:16px'>").append(eTitle).append("</h3>");
            sb.append("<p style='margin:4px 0 0;color:#64748b;font-size:14px'>").append(eCompany);
            if (eLoc != null) sb.append(" &bull; ").append(eLoc);
            sb.append("</p></div><span style='background:").append(mc).append(";color:#fff;font-weight:700;font-size:13px;padding:4px 10px;border-radius:20px'>");
            sb.append(j.matchPercent()).append("% match</span></div>");
            if (eSum != null && !eSum.isBlank())
                sb.append("<p style='margin:12px 0 0;font-size:13px;color:#475569;font-style:italic'>&ldquo;").append(eSum).append("&rdquo;</p>");
            sb.append("<div style='margin-top:16px;display:flex;gap:8px'>");
            sb.append("<a href='").append(HtmlUtils.htmlEscape(base + "/jobs/" + j.userJobId())).append("' style='background:#6366f1;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600'>View AI Analysis</a>");
            if (j.sourceUrl() != null)
                sb.append("<a href='").append(HtmlUtils.htmlEscape(j.sourceUrl())).append("' style='background:#f1f5f9;color:#1e293b;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600'>Apply Now &rarr;</a>");
            sb.append("</div></div>");
        }
        sb.append("<p style='text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;line-height:1.5'>");
        sb.append("<a href='").append(base).append("/dashboard' style='color:#6366f1;text-decoration:underline'>Open Dashboard</a>");
        sb.append(" &bull; <a href='").append(base).append("/profile' style='color:#6366f1;text-decoration:underline'>Update Preferences</a>");
        sb.append("<br/><br/>");
        sb.append("NewCareers &mdash; AI-powered job search<br/>");
        sb.append("123 Digital Hub, Dublin 8, Ireland<br/>");
        sb.append("To unsubscribe, please update your preferences.");
        sb.append("</p></div></div>");
        return sb.toString();
    }
}
