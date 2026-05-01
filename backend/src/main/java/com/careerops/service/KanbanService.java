package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.ApplicationCv;
import com.careerops.model.UserJob;
import com.careerops.repository.ApplicationCvRepository;
import com.careerops.repository.UserJobRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Task 126 — AuditLogService injected; KANBAN_MOVE and CV_ATTACH events
 * emitted on column changes and CV uploads respectively.
 * All existing business logic is unchanged.
 */
@Service
public class KanbanService {

    private static final Logger log = LoggerFactory.getLogger(KanbanService.class);

    private final UserJobRepository      userJobs;
    private final ApplicationCvRepository appCvs;
    private final SupabaseStorageService  storage;
    private final AuditLogService         audit; // Task 126

    public KanbanService(UserJobRepository userJobs,
                         ApplicationCvRepository appCvs,
                         SupabaseStorageService storage,
                         AuditLogService audit) {
        this.userJobs = userJobs;
        this.appCvs   = appCvs;
        this.storage  = storage;
        this.audit    = audit;
    }

    // ─── List all kanban cards for a user ──────────────────────────────────────

    public List<UserJob> getBoard(UUID userId) {
        return userJobs.findByUserIdOrderByKanbanPositionAsc(userId);
    }

    // ─── Move a card / update status ──────────────────────────────────────────

    @Transactional
    public UserJob patch(UUID userId, String userJobId,
                         String kanbanColumn, String status,
                         HttpServletRequest httpRequest) {
        UserJob uj = userJobs.findByIdAndUserId(UUID.fromString(userJobId), userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job not found on board"));

        String prevColumn = uj.getKanbanColumn();

        if (kanbanColumn != null) uj.setKanbanColumn(kanbanColumn);
        if (status       != null) uj.setStatus(status);
        userJobs.save(uj);

        // Task 126 — audit kanban column moves
        if (kanbanColumn != null && !kanbanColumn.equals(prevColumn)) {
            audit.log(userId, "KANBAN_MOVE", Map.of(
                "userJobId", userJobId,
                "from", prevColumn != null ? prevColumn : "none",
                "to", kanbanColumn
            ));
        }

        return uj;
    }

    /** Overload without HttpServletRequest. */
    @Transactional
    public UserJob patch(UUID userId, String userJobId,
                         String kanbanColumn, String status) {
        return patch(userId, userJobId, kanbanColumn, status, null);
    }

    // ─── Upload application CV to a specific job card ─────────────────────────

    @Transactional
    public ApplicationCv uploadApplicationCv(UUID userId, String userJobId,
                                              MultipartFile file,
                                              HttpServletRequest httpRequest) {
        if (file.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "File is empty");

        UserJob uj = userJobs.findByIdAndUserId(UUID.fromString(userJobId), userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job not found on board"));

        String path = userId + "/" + userJobId + "/" + System.currentTimeMillis()
            + "-" + file.getOriginalFilename();
        String url  = storage.upload("application-cvs", path, file);

        ApplicationCv cv = ApplicationCv.builder()
            .userJobId(uj.getId())
            .fileUrl(url)
            .fileName(file.getOriginalFilename())
            .build();
        appCvs.save(cv);

        // Task 126 — audit CV attach
        audit.log(userId, "CV_ATTACH", Map.of(
            "userJobId", userJobId,
            "fileName", file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown"
        ));

        return cv;
    }

    /** Overload without HttpServletRequest. */
    @Transactional
    public ApplicationCv uploadApplicationCv(UUID userId, String userJobId, MultipartFile file) {
        return uploadApplicationCv(userId, userJobId, file, null);
    }
}
