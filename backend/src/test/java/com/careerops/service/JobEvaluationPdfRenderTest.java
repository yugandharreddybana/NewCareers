package com.careerops.service;

import com.careerops.dto.JobEvaluationPdfRequest;
import com.careerops.repository.InterviewSessionRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class JobEvaluationPdfRenderTest {

    @Mock private InterviewSessionRepository sessionRepo;
    @Mock private UserJobRepository userJobRepo;
    @Mock private JobRepository jobRepo;

    @InjectMocks private PdfExportService pdfExportService;

    @Test
    void rendersEvaluationReportAsValidPdfBytes() {
        JobEvaluationPdfRequest request = new JobEvaluationPdfRequest(
            "Senior Product Designer",
            "CloudScale AI",
            "Berlin, DE",
            98,
            87,
            "Strong match — worth applying",
            "Your product design background aligns well with this role.",
            List.of("Figma", "Design systems"),
            List.of("B2B SaaS at scale"),
            List.of("Add metrics to case studies"),
            Map.of("technical", 94.0, "culture", 82.0),
            null,
            4.2,
            "Product builder",
            false,
            "AI advisory only.",
            null,
            new JobEvaluationPdfRequest.EvaluationSectionsDto(
                "Executive summary text.",
                "Background match details.",
                "Positioning strategy notes.",
                "Compensation context.",
                "Tailoring plan steps.",
                "Interview prep topics."
            )
        );

        byte[] pdf = pdfExportService.generateEvaluationReportPdf(request);
        assertTrue(pdf.length > 100, "PDF should not be empty");
        assertTrue(
            pdf[0] == '%' && pdf[1] == 'P' && pdf[2] == 'D' && pdf[3] == 'F',
            "Must be PDF magic bytes");
    }

    @Test
    void deserializesFractionalDimensionScoresAndRendersPdf() throws Exception {
        String json = """
            {
              "title": "Senior Engineer",
              "company": "Acme",
              "location": "Remote",
              "dimensionScores": { "role_fit": 4.5, "skills_match": 4.2 },
              "dimensions": [
                { "key": "role_fit", "label": "Role fit", "score": 4.5, "weight": 0.1, "reason": "Strong fit." }
              ]
            }
            """;
        JobEvaluationPdfRequest request = new ObjectMapper().readValue(json, JobEvaluationPdfRequest.class);
        assertNotNull(request.dimensionScores());
        assertTrue(request.dimensionScores().get("role_fit") > 4.4);

        byte[] pdf = pdfExportService.generateEvaluationReportPdf(request);
        assertTrue(pdf.length > 100);
        assertTrue(pdf[0] == '%' && pdf[1] == 'P' && pdf[2] == 'D' && pdf[3] == 'F');
    }
}
