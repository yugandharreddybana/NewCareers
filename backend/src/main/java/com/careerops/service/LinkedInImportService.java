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

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Section 10 Task 109 — LinkedIn Data Export ZIP importer.
 *
 * Accepted files inside the ZIP:
 *   - Profile.csv         → firstName, lastName, headline, location
 *   - Positions.csv       → work history (maps to targetRoles)
 *   - Skills.csv          → skill names (maps to techStack)
 *
 * Only non-null, non-blank mapped values update the profile.
 * Existing values are NOT overwritten unless the import provides a non-blank value.
 */
@Service
public class LinkedInImportService {

    private static final Logger log = LoggerFactory.getLogger(LinkedInImportService.class);

    private static final long   MAX_ZIP_BYTES  = 20L * 1024 * 1024; // 20 MB
    private static final String PROFILE_CSV    = "Profile.csv";
    private static final String POSITIONS_CSV  = "Positions.csv";
    private static final String SKILLS_CSV     = "Skills.csv";

    private final UserProfileRepository profiles;

    public LinkedInImportService(UserProfileRepository profiles) {
        this.profiles = profiles;
    }

    @Transactional
    public ImportSummary importZip(UUID userId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "ZIP file is empty");
        if (file.getSize() > MAX_ZIP_BYTES)
            throw new ApiException(HttpStatus.BAD_REQUEST, "ZIP file exceeds 20 MB limit");

        Map<String, String> csvMap = extractCsvFiles(file);
        if (csvMap.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "No recognised LinkedIn CSV files found in ZIP (Profile.csv, Positions.csv, Skills.csv)");

        // Parse each CSV
        Map<String, String> profileData  = csvMap.containsKey(PROFILE_CSV)
                ? parseProfileCsv(csvMap.get(PROFILE_CSV)) : Map.of();
        List<String>        positions    = csvMap.containsKey(POSITIONS_CSV)
                ? parsePositionsCsv(csvMap.get(POSITIONS_CSV)) : List.of();
        List<String>        skills       = csvMap.containsKey(SKILLS_CSV)
                ? parseSkillsCsv(csvMap.get(SKILLS_CSV)) : List.of();

        // Update profile
        UserProfile p = profiles.findByUserId(userId)
                .orElseGet(() -> UserProfile.builder().userId(userId).build());

        boolean updated = false;

        String firstName = profileData.getOrDefault("firstName", "");
        String lastName  = profileData.getOrDefault("lastName",  "");
        String headline  = profileData.getOrDefault("headline",  "");
        String location  = profileData.getOrDefault("location",  "");

        if (!location.isBlank() && (p.getLocation() == null || p.getLocation().isBlank())) {
            p.setLocation(location);
            updated = true;
        }

        // Map latest positions title → goalTitle if not already set
        if (!positions.isEmpty() && (p.getGoalTitle() == null || p.getGoalTitle().isBlank())) {
            p.setGoalTitle(positions.get(0));
            updated = true;
        }

        // Merge skills into techStack (deduplicated)
        if (!skills.isEmpty()) {
            Set<String> existing = new LinkedHashSet<>();
            if (p.getTechStack() != null) existing.addAll(Arrays.asList(p.getTechStack()));
            int before = existing.size();
            existing.addAll(skills);
            if (existing.size() > before) {
                p.setTechStack(existing.toArray(String[]::new));
                updated = true;
            }
        }

        if (updated) profiles.save(p);

        log.info("LinkedIn import complete for userId={}: positions={} skills={} updated={}",
                 userId, positions.size(), skills.size(), updated);

        return new ImportSummary(
            firstName, lastName, headline, location,
            positions.size(), skills.size(), updated,
            updated
                ? "Profile updated with " + positions.size() + " positions and " + skills.size() + " skills."
                : "No new data to import — profile already up to date."
        );
    }

    // ── ZIP extraction ──────────────────────────────────────────────────────

    private Map<String, String> extractCsvFiles(MultipartFile file) throws IOException {
        Map<String, String> result = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(
                new BufferedInputStream(file.getInputStream()), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                String name = new File(entry.getName()).getName(); // strip directories
                if (PROFILE_CSV.equalsIgnoreCase(name)
                 || POSITIONS_CSV.equalsIgnoreCase(name)
                 || SKILLS_CSV.equalsIgnoreCase(name)) {
                    result.put(name, new String(zis.readAllBytes(), StandardCharsets.UTF_8));
                }
                zis.closeEntry();
            }
        }
        return result;
    }

    // ── CSV parsers ─────────────────────────────────────────────────────────

    /**
     * Profile.csv headers (LinkedIn export):
     * First Name, Last Name, Maiden Name, Address, Birth Date, Headline, Summary, Industry, Zip Code, Geo Location, Twitter Handles, Websites, Instant Messengers
     */
    private Map<String, String> parseProfileCsv(String csv) {
        Map<String, String> result = new HashMap<>();
        try {
            List<String[]> rows = parseCsv(csv);
            if (rows.size() < 2) return result;
            String[] headers = rows.get(0);
            String[] values  = rows.get(1);
            Map<String, String> row = zipHeadersValues(headers, values);
            result.put("firstName", row.getOrDefault("First Name",    "").trim());
            result.put("lastName",  row.getOrDefault("Last Name",     "").trim());
            result.put("headline",  row.getOrDefault("Headline",      "").trim());
            result.put("location",  row.getOrDefault("Geo Location",  "").trim());
        } catch (Exception e) {
            log.warn("Profile.csv parse error: {}", e.getMessage());
        }
        return result;
    }

    /**
     * Positions.csv headers:
     * Company Name, Title, Description, Location, Started On, Finished On
     */
    private List<String> parsePositionsCsv(String csv) {
        List<String> titles = new ArrayList<>();
        try {
            List<String[]> rows = parseCsv(csv);
            if (rows.size() < 2) return titles;
            String[] headers = rows.get(0);
            for (int i = 1; i < rows.size(); i++) {
                Map<String, String> row = zipHeadersValues(headers, rows.get(i));
                String title = row.getOrDefault("Title", "").trim();
                if (!title.isBlank()) titles.add(title);
            }
        } catch (Exception e) {
            log.warn("Positions.csv parse error: {}", e.getMessage());
        }
        return titles;
    }

    /**
     * Skills.csv headers:
     * Name
     */
    private List<String> parseSkillsCsv(String csv) {
        List<String> skills = new ArrayList<>();
        try {
            List<String[]> rows = parseCsv(csv);
            if (rows.size() < 2) return skills;
            String[] headers = rows.get(0);
            for (int i = 1; i < rows.size(); i++) {
                Map<String, String> row = zipHeadersValues(headers, rows.get(i));
                String name = row.getOrDefault("Name", "").trim();
                if (!name.isBlank()) skills.add(name);
            }
        } catch (Exception e) {
            log.warn("Skills.csv parse error: {}", e.getMessage());
        }
        return skills;
    }

    // ── Minimal RFC-4180 CSV parser (handles quoted fields) ─────────────────

    private List<String[]> parseCsv(String content) {
        List<String[]> rows = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new StringReader(content))) {
            String line;
            while ((line = br.readLine()) != null) {
                if (!line.isBlank()) rows.add(splitCsvLine(line));
            }
        } catch (IOException ignored) {}
        return rows;
    }

    private String[] splitCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"'); i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        fields.add(sb.toString().trim());
        return fields.toArray(String[]::new);
    }

    private Map<String, String> zipHeadersValues(String[] headers, String[] values) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < headers.length; i++) {
            map.put(headers[i].trim(), i < values.length ? values[i].trim() : "");
        }
        return map;
    }
}
