package com.careerops.service;

import com.careerops.repository.ApplicationRunRepository;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserCvRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

@Service
public class OrgUsageCounter {

    private final SkillRunRepository skillRunRepo;
    private final ApplicationRunRepository applicationRunRepo;
    private final UserCvRepository userCvRepo;
    private final OrgMemberRepository orgMemberRepo;

    public OrgUsageCounter(
            SkillRunRepository skillRunRepo,
            ApplicationRunRepository applicationRunRepo,
            UserCvRepository userCvRepo,
            OrgMemberRepository orgMemberRepo) {
        this.skillRunRepo = skillRunRepo;
        this.applicationRunRepo = applicationRunRepo;
        this.userCvRepo = userCvRepo;
        this.orgMemberRepo = orgMemberRepo;
    }

    public long aiSkillRunsThisMonth(UUID orgId) {
        return skillRunRepo.countByOrgIdAndCreatedAtAfter(orgId, monthStart());
    }

    public long jobApplicationsThisMonth(UUID orgId) {
        return applicationRunRepo.countByOrgIdAndCreatedAtAfter(orgId, monthStart());
    }

    public long cvUploadsTotal(UUID orgId) {
        return userCvRepo.countByOrgId(orgId);
    }

    public int teamMembers(UUID orgId) {
        return orgMemberRepo.countByOrgId(orgId);
    }

    static Instant monthStart() {
        ZonedDateTime now = ZonedDateTime.now(UsageLimitService.QUOTA_ZONE);
        return now.toLocalDate().withDayOfMonth(1)
                .atStartOfDay(UsageLimitService.QUOTA_ZONE)
                .toInstant();
    }
}
