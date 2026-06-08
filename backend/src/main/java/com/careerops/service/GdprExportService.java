package com.careerops.service;

import com.careerops.dto.GdprExportDtos.GdprUserDataExport;
import com.careerops.dto.GdprExportDtos.SubscriptionExport;
import com.careerops.dto.GdprExportDtos.SkillRunExport;
import com.careerops.dto.GdprExportDtos.TokenUsageExport;
import com.careerops.dto.GdprExportDtos.UserCvExport;
import com.careerops.dto.GdprExportDtos.UserExport;
import com.careerops.exception.ResourceNotFoundException;
import com.careerops.model.User;
import com.careerops.repository.AiTokenUsageRepository;
import com.careerops.repository.AuditLogRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserConsentRepository;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Assembles a GDPR portability export for the authenticated user.
 * Never includes {@code passwordHash}, {@code googleSub}, or raw CV {@code fileData}.
 */
@Service
public class GdprExportService {

    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final UserCvRepository cvs;
    private final UserConsentRepository consents;
    private final UserJobRepository userJobs;
    private final AuditLogRepository auditLogs;
    private final SkillRunRepository skillRuns;
    private final AiTokenUsageRepository tokenUsage;
    private final AuditLogService audit;
    private final ObjectMapper objectMapper;
    private final OrgMemberRepository orgMembers;
    private final SubscriptionRepository subscriptions;

    public GdprExportService(
            UserRepository users,
            UserProfileRepository profiles,
            UserCvRepository cvs,
            UserConsentRepository consents,
            UserJobRepository userJobs,
            AuditLogRepository auditLogs,
            SkillRunRepository skillRuns,
            AiTokenUsageRepository tokenUsage,
            AuditLogService audit,
            ObjectMapper objectMapper,
            OrgMemberRepository orgMembers,
            SubscriptionRepository subscriptions) {
        this.users = users;
        this.profiles = profiles;
        this.cvs = cvs;
        this.consents = consents;
        this.userJobs = userJobs;
        this.auditLogs = auditLogs;
        this.skillRuns = skillRuns;
        this.tokenUsage = tokenUsage;
        this.audit = audit;
        this.objectMapper = objectMapper;
        this.orgMembers = orgMembers;
        this.subscriptions = subscriptions;
    }

    @Transactional(readOnly = true)
    public byte[] exportUserDataJson(UUID userId, HttpServletRequest request) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        var cvRows = cvs.findByUserIdOrderByUploadedAtDesc(userId);
        var jobRows = userJobs.findByUserIdOrderByDeliveredAtDesc(userId);
        var auditRows = auditLogs.findByUserIdOrderByCreatedAtDesc(userId);
        var consentRows = consents.findAllByUserIdOrderByAcceptedAtDesc(userId);
        var skillRunRows = skillRuns.findAllByUserIdOrderByCreatedAtDesc(userId);
        var tokenRows = tokenUsage.findByUserIdOrderByCreatedAtDesc(userId);

        var subscriptionRows = orgMembers.findByUserId(userId).stream()
                .map(member -> subscriptions.findByOrganizationId(member.getOrgId()).orElse(null))
                .filter(sub -> sub != null)
                .map(SubscriptionExport::from)
                .distinct()
                .toList();

        GdprUserDataExport payload = new GdprUserDataExport(
                Instant.now(),
                UserExport.from(user),
                profiles.findByUserId(userId).orElse(null),
                cvRows.stream().map(UserCvExport::from).toList(),
                jobRows,
                auditRows,
                consentRows,
                skillRunRows.stream().map(SkillRunExport::from).toList(),
                tokenRows.stream().map(TokenUsageExport::from).toList(),
                subscriptionRows);

        audit.log(userId, "DATA_EXPORT_REQUESTED", request, Map.of(
                "cvCount", cvRows.size(),
                "jobCount", jobRows.size(),
                "auditCount", auditRows.size(),
                "consentCount", consentRows.size(),
                "skillRunCount", skillRunRows.size(),
                "tokenUsageCount", tokenRows.size()));

        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize GDPR export", e);
        }
    }
}
