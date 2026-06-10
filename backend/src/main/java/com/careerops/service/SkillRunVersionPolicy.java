package com.careerops.service;

import java.util.Set;

/** Skills that keep multiple persisted runs (re-run appends; oldest pruned). */
public final class SkillRunVersionPolicy {

    public static final int MAX_VERSIONS = 3;

    public static final Set<String> VERSIONED_SKILLS = Set.of("cover-letter");

    private SkillRunVersionPolicy() {}

    public static boolean isVersioned(String skill) {
        return skill != null && VERSIONED_SKILLS.contains(skill.trim());
    }

    public static int historyLimit(String skill) {
        return isVersioned(skill) ? MAX_VERSIONS : 12;
    }
}
