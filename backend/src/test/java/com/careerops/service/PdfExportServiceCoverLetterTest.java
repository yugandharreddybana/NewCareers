package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.SkillRun;
import com.careerops.model.User;
import com.careerops.model.UserJob;
import com.careerops.repository.InterviewSessionRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PdfExportServiceCoverLetterTest {

    @Mock InterviewSessionRepository sessionRepo;
    @Mock UserJobRepository userJobRepo;
    @Mock JobRepository jobRepo;
    @Mock SkillRunRepository skillRunRepo;
    @Mock TailorResumeDocxExporter docxExporter;
    @Mock UserProfileRepository profiles;
    @Mock UserRepository users;
    @Mock CoverLetterNormalizer coverLetterNormalizer;

    PdfExportService pdfService;
    ObjectMapper mapper = new ObjectMapper();

    UUID userId = UUID.randomUUID();
    UUID userJobId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        pdfService = new PdfExportService(
                sessionRepo, userJobRepo, jobRepo, skillRunRepo, docxExporter, profiles, users,
                coverLetterNormalizer);
    }

    @Test
    void generateSkillPdf_coverLetter_containsLetterBodyNotStub() {
        SkillRun run = new SkillRun();
        run.setUserId(userId);
        run.setUserJobId(userJobId);
        run.setSkill("cover-letter");
        run.setOutput(mapper.createObjectNode()
                .put("letter", "Dear Hiring Manager,\n\nI am a strong fit.\n\nYours sincerely,\nJane Doe"));

        UserJob uj = new UserJob();
        uj.setJobId(jobId);
        Job job = new Job();
        job.setTitle("Java Engineer");
        job.setCompany("TREQS");

        User user = new User();
        user.setName("Jane Doe");

        when(coverLetterNormalizer.normalizeForUser(eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn((com.fasterxml.jackson.databind.node.ObjectNode) run.getOutput());
        when(skillRunRepo.findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(
                eq(userId), eq(userJobId), eq("cover-letter")))
                .thenReturn(Optional.of(run));
        when(userJobRepo.findByIdAndUserId(userJobId, userId)).thenReturn(Optional.of(uj));
        when(jobRepo.findById(jobId)).thenReturn(Optional.of(job));
        when(users.findById(userId)).thenReturn(Optional.of(user));

        byte[] pdf = pdfService.generateSkillPdf(userId, userJobId, "cover-letter");

        assertThat(pdf).isNotEmpty();
        assertThat(pdf[0]).isEqualTo((byte) '%');
        assertThat(pdf[1]).isEqualTo((byte) 'P');
        assertThat(pdf[2]).isEqualTo((byte) 'D');
        assertThat(pdf[3]).isEqualTo((byte) 'F');
    }

    @Test
    void generateSkillPdf_coverLetter_usesSpecificRunId() {
        UUID runId = UUID.randomUUID();
        SkillRun run = new SkillRun();
        run.setId(runId);
        run.setUserId(userId);
        run.setUserJobId(userJobId);
        run.setSkill("cover-letter");
        run.setOutput(mapper.createObjectNode().put("letter", "Dear Team,\n\nSelected version.\n\nRegards"));

        UserJob uj = new UserJob();
        uj.setJobId(jobId);
        Job job = new Job();
        job.setTitle("Role");
        job.setCompany("Co");

        when(coverLetterNormalizer.normalizeForUser(eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn((com.fasterxml.jackson.databind.node.ObjectNode) run.getOutput());
        when(skillRunRepo.findByIdAndUserId(runId, userId)).thenReturn(Optional.of(run));
        when(userJobRepo.findByIdAndUserId(userJobId, userId)).thenReturn(Optional.of(uj));
        when(jobRepo.findById(jobId)).thenReturn(Optional.of(job));
        when(users.findById(userId)).thenReturn(Optional.empty());

        byte[] pdf = pdfService.generateSkillPdf(userId, userJobId, "cover-letter", runId);

        assertThat(pdf.length).isGreaterThan(100);
    }
}
