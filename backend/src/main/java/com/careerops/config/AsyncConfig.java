package com.careerops.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionHandler;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Dedicated thread pools for different async workloads:
 *  - scraperExecutor  : parallel job scraping (IO-bound, larger pool)
 *  - aiExecutor       : AI scoring / evaluation (CPU+network bound)
 *  - emailExecutor    : email dispatch (low-priority, small pool)
 *  - skillExecutor    : Batch 3 — heavy background skills (MockInterview kit,
 *                        ApplicationPlanner plan generation). Separate from aiExecutor
 *                        so a queue of planner tasks can't starve feed-scoring.
 */
@EnableAsync
@Configuration
public class AsyncConfig {

    private static final Logger log = LoggerFactory.getLogger(AsyncConfig.class);

    // ─── Scraping pool ──────────────────────────────────────
    @Value("${async.scraping.core-pool-size:8}")
    private int scrapingCorePool;
    @Value("${async.scraping.max-pool-size:32}")
    private int scrapingMaxPool;
    @Value("${async.scraping.queue-capacity:500}")
    private int scrapingQueueCapacity;

    // ─── AI pool ────────────────────────────────────────────
    @Value("${async.ai.core-pool-size:4}")
    private int aiCorePool;
    @Value("${async.ai.max-pool-size:16}")
    private int aiMaxPool;
    @Value("${async.ai.queue-capacity:200}")
    private int aiQueueCapacity;

    // ─── Email pool ─────────────────────────────────────────
    @Value("${async.email.core-pool-size:2}")
    private int emailCorePool;
    @Value("${async.email.max-pool-size:8}")
    private int emailMaxPool;
    @Value("${async.email.queue-capacity:100}")
    private int emailQueueCapacity;

    // ─── Skill executor (Batch 3) ────────────────────────────
    // Used by @Async("skillExecutor") in ApplicationPlannerService and MockInterviewService.
    // Sized for long-running Gemini calls: small core (these are rare user-triggered actions),
    // large queue so requests back up gracefully under load rather than being rejected.
    @Value("${async.skill.core-pool-size:4}")
    private int skillCorePool;
    @Value("${async.skill.max-pool-size:12}")
    private int skillMaxPool;
    @Value("${async.skill.queue-capacity:200}")
    private int skillQueueCapacity;

    @Bean(name = "scraperExecutor")
    public Executor scraperExecutor() {
        return buildExecutor("scraper", scrapingCorePool, scrapingMaxPool, scrapingQueueCapacity,
                callerRunsPolicy("scraper"));
    }

    @Bean(name = "aiExecutor")
    public Executor aiExecutor() {
        return buildExecutor("ai", aiCorePool, aiMaxPool, aiQueueCapacity,
                callerRunsPolicy("ai"));
    }

    @Bean(name = "emailExecutor")
    public Executor emailExecutor() {
        return buildExecutor("email", emailCorePool, emailMaxPool, emailQueueCapacity,
                discardOldestPolicy("email"));
    }

    /**
     * Batch 3 — Background executor for heavy skill operations.
     * ApplicationPlannerService.generatePlanAsync() and
     * MockInterviewService.generateInterviewKitAsync() both use this pool.
     */
    @Bean(name = "skillExecutor")
    public Executor skillExecutor() {
        return buildExecutor("skill", skillCorePool, skillMaxPool, skillQueueCapacity,
                callerRunsPolicy("skill"));
    }

    // ─── helpers ────────────────────────────────────────────

    private Executor buildExecutor(String name, int core, int max, int queue,
                                    RejectedExecutionHandler rejection) {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(core);
        exec.setMaxPoolSize(max);
        exec.setQueueCapacity(queue);
        exec.setThreadNamePrefix(name + "-");
        exec.setRejectedExecutionHandler(rejection);
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(30);
        exec.initialize();
        log.info("AsyncConfig: {} pool core={} max={} queue={}", name, core, max, queue);
        return exec;
    }

    private RejectedExecutionHandler callerRunsPolicy(String name) {
        return (r, executor) -> {
            log.warn("[{}] thread pool saturated — running in caller thread", name);
            new ThreadPoolExecutor.CallerRunsPolicy().rejectedExecution(r, executor);
        };
    }

    private RejectedExecutionHandler discardOldestPolicy(String name) {
        return (r, executor) -> {
            log.warn("[{}] thread pool saturated — discarding oldest task", name);
            new ThreadPoolExecutor.DiscardOldestPolicy().rejectedExecution(r, executor);
        };
    }
}
