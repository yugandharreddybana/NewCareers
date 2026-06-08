package com.careerops.email;

import org.springframework.web.util.HtmlUtils;

/**
 * Onboarding email verification OTP — sent when a new user completes profile setup.
 */
public final class OnboardingEmailVerificationOtpEmail {

    private OnboardingEmailVerificationOtpEmail() {}

    public static String subject() {
        return "Verify your email to complete your NewCareers profile";
    }

    public static String render(String otp, String firstName, String appBaseUrl) {
        String code = HtmlUtils.htmlEscape(otp != null ? otp : "");
        String greeting = firstName != null && !firstName.isBlank()
                ? "Hi " + HtmlUtils.htmlEscape(firstName) + ","
                : "Hi there,";

        String body = "<h1 style=\"margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;\">"
            + "Verify your email</h1>"
            + "<p style=\"margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;\">"
            + "You&rsquo;re almost done setting up your NewCareers profile. "
            + "Enter the verification code below on the onboarding screen to continue.</p>"
            + "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:0 auto 24px;\">"
            + "<tr><td align=\"center\" style=\"background:linear-gradient(135deg,#eff6ff,#f0f9ff);"
            + "border:1px solid #bfdbfe;border-radius:12px;padding:22px 36px;"
            + "font-size:34px;font-weight:700;letter-spacing:8px;color:#2563eb;"
            + "font-family:ui-monospace,'SF Mono',Consolas,monospace;white-space:nowrap;\">"
            + code + "</td></tr></table>"
            + "<p style=\"margin:0 0 12px;font-size:13px;line-height:1.6;color:#64748b;\">"
            + "This code expires in <strong style=\"color:#0f172a;\">15 minutes</strong>. "
            + "You can request a new code up to 3 times, with a 5-minute wait between requests.</p>"
            + "<p style=\"margin:0;font-size:13px;line-height:1.6;color:#64748b;\">"
            + "Never share this code. NewCareers will never ask for it by phone or chat.</p>";

        String base = appBaseUrl != null && !appBaseUrl.isBlank()
                ? appBaseUrl.replaceAll("/+$", "")
                : "https://newcareers.ai";

        return NewCareersEmailLayout.render(
                new NewCareersEmailLayout.EmailContent(
                        greeting,
                        body,
                        "Continue setup",
                        base + "/onboarding"),
                base);
    }
}
