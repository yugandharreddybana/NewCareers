package com.careerops.email;

import org.springframework.web.util.HtmlUtils;

import java.time.Year;

/**
 * Shared HTML email layout for NewCareers transactional messages.
 */
public final class NewCareersEmailLayout {

    private static final String PRIMARY = "#2563eb";
    private static final String FOOTER_ADDRESS = "Dublin, Ireland";

    private NewCareersEmailLayout() {}

    public record EmailContent(String greeting, String bodyHtml, String ctaLabel, String ctaUrl) {}

    public static String render(EmailContent content, String appBaseUrl) {
        String base = appBaseUrl != null && !appBaseUrl.isBlank()
                ? appBaseUrl.replaceAll("/+$", "")
                : "https://newcareers.ai";
        String logoUrl = base + "/icons/icon-192.png";
        String greeting = content.greeting() != null && !content.greeting().isBlank()
                ? "<p style=\"margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;\">"
                  + HtmlUtils.htmlEscape(content.greeting()) + "</p>"
                : "";
        String cta = "";
        if (content.ctaLabel() != null && !content.ctaLabel().isBlank()
                && content.ctaUrl() != null && !content.ctaUrl().isBlank()) {
            cta = "<tr><td align=\"center\" style=\"padding:8px 28px 28px;\">"
                + "<a href=\"" + HtmlUtils.htmlEscape(content.ctaUrl()) + "\" "
                + "style=\"display:inline-block;background:" + PRIMARY + ";color:#ffffff;"
                + "text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;"
                + "border-radius:8px;\">" + HtmlUtils.htmlEscape(content.ctaLabel()) + "</a>"
                + "</td></tr>";
        }

        return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"/>"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>"
            + "<title>NewCareers</title></head>"
            + "<body style=\"margin:0;padding:0;background:#f1f5f9;"
            + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
            + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" "
            + "style=\"background:#f1f5f9;padding:40px 16px;\"><tr><td align=\"center\">"
            + "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" "
            + "style=\"max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;\">"
            + "<tr><td align=\"center\" style=\"padding:28px 28px 12px;\">"
            + "<img src=\"" + HtmlUtils.htmlEscape(logoUrl) + "\" alt=\"NewCareers\" width=\"48\" height=\"48\" "
            + "style=\"display:block;border-radius:10px;\"/>"
            + "<p style=\"margin:12px 0 0;font-size:18px;font-weight:700;color:" + PRIMARY + ";\">NewCareers</p>"
            + "</td></tr>"
            + "<tr><td style=\"padding:0 28px 8px;\">" + greeting + content.bodyHtml() + "</td></tr>"
            + cta
            + "<tr><td style=\"padding:0 28px 24px;\">"
            + "<p style=\"margin:0;font-size:13px;line-height:1.5;color:#94a3b8;\">"
            + "If you didn&rsquo;t request this email, you can safely ignore it.</p></td></tr>"
            + "<tr><td align=\"center\" style=\"padding:20px 28px;background:#f8fafc;"
            + "border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;\">"
            + "<p style=\"margin:0 0 8px;font-size:12px;line-height:1.6;color:#64748b;\">"
            + "<span style=\"color:" + PRIMARY + ";font-weight:600;\">NewCareers</span>"
            + " &middot; " + FOOTER_ADDRESS + " &middot; Secure &amp; encrypted</p>"
            + "<p style=\"margin:0;font-size:12px;line-height:1.5;color:#94a3b8;\">&copy; "
            + Year.now().getValue() + " NewCareers. All rights reserved.</p>"
            + "</td></tr></table></td></tr></table></body></html>";
    }
}
