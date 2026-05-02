package com.careerops.scheduler;

import com.careerops.repository.InterviewTrackRepository;
import com.careerops.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class InterviewReminderScheduler {

    private final InterviewTrackRepository trackRepo;
    private final NotificationRepository notificationRepo;

    @Scheduled(cron = "0 0 * * * *") // every hour
    public void sendInterviewReminders() {
        log.info("Interview reminder check skipped - no reminderSent field on InterviewTrack");
    }
}
