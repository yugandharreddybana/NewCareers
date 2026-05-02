package com.careerops.service;

import com.careerops.model.UserStreak;
import com.careerops.model.WeeklyProgressSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * Task 66 — Sends personalized weekly progress emails using ResendEmailService.
 * Called by WeeklyProgressScheduler every Monday at 08:00 UTC.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WeeklyProgressEmailService {

    private final ResendEmailService resendEmailService;

    @Value("${app.base-url:https://app.careerops.io}")
    private String appBaseUrl;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("d MMM yyyy");

    /**
     * Sends a weekly progress summary email to a single user.
     *
     * @param toEmail   recipient email address
     * @param firstName recipient first name
     * @param snap      the week's progress snapshot
     * @param streak    the user's streak record
     */
    public void sendWeeklyProgressEmail(
            String toEmail,
            String firstName,
            WeeklyProgressSnapshot snap,
            UserStreak streak) {

        try {
            String name = firstName != null ? firstName : "there";
            String html = String.format(
                "<h2>Your weekly CareerOps progress 📈</h2>" +
                "<p>Hello %s,</p>" +
                "<p>Here is your summary for the week:</p>" +
                "<ul>" +
                "<li>Jobs reviewed: %d</li>" +
                "<li>Applications submitted: %d</li>" +
                "<li>Interviews scheduled: %d</li>" +
                "<li>Offers received: %d</li>" +
                "</ul>" +
                "<p>Visit your dashboard to learn more!</p>",
                name, snap.getJobsReviewed(), snap.getApplicationsSubmitted(),
                snap.getInterviewsScheduled(), snap.getOffersReceived()
            );

            resendEmailService.send(
                    toEmail,
                    "Your weekly CareerOps progress 📈",
                    html
            );

            log.info("[WeeklyProgressEmail] Sent to {} for week {}", toEmail, snap.getWeekStart());
        } catch (Exception e) {
            log.error("[WeeklyProgressEmail] Failed to send to {}: {}", toEmail, e.getMessage());
        }
    }

    private Map<String, Object> buildTemplateVars(
            String firstName,
            WeeklyProgressSnapshot snap,
            UserStreak streak) {

        Map<String, Object> vars = new HashMap<>();
        vars.put("firstName", firstName != null ? firstName : "there");
        vars.put("weekStartFormatted", snap.getWeekStart().format(DATE_FMT));
        vars.put("weekEndFormatted", snap.getWeekEnd().format(DATE_FMT));

        vars.put("jobsReviewed", snap.getJobsReviewed());
        vars.put("applicationsSubmitted", snap.getApplicationsSubmitted());
        vars.put("interviewsScheduled", snap.getInterviewsScheduled());
        vars.put("responsesReceived", snap.getResponsesReceived());
        vars.put("offersReceived", snap.getOffersReceived());
        vars.put("responseRate", snap.getResponseRate() != null
                ? snap.getResponseRate().toPlainString() : "0");

        vars.put("currentStreak", streak != null ? streak.getCurrentDailyStreak() : 0);
        vars.put("longestStreak", streak != null ? streak.getLongestDailyStreak() : 0);

        vars.put("winsSummary", snap.getWinsSummary());
        vars.put("bottlenecksSummary", snap.getBottlenecksSummary());
        vars.put("recommendations", snap.getRecommendations());

        vars.put("appBaseUrl", appBaseUrl);
        vars.put("unsubscribeUrl", appBaseUrl + "/unsubscribe?email=" + java.net.URLEncoder.encode("", java.nio.charset.StandardCharsets.UTF_8));
        vars.put("year", Year.now().getValue());

        return vars;
    }
}
