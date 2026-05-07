package com.careerops.controller;

import com.careerops.dto.CareerMemoryDtos.*;
import com.careerops.service.CareerMemoryService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/agent-memory")
@io.micrometer.core.annotation.Timed
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
    public MemoryResponse upsert(@RequestBody UpsertMemoryRequest req) {
        return memoryService.upsert(AuthUtil.currentUserId(), req);
    }

    @PatchMapping("/{id}/toggle")
    public MemoryResponse toggle(@PathVariable UUID id,
                                 @RequestBody ToggleMemoryRequest req) {
        return memoryService.toggle(AuthUtil.currentUserId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        memoryService.delete(AuthUtil.currentUserId(), id);
    }

    /** Reset all — deletes every memory entry for the user. */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetAll() {
        memoryService.resetAll(AuthUtil.currentUserId());
    }
}
