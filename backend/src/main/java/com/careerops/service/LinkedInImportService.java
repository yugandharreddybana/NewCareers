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
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Section 10 — Task 109
 * Parses a LinkedIn data export ZIP.
 * Reads: Profile.csv, Positions.csv, Skills.csv
 * Maps fields onto UserProfile and returns an ImportSummary.
 */
@Service
public class LinkedInImportService {

    private static final Logger log = LoggerFactory.getLogger(LinkedInImportService.class);

    private final UserProfileRepository profiles;

    public LinkedInImportService(UserProfileRepository profiles) {
        this.profiles = profiles;
    }

    @Transactional
    public ImportSummary importFromZip(UUID userId, MultipartFile file) {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "ZIP file is required");
        if (!isZip(file.getOriginalFilename()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only ZIP files are accepted");

        Map<String, List<String[]>> csvMap = new HashMap<>();

        // ─ Parse ZIP entries ────────────────────────────────────────────────
        try (ZipInputStream zis = new ZipInputStream(file.getInputStream())) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                String name = entry.getName();
                if (name.endsWith("Profile.csv") || name.endsWith("Positions.csv") || name.endsWith("Skills.csv")) {
                    String key = name.contains("/") ? name.substring(name.lastIndexOf('/') + 1) : name;
                    csvMap.put(key, parseCsv(zis));
                }
                zis.closeEntry();
            }
        } catch (Exception e) {
            log.warn("LinkedIn ZIP parse failed: {}", e.getMessage());
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not read ZIP: " + e.getMessage());
        }

        UserProfile p = profiles.findByUserId(userId)
                .orElseGet(() -> UserProfile.builder().userId(userId).build());

        // ─ Profile.csv ──────────────────────────────────────────────────────────
        String firstName = "", lastName = "", headline = "", summary = "";
        boolean locationUpdated = false;
        List<String[]> profileRows = csvMap.getOrDefault("Profile.csv", List.of());
        if (profileRows.size() >= 2) {
            String[] header = profileRows.get(0);
            String[] data   = profileRows.get(1);
            Map<String, String> row = zipHeaderData(header, data);
            firstName = row.getOrDefault("First Name", "");
            lastName  = row.getOrDefault("Last Name",  "");
            headline  = row.getOrDefault("Headline",   "");
            summary   = row.getOrDefault("Summary",    "");
            String geo = row.getOrDefault("Geo Location", row.getOrDefault("Location", ""));
            if (!geo.isBlank()) {
                p.setLocation(geo.trim());
                locationUpdated = true;
            }
            // Map headline to goalTitle if not already set
            if (!headline.isBlank() && (p.getGoalTitle() == null || p.getGoalTitle().isBlank())) {
                p.setGoalTitle(headline.trim());
            }
        }

        // ─ Positions.csv — extract unique job titles as target roles ───────────
        List<String[]> posRows = csvMap.getOrDefault("Positions.csv", List.of());
        int positionsImported = 0;
        if (posRows.size() >= 2) {
            String[] header = posRows.get(0);
            List<String> titles = new ArrayList<>();
            for (int i = 1; i < posRows.size(); i++) {
                Map<String, String> row = zipHeaderData(header, posRows.get(i));
                String title = row.getOrDefault("Title", "").trim();
                if (!title.isBlank() && !titles.contains(title)) {
                    titles.add(title);
                    positionsImported++;
                }
            }
            if (!titles.isEmpty()) {
                // Merge with existing target roles (deduplicate)
                Set<String> merged = new LinkedHashSet<>();
                if (p.getTargetRoles() != null) merged.addAll(Arrays.asList(p.getTargetRoles()));
                merged.addAll(titles.subList(0, Math.min(titles.size(), 5))); // max 5 from LinkedIn
                p.setTargetRoles(merged.toArray(new String[0]));
            }
        }

        // ─ Skills.csv — merge into tech_stack ───────────────────────────────
        List<String[]> skillRows = csvMap.getOrDefault("Skills.csv", List.of());
        int skillsImported = 0;
        if (skillRows.size() >= 2) {
            String[] header = skillRows.get(0);
            Set<String> skillSet = new LinkedHashSet<>();
            if (p.getTechStack() != null) skillSet.addAll(Arrays.asList(p.getTechStack()));
            for (int i = 1; i < skillRows.size(); i++) {
                Map<String, String> row = zipHeaderData(header, skillRows.get(i));
                String skill = row.getOrDefault("Name", "").trim();
                if (!skill.isBlank() && skillSet.add(skill)) skillsImported++;
            }
            p.setTechStack(skillSet.toArray(new String[0]));
        }

        profiles.save(p);

        String message = String.format(
                "Imported %d position(s) and %d skill(s) from your LinkedIn export.",
                positionsImported, skillsImported);

        log.info("LinkedIn import complete for userId={}: positions={} skills={}",
                userId, positionsImported, skillsImported);

        return new ImportSummary(
                firstName, lastName, headline, summary,
                positionsImported, skillsImported, locationUpdated, message);
    }

    // ─ Helpers ───────────────────────────────────────────────────────────────

    private boolean isZip(String filename) {
        return filename != null && filename.toLowerCase().endsWith(".zip");
    }

    /**
     * Reads a CSV from the current ZipInputStream position without closing it.
     * Returns list of String[] rows (including header at index 0).
     */
    private List<String[]> parseCsv(ZipInputStream zis) throws Exception {
        List<String[]> rows = new ArrayList<>();
        BufferedReader reader = new BufferedReader(
                new InputStreamReader(zis, StandardCharsets.UTF_8));
        String line;
        while ((line = reader.readLine()) != null) {
            rows.add(parseCsvLine(line));
        }
        return rows;
    }

    /** Naive RFC-4180 CSV parser: handles quoted fields. */
    private String[] parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuote = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuote && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"'); i++; // escaped quote
                } else {
                    inQuote = !inQuote;
                }
            } else if (c == ',' && !inQuote) {
                fields.add(sb.toString().trim()); sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        fields.add(sb.toString().trim());
        return fields.toArray(new String[0]);
    }

    private Map<String, String> zipHeaderData(String[] header, String[] data) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < header.length; i++) {
            map.put(header[i].trim(), i < data.length ? data[i] : "");
        }
        return map;
    }
}
