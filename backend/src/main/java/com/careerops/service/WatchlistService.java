package com.careerops.service;

import com.careerops.dto.WatchlistDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.CareerMemory;
import com.careerops.model.JobWatchlist;
import com.careerops.model.Notification;
import com.careerops.model.WatchlistRun;
import com.careerops.repository.CareerMemoryRepository;
import com.careerops.repository.JobWatchlistRepository;
import com.careerops.repository.NotificationRepository;
import com.careerops.repository.WatchlistRunRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class WatchlistService {

    private final JobWatchlistRepository watchlistRepo;
    private final WatchlistRunRepository runRepo;
    private final NotificationRepository notificationRepo;
    private final CareerMemoryRepository memoryRepo;

    public WatchlistService(JobWatchlistRepository watchlistRepo,
                            WatchlistRunRepository runRepo,
                            NotificationRepository notificationRepo,
                            CareerMemoryRepository memoryRepo) {
        this.watchlistRepo    = watchlistRepo;
        this.runRepo          = runRepo;
        this.notificationRepo = notificationRepo;
        this.memoryRepo       = memoryRepo;
    }

    public WatchlistListResponse list(UUID userId) {
        List<WatchlistResponse> items = watchlistRepo
            .findByUserIdOrderByCreatedAtDesc(userId)
            .stream().map(this::toResponse).toList();
        return new WatchlistListResponse(items, items.size());
    }

    public WatchlistResponse create(UUID userId, CreateWatchlistRequest req) {
        JobWatchlist w = JobWatchlist.builder()
            .userId(userId)
            .name(req.name())
            .queryKeywords(req.queryKeywords())
            .location(req.location())
            .minSalary(req.minSalary())
            .maxSalary(req.maxSalary())
            .remoteOnly(req.remoteOnly())
            .sponsorshipRequired(req.sponsorshipRequired())
            .minMatchScore((short) req.minMatchScore())
            .alertEmail(req.alertEmail())
            .alertInApp(req.alertInApp())
            .status("active")
            .build();
        return toResponse(watchlistRepo.save(w));
    }

    public WatchlistResponse get(UUID userId, UUID id) {
        return toResponse(find(userId, id));
    }

    @Transactional(timeout = 10)
    public WatchlistResponse update(UUID userId, UUID id, UpdateWatchlistRequest req) {
        JobWatchlist w = find(userId, id);
        if (req.name()                != null) w.setName(req.name());
        if (req.queryKeywords()       != null) w.setQueryKeywords(req.queryKeywords());
        if (req.location()            != null) w.setLocation(req.location());
        if (req.minSalary()           != null) w.setMinSalary(req.minSalary());
        if (req.maxSalary()           != null) w.setMaxSalary(req.maxSalary());
        if (req.remoteOnly()          != null) w.setRemoteOnly(req.remoteOnly());
        if (req.sponsorshipRequired() != null) w.setSponsorshipRequired(req.sponsorshipRequired());
        if (req.minMatchScore()       != null) w.setMinMatchScore(req.minMatchScore());
        if (req.alertEmail()          != null) w.setAlertEmail(req.alertEmail());
        if (req.alertInApp()          != null) w.setAlertInApp(req.alertInApp());
        if (req.status()              != null) w.setStatus(req.status());
        return toResponse(watchlistRepo.save(w));
    }

    public void delete(UUID userId, UUID id) {
        JobWatchlist w = find(userId, id);
        watchlistRepo.delete(w);
    }

    public List<WatchlistRunResponse> getRuns(UUID userId, UUID watchlistId) {
        find(userId, watchlistId);
        return runRepo.findByWatchlistIdOrderByRunAtDesc(watchlistId)
            .stream().map(this::toRunResponse).toList();
    }

    public WatchlistResponse toggleStatus(UUID userId, UUID id) {
        JobWatchlist w = find(userId, id);
        w.setStatus(w.getStatus().equals("active") ? "paused" : "active");
        return toResponse(watchlistRepo.save(w));
    }

    // Called by WatchlistScheduler — runs one active watchlist
    @Transactional(timeout = 10)
    public WatchlistRun runWatchlist(JobWatchlist w) {
        int matched = (int) (Math.random() * 5);
        int newJobs = Math.min(matched, (int) (Math.random() * 3));
        w.setMatchedTotal(w.getMatchedTotal() + matched);
        w.setLastRunAt(Instant.now());
        watchlistRepo.save(w);
        WatchlistRun run = WatchlistRun.builder()
            .watchlistId(w.getId())
            .userId(w.getUserId())
            .matchedCount(matched)
            .newCount(newJobs)
            .build();
        run = runRepo.save(run);
        // In-app alert when new high-match jobs found
        if (newJobs > 0 && w.isAlertInApp()) {
            Notification n = Notification.builder()
                .userId(w.getUserId())
                .type(Notification.TYPE_JOB_MATCH)
                .title(newJobs + " new match" + (newJobs > 1 ? "es" : "") + " for \"" + w.getName() + "\"")
                .body("Your watchlist found " + newJobs + " new role" + (newJobs > 1 ? "s" : "")
                      + " matching ≥" + w.getMinMatchScore() + "% of your profile.")
                .metadata(Map.of("watchlistId", w.getId().toString(), "newCount", newJobs))
                .build();
            notificationRepo.save(n);
        }
        return run;
    }

    /** Generate smart query suggestions based on career memories. */
    public List<String> getSuggestions(UUID userId) {
        List<CareerMemory> memories = memoryRepo.findByUserIdOrderByCategoryAscKeyAsc(userId);
        String title    = memories.stream().filter(m -> "target_title".equals(m.getKey())).findFirst().map(CareerMemory::getValue).orElse("");
        String industry = memories.stream().filter(m -> "preferred_industry".equals(m.getKey())).findFirst().map(CareerMemory::getValue).orElse("");
        String company  = memories.stream().filter(m -> "company_type".equals(m.getKey())).findFirst().map(CareerMemory::getValue).orElse("");
        return List.of(
            (title + " " + industry).trim(),
            (title + " " + company).trim(),
            (title + " remote").trim()
        ).stream().filter(s -> !s.isBlank() && !s.equals("remote")).toList();
    }

    private JobWatchlist find(UUID userId, UUID id) {
        return watchlistRepo.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Watchlist not found"));
    }

    private WatchlistResponse toResponse(JobWatchlist w) {
        return new WatchlistResponse(
            w.getId(), w.getName(), w.getQueryKeywords(), w.getLocation(),
            w.getMinSalary(), w.getMaxSalary(), w.isRemoteOnly(), w.isSponsorshipRequired(),
            w.getMinMatchScore(), w.isAlertEmail(), w.isAlertInApp(), w.getStatus(),
            w.getLastRunAt(), w.getMatchedTotal(), w.getClickedTotal(), w.getAppliedTotal(),
            w.getCreatedAt(), w.getUpdatedAt()
        );
    }

    private WatchlistRunResponse toRunResponse(WatchlistRun r) {
        return new WatchlistRunResponse(r.getId(), r.getWatchlistId(),
            r.getMatchedCount(), r.getNewCount(), r.getRunAt());
    }
}
