package com.careerops.service;

import com.careerops.debug.DebugSessionLog;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.service.sources.JobPostingFingerprint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Removes duplicate user_jobs that point at the same real-world posting. */
@Service
public class UserJobDuplicateCleanupService {

    private static final Logger log = LoggerFactory.getLogger(UserJobDuplicateCleanupService.class);

    private final UserJobRepository userJobs;
    private final SkillRunRepository skillRuns;

    public UserJobDuplicateCleanupService(UserJobRepository userJobs, SkillRunRepository skillRuns) {
        this.userJobs = userJobs;
        this.skillRuns = skillRuns;
    }

    @Transactional
    public int pruneSemanticDuplicates(UUID userId) {
        List<UserJob> active = userJobs.findAllActiveWithJobByUserId(userId);
        if (active.size() < 2) {
            return 0;
        }

        Map<String, List<UserJob>> groups = new LinkedHashMap<>();
        for (UserJob uj : active) {
            Job job = uj.getJob();
            if (job == null) {
                continue;
            }
            String key = JobPostingFingerprint.fingerprint(
                    job.getTitle(), job.getCompany(), job.getSourceUrl());
            groups.computeIfAbsent(key, ignored -> new ArrayList<>()).add(uj);
        }

        int removed = 0;
        Instant now = Instant.now();
        for (List<UserJob> group : groups.values()) {
            if (group.size() <= 1) {
                continue;
            }
            UserJob keeper = chooseKeeper(userId, group);
            for (UserJob duplicate : group) {
                if (duplicate.getId().equals(keeper.getId())) {
                    continue;
                }
                duplicate.setDeletedAt(now);
                userJobs.save(duplicate);
                removed++;
                Job job = duplicate.getJob();
                log.info("Soft-deleted duplicate user_job {} (kept {}) for userId={} title={}",
                        duplicate.getId(), keeper.getId(), userId,
                        job != null ? job.getTitle() : "?");
                // #region agent log
                DebugSessionLog.write(
                    "UserJobDuplicateCleanupService.pruneSemanticDuplicates",
                    "duplicate_soft_deleted",
                    "H-DEDUP-CLEANUP",
                    Map.of(
                        "userId", userId.toString(),
                        "removedUserJobId", duplicate.getId().toString(),
                        "keptUserJobId", keeper.getId().toString(),
                        "title", job != null && job.getTitle() != null ? job.getTitle() : "",
                        "company", job != null && job.getCompany() != null ? job.getCompany() : ""));
                // #endregion
            }
        }
        if (removed > 0) {
            log.info("Pruned {} semantic duplicate user_jobs for userId={}", removed, userId);
        }
        return removed;
    }

    private UserJob chooseKeeper(UUID userId, List<UserJob> group) {
        return group.stream()
            .max(Comparator
                .comparing((UserJob uj) -> skillRuns.countByUserIdAndUserJobId(userId, uj.getId()))
                .thenComparing(uj -> uj.getScoreBreakdown() != null ? 1 : 0)
                .thenComparing(UserJob::getMatchPercent, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(UserJob::getDeliveredAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .orElse(group.get(0));
    }
}
