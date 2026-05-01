package com.careerops.service;

import com.careerops.dto.ProfileDtos.ImportSummary;
import com.careerops.exception.ApiException;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Section 10 — Task 109
 *
 * Accepts a LinkedIn data export ZIP file and parses three CSVs:
 *   - Profile.csv   → first/last name, headline, location
 *   - Positions.csv → job titles mapped to target roles
 *   - Skills.csv    → skill names mapped to tech stack
 *
 * All updates are non-destructive: existing array values are merged,
 * not replaced, so the user does not lose manually entered data.
 */
@Service
public class LinkedInImportService {

    private static final Logger log = LoggerFactory.getLogger(LinkedInImportService.class);

    private static final long MAX_ZIP_BYTES = 20 * 1024 * 1024L; // 20 MB

    private final UserProfileRepository profiles;

    public LinkedInImportService(UserProfileRepository profiles) {
        this.profiles = profiles;
    }

    // ── Public API ───────────────────────────────────────────────────────

    @Transactional
    public ImportSummary importZip(UUID userId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "ZIP file is empty");
        if (file.getSize() > MAX_ZIP_BYTES)
            throw new ApiException(HttpStatus.BAD_REQUEST, "ZIP file exceeds 20 MB limit");

        Map<String, List<Map<String, String>>> parsed = parseZip(file);

        // Extract CSV sections
        List<Map<String, String>> profileRows   = parsed.getOrDefault("Profile",   List.of());
        List<Map<String, String>> positionRows  = parsed.getOrDefault("Positions", List.of());
        List<Map<String, String>> skillRows     = parsed.getOrDefault("Skills",    List.of());

        // ── Parse Profile.csv (first non-header row) ─────────────────────
        String firstName = "", lastName = "", headline = "", linkedInLocation = "";
        if (!profileRows.isEmpty()) {
            Map<String, String> row = profileRows.get(0);
            firstName        = value(row, "First Name");
            lastName         = value(row, "Last Name");
            headline         = value(row, "Headline");
            linkedInLocation = value(row, "Geo Location");
            if (linkedInLocation.isBlank()) linkedInLocation = value(row, "Location");
        }

        // ── Parse Positions.csv → target roles ───────────────────────────
        List<String> importedRoles = new ArrayList<>();
        for (Map<String, String> row : positionRows) {
            String title = value(row, "Title");
            if (!title.isBlank()) importedRoles.add(title);
        }

        // ── Parse Skills.csv → tech stack ────────────────────────────────
        List<String> importedSkills = new ArrayList<>();
        for (Map<String, String> row : skillRows) {
            String name = value(row, "Name");
            if (!name.isBlank()) importedSkills.add(name);
        }

        // ── Merge into UserProfile ────────────────────────────────────────
        UserProfile p = profiles.findByUserId(userId)
                .orElseGet(() -> UserProfile.builder().userId(userId).build());

        boolean techStackUpdated  = false;
        boolean rolesUpdated      = false;
        boolean locationUpdated   = false;

        // Merge tech stack (deduplicated, case-insensitive)
        if (!importedSkills.isEmpty()) {
            p.setTechStack(mergeArrays(p.getTechStack(), importedSkills));
            techStackUpdated = true;
        }

        // Merge target roles (deduplicated)
        if (!importedRoles.isEmpty()) {
            p.setTargetRoles(mergeArrays(p.getTargetRoles(), importedRoles));
            rolesUpdated = true;
        }

        // Set location only if not already set
        if (!linkedInLocation.isBlank() &&
                (p.getLocation() == null || p.getLocation().isBlank())) {
            p.setLocation(linkedInLocation);
            locationUpdated = true;
        }

        profiles.save(p);
        log.info("LinkedIn import complete for userId={} roles={} skills={}",
                userId, importedRoles.size(), importedSkills.size());

        return new ImportSummary(
                firstName, lastName, headline, linkedInLocation,
                importedRoles.size(), importedSkills.size(),
                techStackUpdated, rolesUpdated, locationUpdated
        );
    }

    // ── ZIP parsing ───────────────────────────────────────────────────────

    /**
     * Streams through the ZIP and collects CSV entries whose names match
     * Profile.csv, Positions.csv, or Skills.csv (case-insensitive).
     *
     * Returns a map keyed by base name (without .csv extension).
     */
    private Map<String, List<Map<String, String>>> parseZip(MultipartFile file) throws IOException {
        Map<String, List<Map<String, String>>> result = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(
                file.getInputStream(), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                String name = entry.getName();
                // Strip directory prefix if any
                if (name.contains("/")) name = name.substring(name.lastIndexOf('/') + 1);
                String key = csvKey(name);
                if (key != null) {
                    result.put(key, parseCsv(zis));
                }
                zis.closeEntry();
            }
        }
        return result;
    }

    /** Returns the logical key for known CSVs, or null to skip. */
    private String csvKey(String filename) {
        String lower = filename.toLowerCase(Locale.ROOT);
        if (lower.equals("profile.csv"))   return "Profile";
        if (lower.equals("positions.csv")) return "Positions";
        if (lower.equals("skills.csv"))    return "Skills";
        return null;
    }

    /**
     * Minimal CSV parser: reads the header row then data rows.
     * Handles double-quoted fields with embedded commas.
     */
    private List<Map<String, String>> parseCsv(ZipInputStream zis) throws IOException {
        List<Map<String, String>> rows = new ArrayList<>();
        BufferedReader reader = new BufferedReader(
                new InputStreamReader(zis, StandardCharsets.UTF_8));
        String headerLine = reader.readLine();
        if (headerLine == null) return rows;
        String[] headers = splitCsvLine(headerLine);

        String line;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank()) continue;
            String[] vals = splitCsvLine(line);
            Map<String, String> row = new LinkedHashMap<>();
            for (int i = 0; i < headers.length; i++) {
                row.put(headers[i].trim(), i < vals.length ? vals[i].trim() : "");
            }
            rows.add(row);
        }
        return rows;
    }

    /** Splits a CSV line respecting double-quoted fields. */
    private String[] splitCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder cur   = new StringBuilder();
        boolean inQuotes    = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                // Handle escaped quote ("") inside quoted field
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                result.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        result.add(cur.toString());
        return result.toArray(String[]::new);
    }

    // ── Utilities ─────────────────────────────────────────────────────────

    /** Case-insensitive deduplicated merge of an existing array + new list. */
    private String[] mergeArrays(String[] existing, List<String> incoming) {
        Set<String> seen = new LinkedHashSet<>();
        if (existing != null) Collections.addAll(seen, existing);
        for (String s : incoming) {
            if (!s.isBlank()) {
                // Only add if no case-insensitive duplicate already present
                boolean duplicate = seen.stream()
                        .anyMatch(e -> e.equalsIgnoreCase(s));
                if (!duplicate) seen.add(s);
            }
        }
        return seen.toArray(String[]::new);
    }

    private String value(Map<String, String> row, String key) {
        return row.getOrDefault(key, "").trim();
    }
}
