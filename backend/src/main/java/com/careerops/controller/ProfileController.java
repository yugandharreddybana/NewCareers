package com.careerops.controller;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.service.CvService;
import com.careerops.service.ProfileService;
import com.careerops.util.AuthUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final ProfileService profile;
    private final CvService cv;

    public ProfileController(ProfileService p, CvService c) { this.profile = p; this.cv = c; }

    @GetMapping
    public ProfileResponse get() { return profile.get(AuthUtil.currentUserId()); }

    @PutMapping
    public ProfileResponse upsert(@RequestBody ProfileRequest req) {
        return profile.upsert(AuthUtil.currentUserId(), req);
    }

    @PostMapping(value = "/cv", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> uploadCv(@RequestParam("file") MultipartFile file) throws Exception {
        var cvDoc = cv.upload(AuthUtil.currentUserId(), file);
        return ResponseEntity.ok(Map.of(
            "id", cvDoc.getId().toString(),
            "fileName", cvDoc.getFileName(),
            "uploadedAt", cvDoc.getUploadedAt()
        ));
    }

    @GetMapping("/cv/download")
    public Map<String,String> downloadUrl() {
        String url = cv.activeCvDownloadUrl(AuthUtil.currentUserId());
        return Map.of("url", url == null ? "" : url);
    }

    @GetMapping("/stats")
    public StatsResponse stats() { return profile.stats(AuthUtil.currentUserId()); }
}
