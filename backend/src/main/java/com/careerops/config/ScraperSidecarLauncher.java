package com.careerops.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Starts the Python Playwright scraper sidecar automatically when the backend runs locally.
 * No separate {@code uvicorn} command is required for {@code mvn spring-boot:run}.
 */
@Component
@Order(0)
@ConditionalOnProperty(name = "scraper.auto-start", havingValue = "true", matchIfMissing = true)
public class ScraperSidecarLauncher implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ScraperSidecarLauncher.class);

    private final WebClient healthClient;

    @Value("${scraper.base-url:http://127.0.0.1:5500}")
    private String baseUrl;

    @Value("${scraper.startup-timeout-seconds:90}")
    private int startupTimeoutSeconds;

    @Value("${scraper.python-command:}")
    private String pythonCommand;

    private Process managedProcess;
    private boolean startedByUs;

    public ScraperSidecarLauncher(WebClient.Builder webClientBuilder) {
        this.healthClient = webClientBuilder.build();
    }

    @Override
    public void run(ApplicationArguments args) {
        Thread starter = new Thread(this::startSidecarIfNeeded, "scraper-sidecar-starter");
        starter.setDaemon(true);
        starter.start();
    }

    private void startSidecarIfNeeded() {
        URI uri = parseBaseUrl(baseUrl);
        if (uri == null) {
            log.warn("Invalid scraper.base-url '{}'; Playwright company fetch disabled", baseUrl);
            return;
        }
        if (!isLocalSidecar(uri)) {
            log.info("Scraper sidecar managed externally at {} (auto-start skipped)", baseUrl);
            return;
        }
        if (isHealthy(uri)) {
            log.info("Scraper sidecar already running at {}", baseUrl);
            return;
        }

        Path scraperDir = resolveScraperDirectory();
        if (scraperDir == null) {
            log.warn("Could not find scraper/ directory; install deps with: "
                + "cd scraper && pip install -r requirements.txt && playwright install chromium");
            return;
        }

        String python = resolvePythonCommand();
        if (python == null) {
            log.warn("Python not found on PATH; install Python 3.11+ and scraper requirements "
                + "(see scraper/README.md). Playwright company fetch disabled.");
            return;
        }

        int port = uri.getPort() > 0 ? uri.getPort() : 5500;
        String host = uri.getHost() == null ? "127.0.0.1" : uri.getHost();

        try {
            ProcessBuilder pb = new ProcessBuilder(
                python, "-m", "uvicorn", "main:app",
                "--host", host,
                "--port", String.valueOf(port)
            );
            pb.directory(scraperDir.toFile());
            pb.redirectErrorStream(true);
            pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
            managedProcess = pb.start();
            startedByUs = true;
            log.info("Starting scraper sidecar from {} on {}:{}", scraperDir, host, port);

            if (!waitForHealthy(uri, startupTimeoutSeconds)) {
                log.warn("Scraper sidecar did not become healthy within {}s; "
                    + "company Playwright fetch may fail until it is running", startupTimeoutSeconds);
            } else {
                log.info("Scraper sidecar ready at {}", baseUrl);
            }
        } catch (Exception e) {
            log.warn("Failed to start scraper sidecar: {}", e.getMessage());
        }
    }

    @PreDestroy
    void shutdown() {
        if (startedByUs && managedProcess != null && managedProcess.isAlive()) {
            log.info("Stopping managed scraper sidecar");
            managedProcess.destroy();
            try {
                if (!managedProcess.waitFor(5, TimeUnit.SECONDS)) {
                    managedProcess.destroyForcibly();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                managedProcess.destroyForcibly();
            }
        }
    }

    private boolean waitForHealthy(URI uri, int timeoutSeconds) {
        long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
        while (System.currentTimeMillis() < deadline) {
            if (isHealthy(uri)) {
                return true;
            }
            try {
                Thread.sleep(1_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return isHealthy(uri);
    }

    private boolean isHealthy(URI uri) {
        try {
            String healthUrl = uri.resolve("/health").toString();
            String body = healthClient.get()
                .uri(healthUrl)
                .retrieve()
                .bodyToMono(String.class)
                .block(Duration.ofSeconds(3));
            return body != null && body.contains("ok");
        } catch (Exception e) {
            return false;
        }
    }

    static boolean isLocalSidecar(URI uri) {
        if (uri == null) {
            return false;
        }
        String host = uri.getHost();
        if (host == null) {
            return false;
        }
        String lower = host.toLowerCase();
        return lower.equals("localhost") || lower.equals("127.0.0.1") || lower.equals("::1");
    }

    static URI parseBaseUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            return URI.create("http://127.0.0.1:5500");
        }
        try {
            return URI.create(raw.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private Path resolveScraperDirectory() {
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        List<Path> candidates = List.of(
            cwd.resolve("scraper"),
            cwd.resolve("../scraper"),
            cwd.getParent() != null ? cwd.getParent().resolve("scraper") : cwd
        );
        for (Path candidate : candidates) {
            Path normalized = candidate.normalize();
            if (Files.isDirectory(normalized) && Files.exists(normalized.resolve("main.py"))) {
                return normalized;
            }
        }
        return null;
    }

    private String resolvePythonCommand() {
        if (pythonCommand != null && !pythonCommand.isBlank()) {
            return pythonCommand.trim();
        }
        List<String> candidates = new ArrayList<>();
        if (isWindows()) {
            candidates.add("py");
            candidates.add("python");
            candidates.add("python3");
        } else {
            candidates.add("python3");
            candidates.add("python");
        }
        for (String cmd : candidates) {
            if (commandExists(cmd)) {
                return cmd;
            }
        }
        return null;
    }

    private static boolean commandExists(String cmd) {
        try {
            ProcessBuilder pb = isWindows()
                ? new ProcessBuilder("where", cmd)
                : new ProcessBuilder("which", cmd);
            Process p = pb.start();
            return p.waitFor(3, TimeUnit.SECONDS) && p.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase().contains("win");
    }
}
