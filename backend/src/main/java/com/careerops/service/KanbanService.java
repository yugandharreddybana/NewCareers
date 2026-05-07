package com.careerops.service;

import com.careerops.dto.JobDtos.KanbanUpdateRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.ApplicationCv;
import com.careerops.model.UserJob;
import com.careerops.repository.ApplicationCvRepository;
import com.careerops.repository.UserJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Task 126 (Section 11 fix) — AuditLogService injected.
 * KANBAN_MOVE emitted when kanbanColumn changes.
 * CV_ATTACH emitted when an application CV is uploaded.
 *
 * Section 10 method signatures preserved exactly:
 *   update(UUID userId, UUID userJobId, KanbanUpdateRequest req)  → UserJob
 *   attachCv(UUID userId, UUID userJobId, MultipartFile file)     → ApplicationCv
 */
@Service
public class KanbanService {

    private static final Logger log = LoggerFactory.getLogger(KanbanService.class);

    private final UserJobRepository       userJobs;
    private final ApplicationCvRepository appCvs;
    private final SupabaseStorageService  storage;
    private final AuditLogService         audit; // Task 126
    private final com.careerops.util.FileUtil fileUtil;

    @Value("${supabase.bucket.application-cv:application-cvs}")
    private String bucket;

    public KanbanService(UserJobRepository userJobs,
                         ApplicationCvRepository appCvs,
                         SupabaseStorageService storage,
                         AuditLogService audit,
                         com.careerops.util.FileUtil fileUtil) {
        this.userJobs = userJobs;
        this.appCvs   = appCvs;
        this.storage  = storage;
        this.audit    = audit;
        this.fileUtil = fileUtil;
    }

    // ─── Move card / update status ─────────────────────────────────────────────

    @Transactional(timeout = 10)
    public UserJob update(UUID userId, UUID userJobId, KanbanUpdateRequest req) {
        UserJob uj = userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job not found on board"));

        String prevColumn = uj.getKanbanColumn();

        if (req.kanbanColumn() != null) uj.setKanbanColumn(req.kanbanColumn());
        if (req.status()       != null) uj.setStatus(req.status());
        userJobs.save(uj);

        // Task 126 — audit kanban column moves
        if (req.kanbanColumn() != null && !req.kanbanColumn().equals(prevColumn)) {
            audit.log(userId, "KANBAN_MOVE", Map.of(
                "userJobId", userJobId.toString(),
                "from", prevColumn != null ? prevColumn : "none",
                "to", req.kanbanColumn()
            ));
        }

        return uj;
    }

    // ─── Attach application CV to a job card ──────────────────────────────────

    @Transactional(timeout = 10)
    public ApplicationCv attachCv(UUID userId, UUID userJobId, MultipartFile file) {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "File is empty");

        UserJob uj = userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job not found on board"));

        String name = fileUtil.sanitizeFilename(file.getOriginalFilename());
        String path = userId + "/" + userJobId + "/" + System.currentTimeMillis()
                      + "-" + name;

        try {
            storage.uploadStream(bucket, path, file.getResource(), file.getContentType(), userId);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                "CV upload failed: " + e.getMessage());
        }

        ApplicationCv cv = ApplicationCv.builder()
            .userJobId(uj.getId())
            .storagePath(path)
            .fileName(name)
            .build();
        appCvs.save(cv);

        // Task 126 — audit CV attach
        audit.log(userId, "CV_ATTACH", Map.of(
            "userJobId", userJobId.toString(),
            "fileName", name
        ));

        return cv;
    }

    @Transactional(timeout = 10, readOnly = true)
    public com.careerops.dto.JobDtos.KanbanStatsResponse getStats(UUID userId) {
        Map<String, Long> byColumn = new java.util.HashMap<>();
        for (Object[] row : userJobs.countByColumnForUser(userId)) {
            byColumn.put((String) row[0], (Long) row[1]);
        }
        long total      = byColumn.values().stream().mapToLong(Long::longValue).sum();
        long applied    = byColumn.getOrDefault("Applied",   0L);
        long interviews = byColumn.getOrDefault("Interview", 0L);
        long offers     = byColumn.getOrDefault("Offer",     0L);
        double avgMatch = userJobs.avgMatchPercentForUser(userId);

        return new com.careerops.dto.JobDtos.KanbanStatsResponse(
            total,
            applied,
            interviews,
            offers,
            Math.round(avgMatch * 10.0) / 10.0
        );
    }

    @Transactional(timeout = 10, readOnly = true)
    public Map<String, Long> getColumnCounts(UUID userId) {
        Map<String, Long> counts = new java.util.HashMap<>();
        for (Object[] row : userJobs.countByColumnForUser(userId)) {
            counts.put((String) row[0], (Long) row[1]);
        }
        return counts;
    }
}
