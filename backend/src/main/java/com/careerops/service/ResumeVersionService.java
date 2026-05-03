package com.careerops.service;

import com.careerops.dto.ResumeVersionDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.ResumeVersion;
import com.careerops.repository.ResumeVersionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Batch 3 — Resume Version Service
 *
 * Added:
 *   uploadFile()   : upload PDF/DOCX to Supabase bucket, link path to version
 *   downloadUrl()  : return 10-min signed URL for the attached file
 *   deleteFile()   : remove file from Supabase, clear storagePath (keeps row)
 *   delete()       : now also removes the file from Supabase before deleting row
 */
@Service
public class ResumeVersionService {

    private final ResumeVersionRepository versionRepo;
    private final SupabaseStorageService storage;
    private final String bucket;

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;

    public ResumeVersionService(ResumeVersionRepository versionRepo,
                                SupabaseStorageService storage,
                                @Value("${supabase.bucket.resume}") String bucket) {
        this.versionRepo = versionRepo;
        this.storage = storage;
        this.bucket = bucket;
    }

    public ResumeVersionListResponse list(UUID userId) {
        List<ResumeVersionResponse> items = versionRepo
            .findByUserIdOrderByVersionNumberDesc(userId)
            .stream().map(this::toResponse).toList();
        return new ResumeVersionListResponse(items, items.size());
    }

    public ResumeVersionResponse get(UUID userId, UUID id) {
        return toResponse(find(userId, id));
    }

    @Transactional
    public ResumeVersionResponse create(UUID userId, CreateResumeVersionRequest req) {
        int nextVersion = versionRepo.countByUserId(userId) + 1;
        if (req.isActive()) {
            versionRepo.findByUserIdAndActiveTrue(userId)
                .ifPresent(v -> { v.setActive(false); versionRepo.save(v); });
        }
        ResumeVersion v = ResumeVersion.builder()
            .userId(userId)
            .name(req.name())
            .versionNumber(nextVersion)
            .source(req.source() != null ? req.source() : "manual")
            .roleTags(req.roleTags() != null ? req.roleTags() : new String[]{})
            .active(req.isActive())
            .favorite(req.isFavorite())
            .outcomeAssociation(req.outcomeAssociation())
            .bestForRoleType(req.bestForRoleType())
            .notes(req.notes())
            .build();
        return toResponse(versionRepo.save(v));
    }

    @Transactional
    public ResumeVersionResponse uploadFile(UUID userId, UUID versionId, MultipartFile file)
            throws IOException {
        ResumeVersion v = find(userId, versionId);

        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "Empty file");
        if (file.getSize() > MAX_FILE_SIZE)
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Max 10 MB");

        String name = file.getOriginalFilename() == null ? "resume" : file.getOriginalFilename();
        String lc = name.toLowerCase();
        if (!(lc.endsWith(".pdf") || lc.endsWith(".docx")))
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only PDF or DOCX");

        if (v.getStoragePath() != null && !v.getStoragePath().isBlank()) {
            storage.delete(bucket, v.getStoragePath());
        }

        String path = userId + "/v" + v.getVersionNumber() + "-" +
                      System.currentTimeMillis() + "-" + name.replaceAll("\\s+", "_");
        storage.upsert(bucket, path, file.getBytes(), file.getContentType());

        v.setStoragePath(path);
        v.setFileName(name);
        return toResponse(versionRepo.save(v));
    }

    public Map<String, String> downloadUrl(UUID userId, UUID versionId) {
        ResumeVersion v = find(userId, versionId);
        if (v.getStoragePath() == null || v.getStoragePath().isBlank())
            throw new ApiException(HttpStatus.NOT_FOUND, "No file attached to this version");
        String signed = storage.signedUrl(bucket, v.getStoragePath(), 600);
        return Map.of("url", signed, "fileName", v.getFileName() != null ? v.getFileName() : "resume");
    }

    @Transactional
    public ResumeVersionResponse deleteFile(UUID userId, UUID versionId) {
        ResumeVersion v = find(userId, versionId);
        if (v.getStoragePath() != null && !v.getStoragePath().isBlank()) {
            storage.delete(bucket, v.getStoragePath());
            v.setStoragePath(null);
            v.setFileName(null);
            versionRepo.save(v);
        }
        return toResponse(v);
    }

    @Transactional
    public ResumeVersionResponse update(UUID userId, UUID id, UpdateResumeVersionRequest req) {
        ResumeVersion v = find(userId, id);
        if (req.name()               != null) v.setName(req.name());
        if (req.roleTags()           != null) v.setRoleTags(req.roleTags());
        if (req.isActive()           != null) {
            if (req.isActive()) {
                versionRepo.findByUserIdAndActiveTrue(userId).ifPresent(other -> {
                    if (!other.getId().equals(id)) { other.setActive(false); versionRepo.save(other); }
                });
            }
            v.setActive(req.isActive());
        }
        if (req.isFavorite()         != null) v.setFavorite(req.isFavorite());
        if (req.outcomeAssociation() != null) v.setOutcomeAssociation(req.outcomeAssociation());
        if (req.bestForRoleType()    != null) v.setBestForRoleType(req.bestForRoleType());
        if (req.notes()              != null) v.setNotes(req.notes());
        return toResponse(versionRepo.save(v));
    }

    @Transactional
    public ResumeVersionResponse recordOutcome(UUID userId, UUID id, RecordOutcomeRequest req) {
        ResumeVersion v = find(userId, id);
        v.setOutcomeAssociation(req.outcome());
        switch (req.outcome()) {
            case "interview" -> v.setInterviewCount(v.getInterviewCount() + 1);
            case "offer"     -> v.setOfferCount(v.getOfferCount() + 1);
        }
        v.setApplicationCount(v.getApplicationCount() + 1);
        return toResponse(versionRepo.save(v));
    }

    public CompareResponse compare(UUID userId, UUID leftId, UUID rightId) {
        ResumeVersionResponse left  = toResponse(find(userId, leftId));
        ResumeVersionResponse right = toResponse(find(userId, rightId));
        String rec;
        if (left.offerCount() > right.offerCount()) {
            rec = left.name() + " leads in offers (" + left.offerCount() + " vs " + right.offerCount() + "). Recommend for high-intent applications.";
        } else if (right.offerCount() > left.offerCount()) {
            rec = right.name() + " leads in offers (" + right.offerCount() + " vs " + left.offerCount() + "). Recommend for high-intent applications.";
        } else if (left.interviewCount() >= right.interviewCount()) {
            rec = left.name() + " has equal or more interviews. Use as primary version.";
        } else {
            rec = right.name() + " has more interviews. Consider switching to it as primary.";
        }
        return new CompareResponse(left, right, rec);
    }

    public RecommendResponse recommend(UUID userId, String roleType) {
        List<ResumeVersion> versions = versionRepo.findByUserIdOrderByVersionNumberDesc(userId);
        ResumeVersion best = versions.stream()
            .filter(v -> roleType == null || roleType.isBlank()
                || roleType.equalsIgnoreCase(v.getBestForRoleType()))
            .max(Comparator.comparingInt(v ->
                v.getOfferCount() * 3 + v.getInterviewCount() * 2 + v.getApplicationCount()))
            .orElse(versions.isEmpty() ? null : versions.get(0));
        if (best == null) throw new ApiException(HttpStatus.NOT_FOUND, "No resume versions found");
        String reason = "Version " + best.getVersionNumber() + " (" + best.getName() +
            ") has the strongest outcome track record" +
            (best.getBestForRoleType() != null ? " for " + best.getBestForRoleType() + " roles" : "") + ".";
        return new RecommendResponse(toResponse(best), reason);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        ResumeVersion v = find(userId, id);
        if (v.getStoragePath() != null && !v.getStoragePath().isBlank()) {
            storage.delete(bucket, v.getStoragePath());
        }
        versionRepo.delete(v);
    }

    private ResumeVersion find(UUID userId, UUID id) {
        return versionRepo.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Resume version not found"));
    }

    private ResumeVersionResponse toResponse(ResumeVersion v) {
        return new ResumeVersionResponse(
            v.getId(), v.getName(), v.getVersionNumber(), v.getSource(),
            v.getRoleTags(), v.isActive(), v.isFavorite(),
            v.getOutcomeAssociation(), v.getInterviewCount(),
            v.getApplicationCount(), v.getOfferCount(),
            v.getBestForRoleType(), v.getNotes(),
            v.getCreatedAt(), v.getUpdatedAt()
        );
    }
}
