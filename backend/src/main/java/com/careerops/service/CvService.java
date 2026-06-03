package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.exception.ApiException;
import com.careerops.model.UserCv;
import com.careerops.repository.UserCvRepository;

import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * CV Service
 *
 * upload()  : upload + parse + store in Supabase bucket
 * history() : list all CVs for a user, newest first
 * delete()  : remove from DB + Supabase bucket; auto-promote next
 * activate(): switch active CV — evicts AI eval cache so stale scores are purged
 * downloadUrl() : 10-min signed URL from Supabase
 * activeCvText() : parsed text of the active CV (used by AI skills)
 *
 * B1-G1 FIX: AiEvalCacheService injected; evictAllForUser() is called
 * in upload(), activate(), and delete() so AI scores are never served
 * stale after a CV change.
 */
@Service
@Slf4j
public class CvService {

    private final UserCvRepository       repo;
    private final SupabaseStorageService  storage;
    private final CvParserService         parser;
    private final VirusScannerService     virusScanner;
    private final com.careerops.util.FileUtil fileUtil;
    private final CvNormalizationService  cvNormalization;
    private final AiEvalCacheService      aiEvalCache;   // B1-G1
    private final String                  bucket;

    private static final long   MAX              = 5L * 1024 * 1024;
    private static final String LOCAL_DEV_PREFIX = "local-dev/";

    public CvService(UserCvRepository repo,
                     SupabaseStorageService storage,
                     CvParserService parser,
                     VirusScannerService virusScanner,
                     com.careerops.util.FileUtil fileUtil,
                     CvNormalizationService cvNormalization,
                     AiEvalCacheService aiEvalCache,
                     @Value("${supabase.bucket.cv}") String bucket) {
        this.repo            = repo;
        this.storage         = storage;
        this.parser          = parser;
        this.virusScanner    = virusScanner;
        this.fileUtil        = fileUtil;
        this.cvNormalization = cvNormalization;
        this.aiEvalCache     = aiEvalCache;
        this.bucket          = bucket;
    }

    @Transactional(timeout = 10)
    public UserCv upload(UUID userId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "Empty file");
        if (file.getSize() > MAX)
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Max 5 MB");

        String name = fileUtil.sanitizeFilename(file.getOriginalFilename());
        String lc   = name.toLowerCase();
        if (!(lc.endsWith(".pdf") || lc.endsWith(".docx")))
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only PDF or DOCX");

        validateMagicBytes(file);

        byte[] fileBytes = file.getBytes();
        virusScanner.scan(fileBytes, name);

        repo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId).ifPresent(c -> {
            c.setIsActive(false);
            repo.save(c);
        });

        String path   = userId + "/" + System.currentTimeMillis() + "-" + name;
        String parsed = parser.extract(new java.io.ByteArrayInputStream(fileBytes), file.getContentType(), name);

        if (storage.isConfigured()) {
            storage.upload(bucket, path, fileBytes, file.getContentType(), userId);
        } else {
            path = LOCAL_DEV_PREFIX + path;
            log.warn("Supabase not configured — stored parsed CV text only (path={}). "
                   + "Set SUPABASE_URL and SUPABASE_SERVICE_KEY for file downloads.", path);
        }

        UserCv cv = UserCv.builder()
                .userId(userId)
                .fileName(name)
                .storagePath(path)
                .fileType(file.getContentType())
                .parsedText(parsed)
                .isActive(true)
                .fileData(storage.isConfigured() ? null : fileBytes)
                .build();
        UserCv saved = repo.save(cv);

        try {
            cvNormalization.normalizeAndStore(userId);
            log.info("CV markdown normalized for userId={} after upload", userId);
        } catch (Exception e) {
            log.warn("CV markdown normalization failed for userId={} (parsed text still available): {}",
                userId, e.getMessage());
        }

        // B1-G1: Evict ALL cached AI scores so the next evaluation
        // uses the new CV content rather than returning stale cached results.
        aiEvalCache.evictAllForUser(userId);
        log.info("AI eval cache evicted for userId={} after CV upload", userId);

        return saved;
    }

    public String activeCvMarkdown(UUID userId) {
        return repo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
            .map(c -> c.getCvMarkdown() != null && !c.getCvMarkdown().isBlank()
                ? c.getCvMarkdown()
                : c.getParsedText())
            .orElse("");
    }

    public List<UserCv> history(UUID userId) {
        return repo.findByUserIdOrderByUploadedAtDesc(userId);
    }

    @Transactional(timeout = 10)
    public void delete(UUID userId, UUID cvId) {
        UserCv cv = repo.findById(cvId)
                .filter(c -> c.getUserId().equals(userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CV not found"));

        String  storagePath = cv.getStoragePath();
        boolean wasActive   = Boolean.TRUE.equals(cv.getIsActive());

        repo.delete(cv);

        if (wasActive) {
            repo.findByUserIdOrderByUploadedAtDesc(userId)
                .stream().findFirst()
                .ifPresent(next -> {
                    next.setIsActive(true);
                    repo.save(next);
                });
            // B1-G1: deleting active CV causes implicit switch — evict stale scores
            aiEvalCache.evictAllForUser(userId);
            log.info("AI eval cache evicted for userId={} after active CV delete", userId);
        }

        if (storagePath != null && !storagePath.isBlank()
                && !isLocalDevPath(storagePath) && storage.isConfigured()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            storage.delete(bucket, storagePath, userId);
                        } catch (Exception e) {
                            log.error("Failed to delete file from Supabase after DB commit: {}", storagePath, e);
                        }
                    }
                });
        }
    }

    public String downloadUrl(UUID userId, UUID cvId) {
        UserCv cv = repo.findById(cvId)
                .filter(c -> c.getUserId().equals(userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CV not found"));
        if (isLocalDevPath(cv.getStoragePath()) || !storage.isConfigured()) {
            return "/api/v1/profile/cv/download/" + cvId + "/content";
        }
        return storage.signedUrl(bucket, cv.getStoragePath(), 600, userId);
    }

    public UserCv requireCv(UUID userId, UUID cvId) {
        return repo.findById(cvId)
                .filter(c -> c.getUserId().equals(userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CV not found"));
    }

    public byte[] downloadContent(UUID userId, UUID cvId) {
        UserCv cv = requireCv(userId, cvId);
        if (cv.getFileData() != null) return cv.getFileData();
        throw new ApiException(HttpStatus.NOT_FOUND, "No local file data available.");
    }

    public String activeCvText(UUID userId) {
        return repo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
                .map(this::cvTextForAi)
                .orElse("");
    }

    public boolean hasActiveCv(UUID userId) {
        return repo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId).isPresent();
    }

    public String cvTextForAi(UserCv cv) {
        if (cv.getCvMarkdown() != null && !cv.getCvMarkdown().isBlank()) return cv.getCvMarkdown();
        return cv.getParsedText() != null ? cv.getParsedText() : "";
    }

    public @Nullable String activeCvDownloadUrl(UUID userId) {
        return repo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
                .map(c -> {
                    if (isLocalDevPath(c.getStoragePath()) || !storage.isConfigured()) {
                        return "/api/v1/profile/cv/download/" + c.getId() + "/content";
                    }
                    return storage.signedUrl(bucket, c.getStoragePath(), 600, userId);
                })
                .orElse(null);
    }

    private static boolean isLocalDevPath(@Nullable String path) {
        return path != null && path.startsWith(LOCAL_DEV_PREFIX);
    }

    /**
     * Switch the active CV.
     * B1-G1: evicts all AI eval cache entries so the next job evaluation
     * re-runs against the newly activated CV rather than serving stale scores.
     */
    @Transactional(timeout = 10)
    public List<UserCv> activate(UUID userId, UUID cvId) {
        List<UserCv> all        = repo.findByUserIdOrderByUploadedAtDesc(userId);
        boolean      anyMatched = false;
        for (UserCv c : all) {
            boolean active = c.getId().equals(cvId);
            if (active) anyMatched = true;
            c.setIsActive(active);
        }
        if (!anyMatched) throw new ApiException(HttpStatus.NOT_FOUND, "CV not found");
        List<UserCv> saved = repo.saveAll(all);

        // B1-G1: stale scores must be evicted after CV switch
        aiEvalCache.evictAllForUser(userId);
        log.info("AI eval cache evicted for userId={} after CV activation", userId);
        return saved;
    }

    public com.careerops.dto.UserCvDTO toDTO(UserCv cv) {
        return com.careerops.dto.UserCvDTO.builder()
                .id(cv.getId())
                .userId(cv.getUserId())
                .fileName(cv.getFileName())
                .fileUrl(isLocalDevPath(cv.getStoragePath()) || !storage.isConfigured()
                        ? null
                        : storage.signedUrl(bucket, cv.getStoragePath(), 600, cv.getUserId()))
                .contentType(cv.getFileType())
                .active(cv.getIsActive())
                .createdAt(cv.getUploadedAt())
                .build();
    }

    private void validateMagicBytes(MultipartFile file) throws IOException {
        String name        = file.getOriginalFilename();
        String contentType = file.getContentType();
        if (name == null || contentType == null)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid file metadata");

        try (java.io.InputStream is = file.getInputStream()) {
            byte[] magic = new byte[4];
            int    read  = is.read(magic);
            if (read < 4) throw new ApiException(HttpStatus.BAD_REQUEST, "File too small or invalid");

            boolean magicPdf = (magic[0] == 0x25 && magic[1] == 0x50 && magic[2] == 0x44 && magic[3] == 0x46);
            boolean magicZip = (magic[0] == 0x50 && magic[1] == 0x4B && magic[2] == 0x03 && magic[3] == 0x04);

            String  ext    = name.substring(name.lastIndexOf(".") + 1).toLowerCase();
            boolean extPdf  = "pdf".equals(ext);
            boolean extDocx = "docx".equals(ext);
            boolean ctPdf   = "application/pdf".equals(contentType);
            boolean ctDocx  = "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(contentType);
            boolean loose   = "application/octet-stream".equals(contentType);

            boolean validPdf  = magicPdf && extPdf  && (ctPdf  || loose);
            boolean validDocx = magicZip && extDocx && (ctDocx || loose);

            if (!validPdf && !validDocx) {
                log.error("File validation failed: magicPdf={} extPdf={} ctPdf={} magicZip={} extDocx={} ctDocx={}",
                        magicPdf, extPdf, ctPdf, magicZip, extDocx, ctDocx);
                throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "Security violation: File content, extension, and type do not match (Expected PDF or DOCX).");
            }
        }
    }
}
