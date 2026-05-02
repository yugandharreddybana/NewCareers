package com.careerops.scheduler;

import com.careerops.model.InterviewTrack;
import com.careerops.model.Notification;
import com.careerops.repository.InterviewTrackRepository;
import com.careerops.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Task 18 — Trigger reminder notifications when interview date is near.
 * Runs every hour and sends in-app notifications for interviews
 * scheduled within the next 24 hours.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InterviewReminderScheduler {

    private final InterviewTrackRepository trackRepo;
    private final NotificationRepository notificationRepo;

    @Scheduled(cron = "0 0 * * * *") // every hour
    public void sendInterviewReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime in24Hours = now.plusHours(24);

        List<InterviewTrack> upcoming = trackRepo.findByInterviewDateBetweenAndReminderSentFalse(
                now, in24Hours
        );

        for (InterviewTrack track : upcoming) {
            try {
                Notification notif = new Notification();
                notif.setId(UUID.randomUUID());
                notif.setUserId(track.getUserId());
                notif.setType("INTERVIEW_REMINDER");
                notif.setTitle("Interview coming up!");
                notif.setMessage("You have an interview scheduled in less than 24 hours. Review your prep kit now.");
                notif.setRead(false);
                notif.setCreatedAt(LocalDateTime.now());
                notif.setEntityType("interview_track");
                notif.setEntityId(track.getId().toString());
                notificationRepo.save(notif);

                track.setReminderSent(true);
                trackRepo.save(track);

                log.info("Interview reminder sent for trackId={} userId={}", track.getId(), track.getUserId());
            } catch (Exception e) {
                log.error("Failed to send reminder for trackId={}: {}", track.getId(), e.getMessage());
            }
        }
    }
}
