package com.careerops.service;

import com.careerops.permit.PermitIngestionFailedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Runs {@code ingest_permit_stats.py} with configured DB env and streams logs at INFO.
 */
@Service
@Slf4j
public class PermitIngestionService {

    private final ApplicationEventPublisher events;
    private final Environment environment;

    @Value("${permit.ingestion.enabled:true}")
    private boolean enabled;

    @Value("${permit.ingestion.python-executable:python3}")
    private String pythonExecutable;

    @Value("${permit.ingestion.script-path:ingest_permit_stats.py}")
    private String scriptPath;

    public PermitIngestionService(ApplicationEventPublisher events, Environment environment) {
        this.events = events;
        this.environment = environment;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public List<String> buildLiveOnlyArgs() {
        return List.of("--live-only", "--rebuild-scores");
    }

    public List<String> buildAnnualArgs(int year) {
        return List.of("--year", String.valueOf(year), "--force", "--rebuild-scores");
    }

    public List<String> buildSeedAllArgs() {
        return List.of("--all", "--rebuild-scores");
    }

    public List<String> buildManualArgs(Integer year, boolean force, boolean rebuildScores) {
        List<String> args = new ArrayList<>();
        if (year != null) {
            args.add("--year");
            args.add(String.valueOf(year));
        } else {
            args.add("--live-only");
        }
        if (force) {
            args.add("--force");
        }
        if (rebuildScores) {
            args.add("--rebuild-scores");
        }
        return List.copyOf(args);
    }

    /**
     * @return process exit code (0 = success)
     */
    public int run(List<String> scriptArgs) {
        if (!enabled) {
            log.warn("Permit ingestion disabled (permit.ingestion.enabled=false); skipping args={}", scriptArgs);
            return 0;
        }

        Path script = resolveScript();
        if (!Files.isRegularFile(script)) {
            log.error("Permit ingest script not found at {}", script.toAbsolutePath());
            publishFailure(-1, scriptArgs, "script not found: " + script);
            return -1;
        }

        String python = resolvePythonExecutable();
        List<String> command = new ArrayList<>();
        command.add(python);
        command.add(script.toAbsolutePath().toString());
        command.addAll(scriptArgs);

        log.info("Starting permit ingestion: {}", command);

        ProcessBuilder pb = new ProcessBuilder(command);
        Path workDir = script.getParent();
        if (workDir != null) {
            pb.directory(workDir.toFile());
        }
        pb.environment().putAll(dbEnvironment());
        pb.redirectErrorStream(false);

        StringBuilder errCapture = new StringBuilder();
        try {
            Process process = pb.start();
            ExecutorService pool = Executors.newFixedThreadPool(2);
            try {
                Future<?> out = pool.submit(() -> streamLines(process.getInputStream(), "stdout", null));
                Future<?> err = pool.submit(() -> streamLines(process.getErrorStream(), "stderr", errCapture));
                out.get();
                err.get();
            } finally {
                pool.shutdown();
            }

            int exit = process.waitFor();
            if (exit != 0) {
                log.error("Permit ingestion failed with exit code {} for args {}", exit, scriptArgs);
                publishFailure(exit, scriptArgs, tail(errCapture));
            } else {
                log.info("Permit ingestion completed successfully for args {}", scriptArgs);
            }
            return exit;
        } catch (Exception e) {
            log.error("Permit ingestion process error for args {}: {}", scriptArgs, e.getMessage(), e);
            publishFailure(-1, scriptArgs, e.getMessage());
            return -1;
        }
    }

    private void streamLines(java.io.InputStream stream, String label, StringBuilder errCapture) {
        try (var reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (errCapture != null) {
                    errCapture.append(line).append('\n');
                    if (errCapture.length() > 16_000) {
                        errCapture.delete(0, errCapture.length() - 12_000);
                    }
                }
                log.info("[permit-ingest:{}] {}", label, line);
            }
        } catch (Exception e) {
            log.warn("Failed reading permit ingest {}: {}", label, e.getMessage());
        }
    }

    private void publishFailure(int exitCode, List<String> args, String stderrTail) {
        events.publishEvent(new PermitIngestionFailedEvent(
                exitCode,
                List.copyOf(args),
                stderrTail == null ? "" : stderrTail,
                Instant.now()));
    }

    private Map<String, String> dbEnvironment() {
        Map<String, String> env = new HashMap<>(pbSafeEnv());
        putIfPresent(env, "DB_HOST", firstNonBlank(
                environment.getProperty("permit.ingestion.db-host"),
                environment.getProperty("DB_HOST")));
        putIfPresent(env, "DB_PORT", firstNonBlank(
                environment.getProperty("permit.ingestion.db-port"),
                environment.getProperty("DB_PORT"),
                "5432"));
        putIfPresent(env, "DB_NAME", firstNonBlank(
                environment.getProperty("permit.ingestion.db-name"),
                environment.getProperty("DB_NAME"),
                environment.getProperty("POSTGRES_DB")));
        putIfPresent(env, "DB_USER", firstNonBlank(
                environment.getProperty("permit.ingestion.db-user"),
                environment.getProperty("DB_USER"),
                environment.getProperty("POSTGRES_USER"),
                environment.getProperty("DATABASE_USERNAME")));
        putIfPresent(env, "DB_PASSWORD", firstNonBlank(
                environment.getProperty("permit.ingestion.db-password"),
                environment.getProperty("DB_PASSWORD"),
                environment.getProperty("POSTGRES_PASSWORD"),
                environment.getProperty("DATABASE_PASSWORD")));
        String cache = environment.getProperty("permit.ingestion.xlsx-cache-dir",
                environment.getProperty("PERMIT_XLSX_CACHE"));
        if (cache != null && !cache.isBlank()) {
            env.put("PERMIT_XLSX_CACHE", cache.trim());
            env.put("TMPDIR", cache.trim());
        }
        return env;
    }

    private static Map<String, String> pbSafeEnv() {
        return new HashMap<>(System.getenv());
    }

    private static void putIfPresent(Map<String, String> env, String key, String value) {
        if (value != null && !value.isBlank()) {
            env.put(key, value.trim());
        }
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }

    private Path resolveScript() {
        Path configured = Path.of(scriptPath);
        if (Files.isRegularFile(configured)) {
            return configured;
        }
        Path fromBackendCwd = Path.of("backend", scriptPath);
        if (Files.isRegularFile(fromBackendCwd)) {
            return fromBackendCwd;
        }
        return configured;
    }

    private String resolvePythonExecutable() {
        if (pythonExecutable != null && !pythonExecutable.isBlank()) {
            return pythonExecutable.trim();
        }
        return isWindows() ? "python" : "python3";
    }

    private static boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase().contains("win");
    }

    private static String tail(StringBuilder sb) {
        if (sb == null || sb.isEmpty()) {
            return "";
        }
        String all = sb.toString();
        int max = 2000;
        if (all.length() <= max) {
            return all;
        }
        return all.substring(all.length() - max);
    }
}
