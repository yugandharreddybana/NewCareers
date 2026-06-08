package com.careerops.service;

import com.careerops.email.ClasspathHtmlEmailRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

@Service
public class TrialEmailService {

    private static final Logger log = LoggerFactory.getLogger(TrialEmailService.class);
    private static final DateTimeFormatter TRIAL_DATE =
            DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH)
                    .withZone(ZoneId.of("UTC"));

    private final ResendEmailService resendEmailService;
    private final String appBaseUrl;
    private final int trialDays;

    public TrialEmailService(
            ResendEmailService resendEmailService,
            @Value("${app.base-url:http://localhost:5173}") String appBaseUrl,
            com.careerops.config.SaasBillingProperties saasBillingProperties) {
        this.resendEmailService = resendEmailService;
        this.appBaseUrl = appBaseUrl;
        this.trialDays = saasBillingProperties.getTrialDays();
    }

    public void sendWelcomeTrial(String to, String firstName, Instant trialEndsAt) {
        try {
            String html = ClasspathHtmlEmailRenderer.render("welcome-trial.html", basePlaceholders(firstName, trialEndsAt));
            resendEmailService.sendHtml(to, "Welcome to CareerOps — your " + trialDays + "-day Pro trial starts now", html);
        } catch (Exception ex) {
            log.warn("Failed to send welcome trial email to {}: {}", to, ex.getMessage());
        }
    }

    public void sendTrialEndingSoon(String to, String firstName, Instant trialEndsAt) {
        try {
            String html = ClasspathHtmlEmailRenderer.render("trial-ending-soon.html", basePlaceholders(firstName, trialEndsAt));
            resendEmailService.sendHtml(to, "Your Pro trial ends tomorrow — upgrade to keep access", html);
        } catch (Exception ex) {
            log.warn("Failed to send trial ending soon email to {}: {}", to, ex.getMessage());
        }
    }

    public void sendTrialEndedUpgrade(String to, String firstName) {
        try {
            Map<String, String> placeholders = Map.of(
                    "firstName", safeFirstName(firstName),
                    "upgradeUrl", pricingUrl(),
                    "appBaseUrl", normalizedBaseUrl());
            String html = ClasspathHtmlEmailRenderer.render("trial-ended-upgrade.html", placeholders);
            resendEmailService.sendHtml(to, "Your Pro trial has ended — upgrade to continue", html);
        } catch (Exception ex) {
            log.warn("Failed to send trial ended email to {}: {}", to, ex.getMessage());
        }
    }

    private Map<String, String> basePlaceholders(String firstName, Instant trialEndsAt) {
        return Map.of(
                "firstName", safeFirstName(firstName),
                "trialEndsAt", TRIAL_DATE.format(trialEndsAt),
                "daysRemaining", String.valueOf(trialDays),
                "upgradeUrl", pricingUrl(),
                "appBaseUrl", normalizedBaseUrl());
    }

    private String pricingUrl() {
        return normalizedBaseUrl() + "/pricing";
    }

    private String normalizedBaseUrl() {
        return appBaseUrl != null && !appBaseUrl.isBlank()
                ? appBaseUrl.replaceAll("/+$", "")
                : "http://localhost:5173";
    }

    private static String safeFirstName(String firstName) {
        if (firstName == null || firstName.isBlank()) {
            return "there";
        }
        return firstName.trim();
    }
}
