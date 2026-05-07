package com.careerops.controller;

import com.careerops.dto.WatchlistDtos.*;
import com.careerops.service.WatchlistService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/watchlists")
@io.micrometer.core.annotation.Timed
public class WatchlistController {

    private final WatchlistService watchlistService;

    public WatchlistController(WatchlistService watchlistService) {
        this.watchlistService = watchlistService;
    }

    @GetMapping
    public WatchlistListResponse list() {
        return watchlistService.list(AuthUtil.currentUserId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WatchlistResponse create(@RequestBody CreateWatchlistRequest req) {
        return watchlistService.create(AuthUtil.currentUserId(), req);
    }

    @GetMapping("/{id}")
    public WatchlistResponse get(@PathVariable UUID id) {
        return watchlistService.get(AuthUtil.currentUserId(), id);
    }

    @PutMapping("/{id}")
    public WatchlistResponse update(@PathVariable UUID id,
                                    @RequestBody UpdateWatchlistRequest req) {
        return watchlistService.update(AuthUtil.currentUserId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        watchlistService.delete(AuthUtil.currentUserId(), id);
    }

    @PostMapping("/{id}/toggle")
    public WatchlistResponse toggleStatus(@PathVariable UUID id) {
        return watchlistService.toggleStatus(AuthUtil.currentUserId(), id);
    }

    @GetMapping("/{id}/runs")
    public List<WatchlistRunResponse> getRuns(@PathVariable UUID id) {
        return watchlistService.getRuns(AuthUtil.currentUserId(), id);
    }

    @GetMapping("/suggestions")
    public List<String> getSuggestions(jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader(org.springframework.http.HttpHeaders.CACHE_CONTROL, "private, max-age=60");
        return watchlistService.getSuggestions(AuthUtil.currentUserId());
    }
}
