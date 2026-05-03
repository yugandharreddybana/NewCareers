package com.careerops.controller;

import com.careerops.dto.WatchlistDtos.*;
import com.careerops.service.WatchlistService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/watchlists")
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
    public ResponseEntity<WatchlistResponse> create(@RequestBody CreateWatchlistRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(watchlistService.create(AuthUtil.currentUserId(), req));
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
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        watchlistService.delete(AuthUtil.currentUserId(), id);
        return ResponseEntity.noContent().build();
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
    public List<String> getSuggestions() {
        return watchlistService.getSuggestions(AuthUtil.currentUserId());
    }
}
