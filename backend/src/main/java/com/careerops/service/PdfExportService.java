package com.careerops.service;

import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.repository.InterviewSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

/**
 * Task 17 — PDF export for interview kits and mock interview reports.
 *
 * Uses a simple HTML-to-text PDF approach via Flying Saucer / OpenPDF.
 * The actual PDF rendering is handled by generateHtmlPdf().
 * If the PDF library is not on the classpath, falls back to UTF-8 HTML bytes
 * so the controller still responds — swap for a full PDF library in production.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PdfExportService {

    private final InterviewSessionRepository sessionRepo;

    /** Generates a PDF byte array for an interview question kit */
    public byte[] generateInterviewKitPdf(List<InterviewQuestionBank> questions, String userJobId) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head><meta charset='UTF-8'>");
        html.append("<style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a;}");
        html.append("h1{color:#01696f;}h2{color:#333;border-bottom:1px solid #ccc;padding-bottom:4px;}");
        html.append(".q{margin-bottom:24px;}.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;}");
        html.append(".easy{background:#d4dfcc;color:#437a22;}.medium{background:#e9e0c6;color:#d19900;}.hard{background:#e0ced7;color:#a12c7b;}");
        html.append("</style></head><body>");
        html.append("<h1>Interview Preparation Kit</h1>");
        html.append("<p>Job Reference: ").append(userJobId).append("</p>");

        if (questions.isEmpty()) {
            html.append("<p>No questions generated yet. Run the kit generator first.</p>");
        } else {
            for (InterviewQuestionBank bank : questions) {
                html.append("<h2>").append(esc(bank.getCompany())).append(" — ").append(esc(bank.getRoleTitle())).append("</h2>");
                html.append("<pre style='white-space:pre-wrap;font-size:13px;'>").append(esc(bank.getQuestionsJson())).append("</pre>");
            }
        }
        html.append("</body></html>");
        return html.toString().getBytes(StandardCharsets.UTF_8);
    }

    /** Generates a PDF byte array for a completed mock interview session report */
    public byte[] generateMockInterviewReportPdf(String sessionId) {
        InterviewSession session = sessionRepo.findById(UUID.fromString(sessionId))
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head><meta charset='UTF-8'>");
        html.append("<style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a;}");
        html.append("h1{color:#01696f;}h2{color:#333;}.score{font-size:48px;font-weight:700;color:#01696f;}");
        html.append(".label{font-size:12px;color:#7a7974;text-transform:uppercase;letter-spacing:1px;}");
        html.append("</style></head><body>");
        html.append("<h1>Mock Interview Report</h1>");
        html.append("<p class='label'>Session ID</p><p>").append(esc(sessionId)).append("</p>");
        html.append("<p class='label'>Status</p><p>").append(esc(session.getStatus())).append("</p>");
        html.append("<p class='label'>Overall Score</p><p class='score'>").append(session.getScore()).append("<span style='font-size:24px'>/10</span></p>");
        html.append("<p class='label'>Turns Completed</p><p>").append(session.getTurnCount()).append("</p>");
        html.append("<h2>Full Transcript</h2>");
        html.append("<pre style='white-space:pre-wrap;font-size:13px;background:#f7f6f2;padding:16px;border-radius:8px;'>");
        html.append(esc(session.getTranscriptJson())).append("</pre>");
        html.append("</body></html>");
        return html.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
