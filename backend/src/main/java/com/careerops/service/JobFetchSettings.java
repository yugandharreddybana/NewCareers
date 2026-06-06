package com.careerops.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Central job-delivery tuning (daily cap, batch size, scrape age, fixed location).
 * Exposes static accessors for {@link com.careerops.service.sources.JobSource} default fetch.
 */
@Component
public class JobFetchSettings {

    private static JobFetchSettings instance;

    @Value("${jobs.daily.cap:${jobs.max.per.user.per.day:25}}")
    private int dailyCap;

    @Value("${jobs.batch.size:5}")
    private int batchSize;

    @Value("${jobs.max.age.days:14}")
    private int maxAgeDays;

    @Value("${jobs.delivery.location:Ireland}")
    private String deliveryLocation;

    @PostConstruct
    void register() {
        instance = this;
    }

    public int dailyCap() { return dailyCap; }

    public int batchSize() { return batchSize; }

    public int maxAgeDays() { return maxAgeDays; }

    public String deliveryLocation() { return deliveryLocation; }

    public static int staticDailyCap() {
        return instance != null ? instance.dailyCap : 25;
    }

    public static int staticBatchSize() {
        return instance != null ? instance.batchSize : 5;
    }

    public static int staticMaxAgeDays() {
        return instance != null ? instance.maxAgeDays : 14;
    }

    public static String staticDeliveryLocation() {
        return instance != null && instance.deliveryLocation != null && !instance.deliveryLocation.isBlank()
                ? instance.deliveryLocation
                : "Ireland";
    }

    public static String dailyLimitMessage() {
        return "You have reached your daily limit of " + staticDailyCap()
                + " jobs. Come back tomorrow.";
    }
}
