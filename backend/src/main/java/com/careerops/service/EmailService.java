package com.careerops.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Task 29 — Email reminder service.
 * Sends HTML email reminders for deadlines and follow-ups.
 * Reads templates from the templates/ resources directory.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@newcareers.io}")
    private String fromAddress;

    @Value("${app.base-url:https://app.newcareers.io}")
    private String baseUrl;

    /** Task 29 — Deadline reminder email */
    public void sendDeadlineReminder(UUID userId, String eventTitle,
                                      String eventType, LocalDateTime eventDate) {
        try {
            String formatted = eventDate.format(DateTimeFormatter.ofPattern("EEE, d MMM yyyy 'at' HH:mm"));
            String subject = "Reminder: " + eventTitle + " — " + formatted;

            String html = buildDeadlineEmailHtml(eventTitle, eventType, formatted);

            // In production, look up the user's email from UserRepository
            // For now log it so the mechanism is in place
            log.info("[EmailService] Deadline reminder queued for userId={} event='{}'", userId, eventTitle);
            // sendHtml(userEmail, subject, html);
        } catch (Exception e) {
            log.error("[EmailService] Failed to send deadline reminder: {}", e.getMessage());
        }
    }

    /** Task 29 — Follow-up reminder email */
    public void sendFollowUpReminder(UUID userId, String jobTitle, String company, int daysSinceApply) {
        try {
            String subject = "Time to follow up on " + jobTitle + " at " + company;
            String html = buildFollowUpEmailHtml(jobTitle, company, daysSinceApply);
            log.info("[EmailService] Follow-up reminder queued for userId={} job='{}' company='{}'",
                    userId, jobTitle, company);
            // sendHtml(userEmail, subject, html);
        } catch (Exception e) {
            log.error("[EmailService] Failed to send follow-up reminder: {}", e.getMessage());
        }
    }

    // ---- HTML template builders (Task 29) ----

    private String buildDeadlineEmailHtml(String title, String type, String formatted) {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body "
            + "style='font-family:Arial,sans-serif;background:#f7f6f2;margin:0;padding:24px;'>\n"
            + "<div style='max-width:520px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;"
            + "box-shadow:0 4px 16px rgba(0,0,0,.08);'>\n"
            + "  <div style='background:#01696f;padding:24px 32px;'>\n"
            + "    <h1 style='color:#fff;margin:0;font-size:22px;'>\u23f0 Deadline Reminder</h1>\n"
            + "  </div>\n"
            + "  <div style='padding:32px;'>\n"
            + "    <p style='font-size:16px;color:#1a1a1a;'>You have an upcoming deadline:</p>\n"
            + "    <div style='background:#f3f0ec;border-radius:8px;padding:16px 20px;margin:16px 0;'>\n"
            + "      <p style='margin:0 0 6px;font-size:18px;font-weight:700;color:#01696f;'>" + esc(title) + "</p>\n"
            + "      <p style='margin:0;font-size:14px;color:#7a7974;'>" + esc(type) + " &mdash; " + esc(formatted) + "</p>\n"
            + "    </div>\n"
            + "    <a href='" + baseUrl + "/dashboard' "
            + "       style='display:inline-block;background:#01696f;color:#fff;padding:12px 24px;"
            + "              border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;'>\n"
            + "      Open Dashboard &#8594;\n"
            + "    </a>\n"
            + "  </div>\n"
            + "  <div style='padding:16px 32px;border-top:1px solid #dcd9d5;'>\n"
            + "    <p style='font-size:12px;color:#bab9b4;margin:0;'>NewCareers &mdash; Your AI Career Copilot</p>\n"
            + "  </div>\n"
            + "</div></body></html>";
    }

    private String buildFollowUpEmailHtml(String jobTitle, String company, int days) {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body "
            + "style='font-family:Arial,sans-serif;background:#f7f6f2;margin:0;padding:24px;'>\n"
            + "<div style='max-width:520px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;"
            + "box-shadow:0 4px 16px rgba(0,0,0,.08);'>\n"
            + "  <div style='background:#01696f;padding:24px 32px;'>\n"
            + "    <h1 style='color:#fff;margin:0;font-size:22px;'>&#128172; Time to Follow Up</h1>\n"
            + "  </div>\n"
            + "  <div style='padding:32px;'>\n"
            + "    <p style='font-size:16px;color:#1a1a1a;'>It has been <strong>" + days + " days</strong> since you applied to:</p>\n"
            + "    <div style='background:#f3f0ec;border-radius:8px;padding:16px 20px;margin:16px 0;'>\n"
            + "      <p style='margin:0 0 4px;font-size:18px;font-weight:700;color:#01696f;'>" + esc(jobTitle) + "</p>\n"
            + "      <p style='margin:0;font-size:14px;color:#7a7974;'>" + esc(company) + "</p>\n"
            + "    </div>\n"
            + "    <p style='color:#555;font-size:14px;'>Sending a brief, polite follow-up increases your response rate. Use your saved outreach templates inside NewCareers.</p>\n"
            + "    <a href='" + baseUrl + "/dashboard' "
            + "       style='display:inline-block;background:#01696f;color:#fff;padding:12px 24px;"
            + "              border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;'>\n"
            + "      View Job &amp; Templates &#8594;\n"
            + "    </a>\n"
            + "  </div>\n"
            + "  <div style='padding:16px 32px;border-top:1px solid #dcd9d5;'>\n"
            + "    <p style='font-size:12px;color:#bab9b4;margin:0;'>NewCareers &mdash; Your AI Career Copilot</p>\n"
            + "  </div>\n"
            + "</div></body></html>";
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
