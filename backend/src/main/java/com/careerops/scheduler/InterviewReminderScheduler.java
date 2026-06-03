package com.careerops.scheduler;

import com.careerops.model.InterviewTrack;
import com.careerops.model.Notification;
import com.careerops.repository.InterviewTrackRepository;
import com.careerops.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class InterviewReminderScheduler {

    private final InterviewTrackRepository trackRepo;
    private final NotificationRepository notificationRepo;

    @Scheduled(cron = "0 0 * * * *", zone = "Europe/Dublin") // every hour
    public void sendInterviewReminders() {
        Instant cutoff = Instant.now().plus(java.time.Duration.ofHours(24));
        List<InterviewTrack> upcoming = trackRepo.findByReminderSentFalseAndInterviewDateBefore(cutoff);

        for (InterviewTrack track : upcoming) {
            Notification n = new Notification();
            n.setId(UUID.randomUUID());
            n.setUserId(track.getUserId());
            n.setType("INTERVIEW_REMINDER");
            n.setTitle("Upcoming Interview!");
            n.setBody("You have an upcoming interview for " + track.getRoleTitle() + " at " + track.getCompanyName() + ".");
            n.setRead(false);
            n.setCreatedAt(Instant.now());
            n.setMetadata(Map.of("entityType", "interview_track", "entityId", track.getId().toString()));
            notificationRepo.save(n);

            track.setReminderSent(true);
            trackRepo.save(track);
            log.info("Upcoming interview reminder notification created for trackId={}", track.getId());
        }
    }
}
