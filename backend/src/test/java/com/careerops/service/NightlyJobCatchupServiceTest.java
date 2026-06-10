package com.careerops.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Optional;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NightlyJobCatchupServiceTest {

    @Mock CronJobService cronJobs;
    @Mock ShedlockLastRunProbe shedlock;

    private NightlyJobCatchupService service;

    @BeforeEach
    void setUp() {
        service = new NightlyJobCatchupService(cronJobs, shedlock, null, true);
    }

    @Test
    void runCatchupIfMissed_skipsWhenScoreCronAlreadyRanToday() {
        LocalDate today = LocalDate.now(ShedlockLastRunProbe.DUBLIN);
        when(shedlock.ranOnLocalDate("nightly_job_score", today, ShedlockLastRunProbe.DUBLIN)).thenReturn(true);

        service.runCatchupIfMissed();

        verify(cronJobs, never()).nightlyJobFetch();
        verify(cronJobs, never()).nightlyJobScore();
    }

    @Test
    void runCatchupIfMissed_runsPipelineWhenScoreNotYetRanToday() {
        LocalDate today = LocalDate.now(ShedlockLastRunProbe.DUBLIN);
        when(shedlock.ranOnLocalDate("nightly_job_score", today, ShedlockLastRunProbe.DUBLIN)).thenReturn(false);

        ZonedDateTime morning = ZonedDateTime.of(today, java.time.LocalTime.of(9, 0), ShedlockLastRunProbe.DUBLIN);
        if (morning.toLocalTime().isBefore(java.time.LocalTime.of(6, 0))) {
            return;
        }

        service.runCatchupIfMissed();

        verify(cronJobs).nightlyJobFetch();
        verify(cronJobs).nightlyJobScore();
    }
}
