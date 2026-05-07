package com.careerops.util;

import org.springframework.stereotype.Component;
import java.nio.file.Paths;

/**
 * Issue 2.051 — File Sanitisation.
 * Prevents path traversal and other filename-based attacks.
 */
@Component
public class FileUtil {

    /**
     * Sanitizes a filename by removing path traversal characters and
     * ensuring it is just a plain filename.
     */
    public String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "unnamed_file_" + java.util.UUID.randomUUID();
        }

        // Get only the base name (remove path components)
        String baseName = Paths.get(filename).getFileName().toString();

        // Remove potentially dangerous characters
        // Keep only alphanumeric, dots, dashes, and underscores
        String sanitized = baseName.replaceAll("[^a-zA-Z0-9.\\-_]", "_");

        // Prevent hidden files if not allowed, or double extensions used for spoofing
        if (sanitized.startsWith(".")) {
            sanitized = "file" + sanitized;
        }

        return sanitized;
    }
}
