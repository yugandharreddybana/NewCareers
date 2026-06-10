package com.careerops.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

/** Reads ShedLock {@code locked_at} to detect whether a named cron already ran on a calendar day. */
@Component
public class ShedlockLastRunProbe {

    static final ZoneId DUBLIN = ZoneId.of("Europe/Dublin");

    private final JdbcTemplate jdbc;

    public ShedlockLastRunProbe(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Instant> lastLockedAt(String lockName) {
        try {
            return jdbc.query(
                    "SELECT locked_at FROM careerops.shedlock WHERE name = ?",
                    rs -> rs.next() ? Optional.of(rs.getTimestamp("locked_at").toInstant()) : Optional.empty(),
                    lockName);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public boolean ranOnLocalDate(String lockName, LocalDate day, ZoneId zone) {
        return lastLockedAt(lockName)
                .map(instant -> instant.atZone(zone).toLocalDate())
                .filter(day::equals)
                .isPresent();
    }
}
