package com.careerops.controller;

import com.careerops.dto.JobDtos.KanbanUpdateRequest;
import com.careerops.model.UserJob;
import com.careerops.service.KanbanService;
import com.careerops.util.AuthUtil;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/kanban")
public class KanbanController {

    private final KanbanService kanban;

    public KanbanController(KanbanService k) { this.kanban = k; }

    @PatchMapping("/{userJobId}")
    public Map<String,Object> patch(@PathVariable UUID userJobId, @RequestBody KanbanUpdateRequest req) {
        UserJob uj = kanban.update(AuthUtil.currentUserId(), userJobId, req);
        return Map.of("id", uj.getId(), "kanbanColumn", uj.getKanbanColumn(), "status", uj.getStatus());
    }

    @PostMapping(value = "/{userJobId}/cv", consumes = "multipart/form-data")
    public Map<String,Object> attachCv(@PathVariable UUID userJobId, @RequestParam("file") MultipartFile file) throws Exception {
        var ac = kanban.attachCv(AuthUtil.currentUserId(), userJobId, file);
        return Map.of("id", ac.getId(), "fileName", ac.getFileName(), "uploadedAt", ac.getUploadedAt());
    }
}
