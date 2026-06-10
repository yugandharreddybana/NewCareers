package com.careerops.service.sources;

import com.careerops.model.Job;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JobPostingFingerprintTest {

    @Test
    void canonicalUrl_stripsLinkedInTrackingParams() {
        String a = "https://www.linkedin.com/jobs/view/3856789012?refId=abc&trackingId=xyz";
        String b = "https://www.linkedin.com/jobs/view/senior-engineer-at-acme-3856789012";
        assertThat(JobPostingFingerprint.canonicalPostingUrl(a))
            .isEqualTo(JobPostingFingerprint.canonicalPostingUrl(b));
    }

    @Test
    void fingerprint_matchesAcrossLinkedInUrlVariants() {
        String fp1 = JobPostingFingerprint.fingerprint(
            "Full Stack Developer (Python / React)",
            "RECRUITERS",
            "https://www.linkedin.com/jobs/view/3856789012?refId=abc");
        String fp2 = JobPostingFingerprint.fingerprint(
            "Full Stack Developer (Python / React)",
            "RECRUITERS",
            "https://www.linkedin.com/jobs/view/full-stack-developer-3856789012");
        assertThat(fp1).isEqualTo(fp2);
    }

    @Test
    void samePosting_detectsLinkedInRepostWithDifferentUrl() {
        Job older = Job.builder()
            .title("Full Stack Developer (Python / React)")
            .company("RECRUITERS")
            .sourceUrl("https://www.linkedin.com/jobs/view/3856789012?old=1")
            .fingerprint("legacy-fp")
            .build();
        Job newer = Job.builder()
            .title("Full Stack Developer (Python / React)")
            .company("RECRUITERS")
            .sourceUrl("https://www.linkedin.com/jobs/view/full-stack-developer-3856789012")
            .fingerprint("new-fp")
            .build();
        assertThat(JobPostingFingerprint.samePosting(older, newer)).isTrue();
    }
}
