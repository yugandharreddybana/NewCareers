package com.careerops.dto;

/**
 * Section 7 — Task 66
 * On-demand search parameters DTO.
 * Used by GET /jobs/search, JobRecommendationService, and
 * SearchableJobSource implementations (SerpApiJobSource, IndeedRssSource).
 */
public class SearchParams {

    private String  query;
    private String  location;     // "Dublin", "Cork", "Remote", "All Ireland"
    private Integer minSalary;
    private Integer maxSalary;
    private Boolean sponsorship;  // null = any, true = must offer sponsorship
    private Boolean remote;       // null = any, true = remote only
    private int     page = 0;
    private int     size = 20;

    public SearchParams() {}

    public SearchParams(String query, String location, Integer minSalary, Integer maxSalary,
                        Boolean sponsorship, Boolean remote, int page, int size) {
        this.query       = query;
        this.location    = location;
        this.minSalary   = minSalary;
        this.maxSalary   = maxSalary;
        this.sponsorship = sponsorship;
        this.remote      = remote;
        this.page        = page;
        this.size        = size;
    }

    // ── Getters & Setters ──────────────────────────────────────────────────────

    public String  getQuery()       { return query; }
    public void    setQuery(String v)        { this.query       = v; }
    public String  getLocation()    { return location; }
    public void    setLocation(String v)     { this.location    = v; }
    public Integer getMinSalary()   { return minSalary; }
    public void    setMinSalary(Integer v)   { this.minSalary   = v; }
    public Integer getMaxSalary()   { return maxSalary; }
    public void    setMaxSalary(Integer v)   { this.maxSalary   = v; }
    public Boolean getSponsorship() { return sponsorship; }
    public void    setSponsorship(Boolean v) { this.sponsorship = v; }
    public Boolean getRemote()      { return remote; }
    public void    setRemote(Boolean v)      { this.remote      = v; }
    public int     getPage()        { return page; }
    public void    setPage(int v)            { this.page        = v; }
    public int     getSize()        { return Math.min(size, 50); }
    public void    setSize(int v)            { this.size        = v; }

    /**
     * Builds a human-readable search string for external APIs.
     * e.g. "Full Stack Developer Dublin"
     * Fallback: "software developer Ireland" when params are empty.
     */
    public String toSearchQuery() {
        StringBuilder sb = new StringBuilder();
        if (query    != null && !query.isBlank())    sb.append(query.trim());
        if (location != null && !location.isBlank() && !"All Ireland".equalsIgnoreCase(location)) {
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(location.trim());
        }
        return sb.isEmpty() ? "software developer Ireland" : sb.toString();
    }
}
