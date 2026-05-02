package com.careerops.controller;

import com.careerops.dto.CareerMemoryDtos.*;
import com.careerops.service.CareerMemoryService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/agent-memory")
public class AgentMemoryController {

    private final CareerMemoryService memoryService;

    public AgentMemoryController(CareerMemoryService memoryService) {
        this.memoryService = memoryService;
    }

    @GetMapping
    public MemoryListResponse list(@RequestParam(required = false) String category) {
        UUID userId = AuthUtil.currentUserId();
        return category != null
            ? memoryService.listByCategory(userId, category)
            : memoryService.list(userId);
    }

    @PostMapping
    public ResponseEntity<MemoryResponse> upsert(@RequestBody UpsertMemoryRequest req) {
        return ResponseEntity.status(HttpStatus.OK)
            .body(memoryService.upsert(AuthUtil.currentUserId(), req));
    }

    @PatchMapping("/{id}/toggle")
    public MemoryResponse toggle(@PathVariable UUID id,
                                 @RequestBody ToggleMemoryRequest req) {
        return memoryService.toggle(AuthUtil.currentUserId(), id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        memoryService.delete(AuthUtil.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }
}
