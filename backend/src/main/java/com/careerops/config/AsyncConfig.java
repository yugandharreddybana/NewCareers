package com.careerops.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Bounded thread pool for all @Async calls (primarily GeminiService).
 * Without this Spring falls back to SimpleAsyncTaskExecutor which spawns
 * an unbounded new thread per task — dangerous during the daily cron.
 */
@Configuration
public class AsyncConfig implements AsyncConfigurer {

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

    @Override
    public org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return new org.springframework.aop.interceptor.SimpleAsyncUncaughtExceptionHandler();
    }
}

