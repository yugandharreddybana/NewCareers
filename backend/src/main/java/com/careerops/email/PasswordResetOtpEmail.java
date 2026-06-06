package com.careerops.email;

import org.springframework.web.util.HtmlUtils;

/**
 * Password-reset OTP transactional email.
 */
public final class PasswordResetOtpEmail {

    private PasswordResetOtpEmail() {}

    public static String subject() {
        return "Your NewCareers verification code";
    }

    public static String render(String otp, String firstName, String appBaseUrl) {
        String code = HtmlUtils.htmlEscape(otp != null ? otp : "");
        String greeting = firstName != null && !firstName.isBlank()
                ? "Hi " + firstName + ","
                : "Hi there,";

        String body = "<h1 style=\"margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;\">"
            + "Reset your password</h1>"
            + "<p style=\"margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;\">"
            + "Use the verification code below to reset your NewCareers password. "
            + "This code expires in <strong style=\"color:#0f172a;\">15 minutes</strong>.</p>"
            + "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:0 auto 20px;\">"
            + "<tr><td align=\"center\" style=\"background:#eff6ff;border:1px solid #bfdbfe;"
            + "border-radius:10px;padding:18px 32px;font-size:32px;font-weight:700;"
            + "letter-spacing:10px;color:#2563eb;font-family:ui-monospace,'SF Mono',Consolas,monospace;"
            + "white-space:nowrap;\">" + code + "</td></tr></table>"
            + "<p style=\"margin:0;font-size:13px;line-height:1.6;color:#64748b;\">"
            + "Never share this code with anyone. NewCareers will never ask for it by phone or chat.</p>";

        String base = appBaseUrl != null && !appBaseUrl.isBlank()
                ? appBaseUrl.replaceAll("/+$", "")
                : "https://newcareers.ai";

        return NewCareersEmailLayout.render(
                new NewCareersEmailLayout.EmailContent(
                        greeting,
                        body,
                        "Reset password",
                        base + "/forgot-password"),
                base);
    }
}
