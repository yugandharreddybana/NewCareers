package com.careerops.service;

import com.careerops.dto.JobDtos.KanbanUpdateRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.ApplicationCv;
import com.careerops.model.Notification;
import com.careerops.model.UserJob;
import com.careerops.repository.ApplicationCvRepository;
import com.careerops.repository.UserJobRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class KanbanService {

    private static final Logger log = LoggerFactory.getLogger(KanbanService.class);

    private static final Set<String> COLUMNS =
        Set.of("Discovered", "Saved", "Applied", "Interview", "Offer", "Rejected");

    @PersistenceContext
    private EntityManager em;

    private final UserJobRepository       userJobs;
    private final ApplicationCvRepository appCvs;
    private final SupabaseStorageService  storage;
    private final ResendEmailService      emailService;
    private final NotificationService     notificationService;
    private final String                  bucket;

    public KanbanService(UserJobRepository u,
                         ApplicationCvRepository a,
                         SupabaseStorageService s,
                         ResendEmailService emailService,
                         NotificationService notificationService,
                         @Value("${supabase.bucket.application.cv}") String bucket) {
        this.userJobs            = u;
        this.appCvs              = a;
        this.storage             = s;
        this.emailService        = emailService;
        this.notificationService = notificationService;
        this.bucket              = bucket;
    }

    // ── Kanban move ─────────────────────────────────────────────────────────

    @Transactional
    public UserJob update(UUID userId, UUID userJobId, KanbanUpdateRequest req) {
        if (req.kanbanColumn() != null && !COLUMNS.contains(req.kanbanColumn()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid column");

        UserJob uj = userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));

        // Capture the column BEFORE updating so we can detect transitions
        String previousColumn = uj.getKanbanColumn();

        if (req.kanbanColumn() != null) uj.setKanbanColumn(req.kanbanColumn());
        if (req.status()       != null) uj.setStatus(req.status());

        UserJob saved = userJobs.save(uj);

        // ─ Section 8 Task 89: fire interview reminder on first move to Interview ─
        // Only fires when the column CHANGES to Interview (not if already there).
        // Wrapped in try/catch so a notification failure never rolls back the save.
        if ("Interview".equals(req.kanbanColumn())
                && !"Interview".equals(previousColumn)) {
            triggerInterviewEvents(userId, userJobId);
        }

        return saved;
    }

    // ── CV attachment ──────────────────────────────────────────────────────

    @Transactional
    public ApplicationCv attachCv(UUID userId, UUID userJobId, MultipartFile file) throws IOException {
        UserJob uj = userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "Empty file");

        String name = file.getOriginalFilename() == null ? "cv" : file.getOriginalFilename();
        String path = userId + "/" + uj.getId() + "/"
                    + System.currentTimeMillis() + "-" + name.replaceAll("\\s+", "_");
        storage.upload(bucket, path, file.getBytes(), file.getContentType());

        return appCvs.save(ApplicationCv.builder()
            .userJobId(uj.getId())
            .storagePath(path)
            .fileName(name)
            .build());
    }

    // ── Interview event trigger ────────────────────────────────────────────

    /**
     * Fires after a card is moved to the Interview column for the first time.
     * Sends a transactional email and creates an in-app notification.
     * Non-fatal: exceptions are caught so the Kanban save is never rolled back.
     */
    private void triggerInterviewEvents(UUID userId, UUID userJobId) {
        try {
            String[] info = fetchJobInfo(userJobId);
            String jobTitle   = info[0];
            String company    = info[1];

            // Transactional email (Task 89)
            emailService.sendInterviewReminderEmail(userId, jobTitle, company);

            // In-app notification (Section 8 — INTERVIEW_REMINDER type)
            notificationService.create(
                userId,
                Notification.TYPE_INTERVIEW_REMINDER,
                "\uD83D\uDCCB Interview stage: " + jobTitle,
                "You\'ve moved " + jobTitle + " at " + company
                    + " to Interview. Time to prep — run Interview Prep skill for tailored Q&As.",
                Map.of(
                    "userJobId",  userJobId.toString(),
                    "jobTitle",   jobTitle,
                    "company",    company
                )
            );

            log.info("Interview reminder fired for userId={} job='{}' company='{}'",
                     userId, jobTitle, company);
        } catch (Exception e) {
            log.warn("triggerInterviewEvents failed (non-fatal): {}", e.getMessage());
        }
    }

    /**
     * Fetches job title and company for a given userJobId.
     * Returns safe fallback strings if the query fails.
     */
    private String[] fetchJobInfo(UUID userJobId) {
        try {
            Object[] row = (Object[]) em.createNativeQuery("""
                    SELECT j.title, j.company
                    FROM   career_operations.jobs j
                    JOIN   career_operations.user_jobs uj ON uj.job_id = j.id
                    WHERE  uj.id = :id
                    """)
                    .setParameter("id", userJobId)
                    .getSingleResult();
            return new String[]{
                row[0] instanceof String t ? t : "this role",
                row[1] instanceof String c ? c : "the company"
            };
        } catch (Exception e) {
            log.warn("fetchJobInfo failed for userJobId={}: {}", userJobId, e.getMessage());
            return new String[]{ "this role", "the company" };
        }
    }
}
