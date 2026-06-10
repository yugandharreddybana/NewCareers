package com.careerops.dto;

import com.careerops.model.Job;
import com.careerops.model.UserJob;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class JobDtosTest {

    @Test
    void jobDetailResponse_from_doesNotThrowWhenSalariesAreNull() {
        UUID jobId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        Job job = Job.builder()
                .id(jobId)
                .fingerprint("fp-null-salary-detail")
                .title("Backend Engineer")
                .company("Acme")
                .description("We are hiring a backend engineer with Java experience in Dublin.")
                .sourceUrl("https://example.com/jobs/1")
                .build();
        UserJob userJob = UserJob.builder()
                .id(userJobId)
                .jobId(jobId)
                .userId(UUID.randomUUID())
                .matchPercent(61)
                .build();

        assertThatCode(() -> JobDtos.JobDetailResponse.from(userJob, job)).doesNotThrowAnyException();

        JobDtos.JobDetailResponse response = JobDtos.JobDetailResponse.from(userJob, job);
        assertThat(response.salaryMin()).isNull();
        assertThat(response.salaryMax()).isNull();
        assertThat(response.userJobId()).isEqualTo(userJobId);
        assertThat(response.jobId()).isEqualTo(jobId);
    }
}
