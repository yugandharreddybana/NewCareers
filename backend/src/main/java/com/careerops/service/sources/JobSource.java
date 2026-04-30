package com.careerops.service.sources;

import com.careerops.dto.SearchParams;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import java.util.List;

/**
 * Strategy interface for all job sources.
 *
 * Background sources (IrishJobs, Reed, Adzuna, etc.) implement fetch(UserProfile).
 * Section 7 — Task 66 adds a default search(SearchParams, UserProfile) contract.
 * On-demand sources (SerpApiJobSource, IndeedRssSource) override search().
 * Background-only sources inherit the default empty-list implementation — no changes required.
 */
public interface JobSource {

    /** Display name for logging and UI labels. */
    String name();

    /** Background fetch driven by UserProfile preferences. */
    List<Job> fetch(UserProfile profile);

    /** Whether this source has available quota/API key. Default: true. */
    default boolean hasBudget() { return true; }

    /**
     * Section 7 — Task 66
     * On-demand keyword search with explicit parameters.
     * Background-only sources return empty list (default); no override needed.
     * Override in SerpApiJobSource and IndeedRssSource.
     */
    default List<Job> search(SearchParams params, UserProfile profile) {
        return List.of();
    }
}
