package com.careerops.service;

/**
 * Everything the tip engine knows about a single skill gap.
 * Built from the JD text so any skill — whether or not it is in KNOWN_SKILLS —
 * can receive a meaningful, non-generic coaching tip.
 */
public record CvSkillContext(
    String name,                    // canonical display name (e.g. "Apache Flink")
    CvSkillCategory category,       // broad category used to pick tip shape
    boolean appearsInJobSummary,    // was it in the JD title / first 300 chars?
    boolean likelyRequired,         // appeared >= 2 times in the JD text
    int jdFrequency                 // raw count of occurrences in the JD
) {

    /** Build context by analysing where and how often the skill appears in the JD. */
    public static CvSkillContext from(String skillName, String fullJobText) {
        if (skillName == null || skillName.isBlank()) {
            return new CvSkillContext(skillName, CvSkillCategory.OTHER, false, false, 0);
        }
        String hay   = fullJobText == null ? "" : fullJobText.toLowerCase(java.util.Locale.ROOT);
        String needle = skillName.toLowerCase(java.util.Locale.ROOT);

        // Count occurrences
        int count = 0;
        int idx = 0;
        while ((idx = hay.indexOf(needle, idx)) != -1) { count++; idx += needle.length(); }

        // Does it appear in the first 300 chars (title / summary region)?
        boolean inHeader = hay.length() > 0 && hay.substring(0, Math.min(300, hay.length())).contains(needle);

        return new CvSkillContext(
            prettify(skillName),
            CvSkillCategory.of(skillName),
            inHeader,
            count >= 2,
            count
        );
    }

    private static String prettify(String s) {
        if (s == null || s.isBlank()) return s;
        String[] words = s.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1));
        }
        return sb.toString();
    }
}
