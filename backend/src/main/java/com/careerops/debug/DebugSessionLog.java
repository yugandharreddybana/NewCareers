package com.careerops.debug;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.LinkedHashMap;
import java.util.Map;

/** Session-scoped NDJSON debug log for agent-driven investigations. */
public final class DebugSessionLog {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String SESSION_ID = "8c1a4f";

    private DebugSessionLog() {}

    public static void write(String location, String message, String hypothesisId, Map<String, Object> data) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("sessionId", SESSION_ID);
            payload.put("timestamp", System.currentTimeMillis());
            payload.put("location", location);
            payload.put("message", message);
            payload.put("hypothesisId", hypothesisId);
            payload.put("data", nullSafeData(data));
            String line = MAPPER.writeValueAsString(payload);
            Path logPath = resolveLogPath();
            Files.writeString(logPath, line + System.lineSeparator(),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            Path fallback = Path.of(System.getProperty("user.dir", ".")).toAbsolutePath().normalize()
                    .resolve(".cursor").resolve("debug-8c1a4f.log");
            if (!logPath.equals(fallback) && Files.exists(fallback.getParent())) {
                Files.writeString(fallback, line + System.lineSeparator(),
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            }
        } catch (Exception ignored) {
            // best-effort
        }
    }

    /** Map.of rejects null values; debug payloads often include unset salary fields. */
    private static Map<String, Object> nullSafeData(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return Map.of();
        }
        Map<String, Object> safe = new LinkedHashMap<>(data.size());
        data.forEach((key, value) -> safe.put(key, value != null ? value : ""));
        return safe;
    }

    private static Path resolveLogPath() {
        Path cwd = Path.of(System.getProperty("user.dir", ".")).toAbsolutePath().normalize();
        Path root = "backend".equalsIgnoreCase(String.valueOf(cwd.getFileName())) ? cwd.getParent() : cwd;
        Path cursorLog = root.resolve(".cursor").resolve("debug-8c1a4f.log");
        if (Files.exists(root.resolve(".cursor"))) {
            return cursorLog;
        }
        return root.resolve("debug-8c1a4f.log");
    }
}
