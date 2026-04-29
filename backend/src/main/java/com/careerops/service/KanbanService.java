package com.careerops.service;

import com.careerops.dto.JobDtos.KanbanUpdateRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.ApplicationCv;
import com.careerops.model.UserJob;
import com.careerops.repository.ApplicationCvRepository;
import com.careerops.repository.UserJobRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

@Service
public class KanbanService {

    private static final Set<String> COLUMNS =
        Set.of("Discovered","Saved","Applied","Interview","Offer","Rejected");

    private final UserJobRepository userJobs;
    private final ApplicationCvRepository appCvs;
    private final SupabaseStorageService storage;
    private final String bucket;

    public KanbanService(UserJobRepository u, ApplicationCvRepository a,
                         SupabaseStorageService s,
                         @Value("${supabase.bucket.application.cv}") String bucket) {
        this.userJobs = u; this.appCvs = a; this.storage = s; this.bucket = bucket;
    }

    @Transactional
    public UserJob update(UUID userId, UUID userJobId, KanbanUpdateRequest req) {
        if (req.kanbanColumn() != null && !COLUMNS.contains(req.kanbanColumn()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid column");
        UserJob uj = userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        if (req.kanbanColumn() != null) uj.setKanbanColumn(req.kanbanColumn());
        if (req.status() != null) uj.setStatus(req.status());
        return userJobs.save(uj);
    }

    @Transactional
    public ApplicationCv attachCv(UUID userId, UUID userJobId, MultipartFile file) throws IOException {
        UserJob uj = userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        if (file == null || file.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "Empty file");
        String name = file.getOriginalFilename() == null ? "cv" : file.getOriginalFilename();
        String path = userId + "/" + uj.getId() + "/" + System.currentTimeMillis() + "-" + name.replaceAll("\\s+","_");
        storage.upload(bucket, path, file.getBytes(), file.getContentType());
        return appCvs.save(ApplicationCv.builder()
            .userJobId(uj.getId()).storagePath(path).fileName(name).build());
    }
}
