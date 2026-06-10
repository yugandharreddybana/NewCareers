package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.repository.JobRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class JobDescriptionEnrichmentServiceTest {

    @Mock JobRepository jobs;

    private final JobDescriptionEnrichmentService service =
        new JobDescriptionEnrichmentService(jobs, new ObjectMapper());

    @Test
    void enrichIfMissing_skipsWhenDescriptionPresent() {
        Job job = Job.builder()
            .id(UUID.randomUUID())
            .fingerprint("fp")
            .title("Engineer")
            .company("Co")
            .description("Already have text that is long enough to count as a real job description for testing.")
            .sourceUrl(null)
            .build();

        Job result = service.enrichIfMissing(job);

        assertThat(result.getDescription()).contains("Already have");
        verify(jobs, never()).save(any());
    }

    @Test
    void backfillSalaryFromDescription_ignoresBenefitsPackageFalsePositive() {
        Job job = Job.builder()
            .id(UUID.randomUUID())
            .fingerprint("fp-salary")
            .title("Senior Java Developer")
            .company("Recruiter Co")
            .description(
                "Attractive package: bonus, health/dental, pension, etc Senior Java Developer "
                    + "My client is a scaling FinTech org delivering core digital services.")
            .sourceUrl("https://www.irishjobs.ie/job/senior-java-developer/recruiter-job123")
            .build();

        service.enrichIfMissing(job);

        assertThat(job.getSalaryMin()).isNull();
        assertThat(job.getSalaryMax()).isNull();
    }

    @Test
    void enrichSalaryFromSource_doesNotThrowWhenSalariesRemainNull() {
        Job job = Job.builder()
            .id(UUID.randomUUID())
            .fingerprint("fp-null-salary")
            .title("Backend Engineer")
            .company("Acme")
            .description(
                "We need a backend engineer with Java experience. "
                    + "Responsibilities include API design, observability, and mentoring. "
                    + "This is a permanent role based in Dublin with hybrid working.")
            .sourceUrl("https://www.irishjobs.ie/job/backend-engineer/acme-job123")
            .build();

        assertThatCode(() -> service.enrichSalaryFromSource(job)).doesNotThrowAnyException();
        assertThat(job.getSalaryMin()).isNull();
        assertThat(job.getSalaryMax()).isNull();
    }

    @Test
    void parseDescriptionFromDocument_readsJsonLd() {
        String html = """
            <html><head>
            <script type="application/ld+json">
            {"@type":"JobPosting","description":"We are hiring a senior engineer to build scalable web apps with React and TypeScript across our Dublin product team."}
            </script>
            </head><body></body></html>
            """;
        String desc = service.parseDescriptionFromDocument(Jsoup.parse(html), "https://example.com/jobs/1");
        assertThat(desc).contains("senior engineer");
    }
}
