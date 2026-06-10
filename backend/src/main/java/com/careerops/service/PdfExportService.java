package com.careerops.service;

import com.careerops.dto.JobEvaluationPdfRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.model.Job;
import com.careerops.model.SkillRun;
import com.careerops.model.User;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.InterviewSessionRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.UUID;

/**
 * PDF export via OpenHTMLtoPDF (HTML → real PDF bytes).
 */
@Service
@Slf4j
public class PdfExportService {

    private final InterviewSessionRepository sessionRepo;
    private final UserJobRepository userJobRepo;
    private final JobRepository jobRepo;
    private final SkillRunRepository skillRunRepo;
    private final TailorResumeDocxExporter docxExporter;
    private final UserProfileRepository profiles;
    private final UserRepository users;
    private final CoverLetterNormalizer coverLetterNormalizer;

    public PdfExportService(
            InterviewSessionRepository sessionRepo,
            UserJobRepository userJobRepo,
            JobRepository jobRepo,
            SkillRunRepository skillRunRepo,
            TailorResumeDocxExporter docxExporter,
            UserProfileRepository profiles,
            UserRepository users,
            CoverLetterNormalizer coverLetterNormalizer) {
        this.sessionRepo = sessionRepo;
        this.userJobRepo = userJobRepo;
        this.jobRepo = jobRepo;
        this.skillRunRepo = skillRunRepo;
        this.docxExporter = docxExporter;
        this.profiles = profiles;
        this.users = users;
        this.coverLetterNormalizer = coverLetterNormalizer;
    }

    public byte[] generateInterviewKitPdf(List<InterviewQuestionBank> questions, String userJobId) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\"><head><meta charset=\"UTF-8\"/>");
        html.append("<style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a;}");
        html.append("h1{color:#01696f;}h2{color:#333;border-bottom:1px solid #ccc;padding-bottom:4px;}");
        html.append(".q{margin-bottom:24px;}</style></head><body>");
        html.append("<h1>Interview Preparation Kit</h1>");
        html.append("<p>Job Reference: ").append(esc(userJobId)).append("</p>");

        if (questions.isEmpty()) {
            html.append("<p>No questions generated yet. Run the kit generator first.</p>");
        } else {
            for (InterviewQuestionBank bank : questions) {
                html.append("<h2>").append(esc(bank.getCompanyName())).append(" — ").append(esc(bank.getRoleTitle())).append("</h2>");
                html.append("<pre style='white-space:pre-wrap;font-size:13px;'>").append(esc(bank.getQuestion())).append("</pre>");
            }
        }
        html.append("</body></html>");
        return renderPdfFromHtml(html.toString());
    }

    public byte[] generateMockInterviewReportPdf(String sessionId) {
        InterviewSession session = sessionRepo.findById(UUID.fromString(sessionId))
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\"><head><meta charset=\"UTF-8\"/>");
        html.append("<style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a;}");
        html.append("h1{color:#01696f;}h2{color:#333;}.score{font-size:48px;font-weight:700;color:#01696f;}");
        html.append(".label{font-size:12px;color:#7a7974;text-transform:uppercase;letter-spacing:1px;}");
        html.append("</style></head><body>");
        html.append("<h1>Mock Interview Report</h1>");
        html.append("<p class='label'>Session ID</p><p>").append(esc(sessionId)).append("</p>");
        html.append("<p class='label'>Status</p><p>").append(esc(session.getStatus())).append("</p>");
        html.append("<p class='label'>Overall Score</p><p class='score'>").append(session.getOverallScore()).append("<span style='font-size:24px'>/10</span></p>");
        html.append("<p class='label'>Mode</p><p>").append(esc(session.getMode())).append("</p>");
        html.append("<h2>Strengths</h2><p>").append(esc(session.getStrengths())).append("</p>");
        html.append("<h2>Weaknesses</h2><p>").append(esc(session.getWeaknesses())).append("</p>");
        html.append("</body></html>");
        return renderPdfFromHtml(html.toString());
    }

    public byte[] generateSkillPdf(UUID userId, UUID userJobId, String skillName) {
        return generateSkillPdf(userId, userJobId, skillName, null);
    }

    public byte[] generateSkillPdf(UUID userId, UUID userJobId, String skillName, UUID runId) {
        if ("evaluate".equals(skillName)) {
            return generateEvaluatePdf(userId, userJobId);
        }
        if ("cover-letter".equals(skillName)) {
            return generateCoverLetterPdf(userId, userJobId, runId);
        }
        String html = "<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\"><body><h1>"
            + esc(skillName) + "</h1><p>User Job: " + userJobId + "</p></body></html>";
        return renderPdfFromHtml(html);
    }

    public byte[] generateEvaluationReportPdf(JobEvaluationPdfRequest request) {
        return renderPdfFromHtml(JobEvaluationPdfHtml.fromRequest(request));
    }

    public byte[] generateAllSkillsPdf(UUID userId, UUID userJobId) {
        String html = "<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\"><body><h1>All Skills Report</h1><p>User Job: "
            + userJobId + "</p></body></html>";
        return renderPdfFromHtml(html);
    }

    public byte[] generateResumePdf(UUID userId, UUID userJobId) {
        SkillRun run = skillRunRepo
                .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, "tailor-resume")
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "No tailored resume found. Run Tailor my CV for this job first."));
        String html = run.getResumeHtml();
        if (html == null || html.isBlank()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Tailored resume HTML was not saved. Re-run Tailor my CV and wait for completion.");
        }
        String document = html.trim().toLowerCase().startsWith("<!doctype")
                || html.trim().toLowerCase().startsWith("<html")
                ? html
                : "<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\"><head><meta charset=\"UTF-8\"/></head><body>"
                    + html + "</body></html>";
        return renderPdfFromHtml(document);
    }

    public byte[] generateResumeDocx(UUID userId, UUID userJobId) {
        SkillRun run = skillRunRepo
                .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, "tailor-resume")
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "No tailored resume found. Run Tailor my CV for this job first."));
        JsonNode output = run.getOutput();
        if (output == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tailored resume data is missing.");
        }
        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        User user = users.findById(userId).orElse(null);
        Job job = userJobRepo.findByIdAndUserId(userJobId, userId)
                .flatMap(uj -> jobRepo.findById(uj.getJobId()))
                .orElse(null);
        String summary = output.path("summary").asText("");
        JsonNode sections = output.path("sections");
        try {
            return docxExporter.export(
                user, profile, job, output.path("jobTitle").asText(""), summary, sections);
        } catch (Exception e) {
            log.error("DOCX export failed for userJobId={}", userJobId, e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate DOCX resume");
        }
    }

    private byte[] generateCoverLetterPdf(UUID userId, UUID userJobId, UUID runId) {
        SkillRun run = resolveSkillRun(userId, userJobId, "cover-letter", runId);
        JsonNode output = run.getOutput();
        if (output == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cover letter data is missing.");
        }
        ObjectNode normalized = coverLetterNormalizer.normalizeForUser(userId, output);
        String letter = normalized.path("letter").asText("");
        if (letter.isBlank()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Cover letter text was not saved. Re-run Cover Letter and wait for completion.");
        }

        UserJob uj = userJobRepo.findByIdAndUserId(userJobId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job not found"));
        Job job = jobRepo.findById(uj.getJobId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job posting missing"));

        String html = CoverLetterPdfHtml.buildDocument(
                letter,
                job.getTitle() != null ? job.getTitle() : "",
                job.getCompany() != null ? job.getCompany() : "");
        return renderPdfFromHtml(html);
    }

    private SkillRun resolveSkillRun(UUID userId, UUID userJobId, String skill, UUID runId) {
        if (runId != null) {
            return skillRunRepo.findByIdAndUserId(runId, userId)
                    .filter(r -> skill.equals(r.getSkill()) && userJobId.equals(r.getUserJobId()))
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Skill run not found."));
        }
        return skillRunRepo
                .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, skill)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "No cover letter found. Run Cover Letter for this job first."));
    }

    private byte[] generateEvaluatePdf(UUID userId, UUID userJobId) {
        UserJob uj = userJobRepo.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job not found"));
        Job job = jobRepo.findById(uj.getJobId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job posting missing"));
        return renderPdfFromHtml(JobEvaluationPdfHtml.fromUserJob(uj, job));
    }

    private byte[] renderPdfFromHtml(String html) {
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            String xhtml = toWellFormedXhtml(html);
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(xhtml, null);
            builder.toStream(os);
            builder.run();
            byte[] pdf = os.toByteArray();
            if (pdf.length < 5 || pdf[0] != '%' || pdf[1] != 'P' || pdf[2] != 'D' || pdf[3] != 'F') {
                throw new IllegalStateException("PDF renderer did not produce a valid PDF stream");
            }
            return pdf;
        } catch (Exception e) {
            log.error("Failed to render PDF from HTML", e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate PDF report");
        }
    }

    /** Normalize HTML for OpenHTMLtoPDF (strict XML; fixes stray tags in user/AI text). */
    static String toWellFormedXhtml(String html) {
        Document doc = Jsoup.parse(html);
        doc.outputSettings()
            .syntax(Document.OutputSettings.Syntax.xml)
            .escapeMode(org.jsoup.nodes.Entities.EscapeMode.xhtml)
            .charset("UTF-8");
        return doc.html();
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
