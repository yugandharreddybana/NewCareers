package com.careerops.service;

import com.careerops.model.JobWatchlist;
import com.careerops.repository.JobWatchlistRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class WatchlistScheduler {

    private static final Logger log = LoggerFactory.getLogger(WatchlistScheduler.class);

    private final JobWatchlistRepository watchlistRepo;
    private final WatchlistService       watchlistService;

    public WatchlistScheduler(JobWatchlistRepository watchlistRepo,
                               WatchlistService watchlistService) {
        this.watchlistRepo    = watchlistRepo;
        this.watchlistService = watchlistService;
    }

    // Run all active watchlists every 6 hours
    @Scheduled(cron = "0 0 */6 * * *")
    public void runActiveWatchlists() {
        List<JobWatchlist> active = watchlistRepo.findByStatus("active");
        log.info("WatchlistScheduler: running {} active watchlists", active.size());
        for (JobWatchlist w : active) {
            try {
                watchlistService.runWatchlist(w);
            } catch (Exception e) {
                log.warn("Failed to run watchlist {}: {}", w.getId(), e.getMessage());
            }
        }
    }
}
