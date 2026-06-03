package com.careerops.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.Executor;

/**
 * Bounded thread pool for all @Async calls (primarily NvidiaService / GeminiService).
 * Without this Spring falls back to SimpleAsyncTaskExecutor which spawns
 * an unbounded new thread per task — dangerous during the daily cron.
 *
 * Also configures MVC async timeout to 10 minutes to support long-lived SSE connections
 * opened during the onboarding job evaluation pipeline.
 */
@Configuration
public class AsyncConfig implements AsyncConfigurer, WebMvcConfigurer {

    @org.springframework.beans.factory.annotation.Value("${async.core.pool.size:10}")
    private int corePoolSize;

    @org.springframework.beans.factory.annotation.Value("${async.max.pool.size:50}")
    private int maxPoolSize;

    @org.springframework.beans.factory.annotation.Value("${async.queue.capacity:500}")
    private int queueCapacity;

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(corePoolSize);
        exec.setMaxPoolSize(maxPoolSize);
        exec.setQueueCapacity(queueCapacity);
        exec.setThreadNamePrefix("gemini-async-");
        exec.setRejectedExecutionHandler(new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(60);
        exec.initialize();
        return exec;
    }

    /**
     * Set MVC async timeout to 10 minutes.
     * This prevents Spring from closing SSE connections opened during onboarding
     * (which can take several minutes for 100+ job evaluations).
     */
    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setDefaultTimeout(600_000L); // 10 minutes in ms
    }

    @Override
    public org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return new org.springframework.aop.interceptor.SimpleAsyncUncaughtExceptionHandler();
    }
}
