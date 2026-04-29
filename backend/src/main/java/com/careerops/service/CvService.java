package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.UserCv;
import com.careerops.repository.UserCvRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Service
public class CvService {

    private final UserCvRepository repo;
    private final SupabaseStorageService storage;
    private final CvParserService parser;
    private final String bucket;

    public CvService(UserCvRepository repo, SupabaseStorageService storage, CvParserService parser,
                     @Value("${supabase.bucket.cv}") String bucket) {
        this.repo = repo; this.storage = storage; this.parser = parser; this.bucket = bucket;
    }

    private static final long MAX = 5L * 1024 * 1024;

    @Transactional
    public UserCv upload(UUID userId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "Empty file");
        if (file.getSize() > MAX) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Max 5MB");
        String name = file.getOriginalFilename() == null ? "cv" : file.getOriginalFilename();
        String lc = name.toLowerCase();
        if (!(lc.endsWith(".pdf") || lc.endsWith(".docx")))
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only PDF or DOCX");

        repo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId).ifPresent(c -> {
            c.setIsActive(false); repo.save(c);
        });

        String path = userId + "/" + System.currentTimeMillis() + "-" + name.replaceAll("\\s+", "_");
        storage.upload(bucket, path, file.getBytes(), file.getContentType());
        String parsed = parser.extract(file.getBytes(), file.getContentType(), name);

        UserCv cv = UserCv.builder()
            .userId(userId).fileName(name).storagePath(path)
            .fileType(file.getContentType()).parsedText(parsed)
            .isActive(true).build();
        return repo.save(cv);
    }

    public String activeCvText(UUID userId) {
        return repo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
            .map(UserCv::getParsedText).orElse("");
    }

    public String activeCvDownloadUrl(UUID userId) {
        return repo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
            .map(c -> storage.signedUrl(bucket, c.getStoragePath(), 600)).orElse(null);
    }
}
