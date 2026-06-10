package com.careerops.service;

import java.util.List;

/**
 * Builds XHTML for cover-letter PDF export (OpenHTMLtoPDF).
 */
public final class CoverLetterPdfHtml {

    private static final String PARA_STYLE =
            "margin:0 0 14pt 0;display:block;font-size:13px;line-height:1.65;";

    private CoverLetterPdfHtml() {}

    public static String buildDocument(String letter, String jobTitle, String company) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\"><head><meta charset=\"UTF-8\"/>");
        html.append("<style>");
        html.append("body{font-family:Georgia,'Times New Roman',serif;margin:48px 56px;color:#1a1a1a;}");
        html.append("h1{font-size:22px;color:#01696f;margin:0 0 4px 0;}");
        html.append(".subtitle{font-size:13px;color:#555;margin:0 0 28px 0;}");
        html.append("</style></head><body>");
        html.append("<h1>Cover Letter</h1>");
        html.append("<p class=\"subtitle\">")
                .append(esc(jobTitle)).append(" · ").append(esc(company))
                .append("</p>");
        html.append(buildLetterBodyHtml(letter));
        html.append("</body></html>");
        return html.toString();
    }

    static String buildLetterBodyHtml(String letter) {
        List<String> paragraphs = ParagraphText.splitBlankLineParagraphs(letter);
        if (paragraphs.isEmpty()) {
            return "";
        }
        StringBuilder html = new StringBuilder();
        for (String paragraph : paragraphs) {
            html.append("<p style=\"").append(PARA_STYLE).append("\">");
            html.append(paragraphToHtml(paragraph));
            html.append("</p>");
        }
        return html.toString();
    }

    private static String paragraphToHtml(String paragraph) {
        String[] lines = paragraph.split("\\n");
        if (lines.length == 1) {
            return esc(paragraph.trim());
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < lines.length; i++) {
            if (i > 0) {
                sb.append("<br/>");
            }
            sb.append(esc(lines[i].trim()));
        }
        return sb.toString();
    }

    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
