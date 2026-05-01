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

    @Value("${supabase.bucket.application-cv:application-cvs}")
    private String bucket;

    public KanbanService(UserJobRepository userJobs,
                         ApplicationCvRepository appCvs,
                         SupabaseStorageService storage,
                         AuditLogService audit) {
        this.userJobs = userJobs;
        this.appCvs   = appCvs;
        this.storage  = storage;
        this.audit    = audit;
    }

    // ─── Move card / update status ─────────────────────────────────────────────

    @Transactional
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

    @Transactional
    public ApplicationCv attachCv(UUID userId, UUID userJobId, MultipartFile file) {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "File is empty");

        UserJob uj = userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job not found on board"));

        String name = file.getOriginalFilename() == null ? "cv" : file.getOriginalFilename();
        String path = userId + "/" + userJobId + "/" + System.currentTimeMillis()
                      + "-" + name.replaceAll("\\s+", "_");

        try {
            storage.upload(bucket, path, file.getBytes(), file.getContentType());
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
}
