package com.careerops.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "10m")
public class SchedulingConfig {

    private static final Logger log = LoggerFactory.getLogger(SchedulingConfig.class);

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        ensureShedlockTable(dataSource);
        ensureJobsSourceUrlText(dataSource);
        return new JdbcTemplateLockProvider(
            JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(new JdbcTemplate(dataSource))
                .withTableName("careerops.shedlock") // 3.039 - use schema
                .usingDbTime()
                .build()
        );
    }

    /** Idempotent — local H2 dev disables Flyway, so schedulers need this before first lock. */
    private static void ensureShedlockTable(DataSource dataSource) {
        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement()) {
            st.execute("""
                CREATE TABLE IF NOT EXISTS careerops.shedlock (
                    name VARCHAR(64) NOT NULL,
                    lock_until TIMESTAMP NOT NULL,
                    locked_at TIMESTAMP NOT NULL,
                    locked_by VARCHAR(255) NOT NULL,
                    PRIMARY KEY (name)
                )
                """);
        } catch (SQLException e) {
            log.warn("Could not ensure careerops.shedlock table: {}", e.getMessage());
        }
    }

    /** H2 dev uses ddl-auto=update; widen source_url so long ATS links (SuccessFactors, etc.) persist. */
    private static void ensureJobsSourceUrlText(DataSource dataSource) {
        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement()) {
            st.execute("ALTER TABLE careerops.jobs ALTER COLUMN source_url SET DATA TYPE TEXT");
        } catch (SQLException e) {
            log.debug("jobs.source_url TEXT alignment skipped: {}", e.getMessage());
        }
    }
}

