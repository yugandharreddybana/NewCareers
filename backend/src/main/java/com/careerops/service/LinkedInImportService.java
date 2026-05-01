package com.careerops.service;

import com.careerops.dto.ProfileDtos.ImportSummary;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Section 10 — Task 109
 * LinkedInImportService
 *
 * Accepts a LinkedIn data-export ZIP file and maps its contents to UserProfile.
 *
 * Files parsed:
 *   - Profile.csv       → firstName, lastName, headline, location
 *   - Positions.csv     → positions (count only; mapped to techStack if company present)
 *   - Skills.csv        → skill names → appended/merged into techStack[]
 *
 * Parsing rules:
 *   - UTF-8, comma-delimited
 *   - First row = header; skip rows where required fields are blank
 *   - Existing profile fields are only overwritten if the LinkedIn value is non-blank
 *     AND the existing field is null/empty (non-destructive merge)
 */
@Service
public class LinkedInImportService {

    private static final Logger log = LoggerFactory.getLogger(LinkedInImportService.class);

    private static final String FILE_PROFILE   = "Profile.csv";
    private static final String FILE_POSITIONS = "Positions.csv";
    private static final String FILE_SKILLS    = "Skills.csv";

    private final UserProfileRepository profiles;

    public LinkedInImportService(UserProfileRepository profiles) {
        this.profiles = profiles;
    }

    // ── Public entry-point ───────────────────────────────────────────────

    @Transactional
    public ImportSummary importZip(UUID userId, MultipartFile zipFile) throws IOException {

        // 1. Parse all relevant CSVs from the ZIP
        Map<String, String> csvContents = extractCsvs(zipFile.getInputStream(),
                Set.of(FILE_PROFILE, FILE_POSITIONS, FILE_SKILLS));

        // 2. Parse sections
        ProfileCsv   profileCsv   = parseProfileCsv(csvContents.getOrDefault(FILE_PROFILE, ""));
        List<String> skillNames   = parseSkillsCsv(csvContents.getOrDefault(FILE_SKILLS, ""));
        int          positionCount = parsePositionCount(csvContents.getOrDefault(FILE_POSITIONS, ""));

        // 3. Merge into existing UserProfile (non-destructive)
        UserProfile p = profiles.findByUserId(userId)
                .orElseGet(() -> UserProfile.builder().userId(userId).build());

        boolean updated = false;

        if (profileCsv.location() != null && !profileCsv.location().isBlank()
                && (p.getLocation() == null || p.getLocation().isBlank())) {
            p.setLocation(profileCsv.location());
            updated = true;
        }

        if (!skillNames.isEmpty()) {
            String[] merged = mergeSkills(p.getTechStack(), skillNames);
            p.setTechStack(merged);
            updated = true;
        }

        if (updated) profiles.save(p);

        log.info("LinkedIn import complete for userId={} skills={} positions={} updated={}",
                userId, skillNames.size(), positionCount, updated);

        return new ImportSummary(
                profileCsv.firstName(),
                profileCsv.lastName(),
                profileCsv.headline(),
                profileCsv.location(),
                skillNames.size(),
                positionCount,
                updated
        );
    }

    // ── ZIP extraction ───────────────────────────────────────────────────

    private Map<String, String> extractCsvs(InputStream zipStream, Set<String> targets) throws IOException {
        Map<String, String> result = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(zipStream, StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                String name = new File(entry.getName()).getName(); // strip path prefix
                if (targets.contains(name)) {
                    result.put(name, new String(zis.readAllBytes(), StandardCharsets.UTF_8));
                }
                zis.closeEntry();
                if (result.size() == targets.size()) break; // all found, exit early
            }
        }
        return result;
    }

    // ── CSV parsers ─────────────────────────────────────────────────────

    private ProfileCsv parseProfileCsv(String csv) {
        if (csv.isBlank()) return new ProfileCsv(null, null, null, null);
        String[] lines = csv.split("\n", -1);
        if (lines.length < 2) return new ProfileCsv(null, null, null, null);

        Map<String, Integer> headers = parseHeaders(lines[0]);
        // LinkedIn Profile.csv columns: First Name, Last Name, Headline, Summary, Geo Location
        String[] cols = parseCsvRow(lines[1]);
        return new ProfileCsv(
            getCol(cols, headers, "First Name"),
            getCol(cols, headers, "Last Name"),
            getCol(cols, headers, "Headline"),
            getCol(cols, headers, "Geo Location")
        );
    }

    private List<String> parseSkillsCsv(String csv) {
        if (csv.isBlank()) return List.of();
        String[] lines = csv.split("\n", -1);
        if (lines.length < 2) return List.of();

        Map<String, Integer> headers = parseHeaders(lines[0]);
        // LinkedIn Skills.csv columns: Name
        List<String> skills = new ArrayList<>();
        for (int i = 1; i < lines.length; i++) {
            String[] cols = parseCsvRow(lines[i]);
            String name = getCol(cols, headers, "Name");
            if (name != null && !name.isBlank()) skills.add(name.trim());
        }
        return skills;
    }

    private int parsePositionCount(String csv) {
        if (csv.isBlank()) return 0;
        long count = Arrays.stream(csv.split("\n", -1))
                .skip(1) // skip header
                .filter(l -> !l.isBlank())
                .count();
        return (int) count;
    }

    // ── Skill merge helpers ───────────────────────────────────────────────

    private String[] mergeSkills(String[] existing, List<String> incoming) {
        Set<String> merged = new LinkedHashSet<>();
        if (existing != null) Collections.addAll(merged, existing);
        incoming.forEach(s -> merged.add(s.trim()));
        return merged.toArray(String[]::new);
    }

    // ── CSV parsing utilities ────────────────────────────────────────────

    private static Map<String, Integer> parseHeaders(String headerLine) {
        Map<String, Integer> map = new LinkedHashMap<>();
        String[] cols = parseCsvRow(headerLine);
        for (int i = 0; i < cols.length; i++) map.put(cols[i].trim(), i);
        return map;
    }

    /** Minimal RFC-4180 CSV row parser (handles quoted fields with embedded commas/newlines). */
    private static String[] parseCsvRow(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"'); i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields.add(sb.toString().trim()); sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        fields.add(sb.toString().trim());
        return fields.toArray(String[]::new);
    }

    private static String getCol(String[] cols, Map<String, Integer> headers, String name) {
        Integer idx = headers.get(name);
        if (idx == null || idx >= cols.length) return null;
        String v = cols[idx].trim();
        return v.isEmpty() ? null : v;
    }

    // ── Internal records ──────────────────────────────────────────────────

    private record ProfileCsv(String firstName, String lastName, String headline, String location) {}
}
