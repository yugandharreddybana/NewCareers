---
name: scan
description: "Scan company career pages for job openings that match your profile, with a focus on roles in Ireland or open to Ireland-based candidates. Uses web search with site-scoped queries to find listings on Greenhouse, Lever, Ashby, SmartRecruiters, and other ATS platforms. Use when someone says 'scan for jobs', 'check careers page', 'find openings at', or 'search for roles'."
argument-hint: "<company name, careers URL, industry, or 'all' to scan watchlist>"
user-invocable: true
allowed-tools:
  - Read
  - Write
  - WebSearch
  - Glob
---

# Scan for Job Openings (Irish Market)

Search company career portals for roles that match the user's profile, **prioritising roles based in Ireland or realistically open to candidates located in Ireland**.

Use ATS type and slug detection (see `references/ats-endpoints.md`) to build targeted site-scoped WebSearch queries.


## Response Style

- Keep answers concise and structured.
- Prefer tables and short bullet lists over long paragraphs.
- Do not restate job descriptions in full; summarise titles, locations, and relevance.
- Focus on roles that are viable for Ireland-based candidates; skip clearly incompatible postings.
- Avoid generic job search advice unless the user explicitly asks.


## Step 0: Load Context

1. Read `data/profile.yml` for:
   - target roles and titles
   - core skills and domains
   - preferred locations (with emphasis on Ireland)
   - remote/hybrid preferences
   - seniority level and excluded keywords (if any)
2. Read `config/portals.yml` if it exists (company watchlist and ATS metadata).
3. Read `data/scan-history.md` if it exists (used to avoid re-surfacing seen postings).
4. Read `data/applications.md` to exclude roles already tracked or applied.

If `data/profile.yml` does not exist, tell the user:

> "I need to know your target roles and location preferences first. Let's set that up quickly."

Then collect at minimum:
- current role and years of experience
- target roles/titles
- primary location (e.g., Dublin, Ireland) and remote/hybrid preferences
- top skills and domains

Save this to `data/profile.yml` before continuing.


## Step 1: Determine What to Scan

Parse user input:

- **Company name:**
  - Look up in `config/portals.yml` for ATS type and slug.
  - If not found, use WebSearch to find their careers page and detect ATS type and slug.

- **Careers URL:**
  - Infer ATS type from URL pattern:

  - `boards.greenhouse.io/{slug}`, `job-boards.greenhouse.io/{slug}`, or `{company}.greenhouse.io` → Greenhouse
  - `jobs.lever.co/{slug}` → Lever
  - `jobs.ashbyhq.com/{slug}` or `{company}.ashbyhq.com` → Ashby
  - `jobs.smartrecruiters.com/{slug}` → SmartRecruiters
  - `{tenant}.myworkdayjobs.com`, `wd1.myworkdaysite.com/recruiting/{tenant}`, or equivalent Workday Recruiting URLs → Workday
  - `apply.workable.com/{slug}` or `{company}.workable.com` → Workable
  - `{company}.recruitee.com` or Recruitee-hosted careers pages → Recruitee
  - `jobs.personio.com` or Personio-hosted recruiting pages → Personio
  - `jobs.icims.com`, `careers.icims.com`, or iCIMS-hosted careers pages → iCIMS
  - `jobs.jobvite.com/{slug}` or Jobvite-hosted careers pages → Jobvite
  - `{company}.teamtailor.com` or Teamtailor-hosted careers pages → Teamtailor
  - `rezoomo.com` or Rezoomo-hosted careers pages → Rezoomo

- For the Irish market, prioritise detection of Workday, Greenhouse, Rezoomo, SmartRecruiters, Lever, iCIMS, and Ashby.
- If ATS cannot be identified, fall back to generic site-scoped WebSearch using Ireland-focused queries.
- Prefer results that explicitly mention Ireland, Dublin, Cork, Galway, Limerick, hybrid in Ireland, or remote in Ireland.

- **"all" / "scan my watchlist":**
  - Scan every enabled company in `config/portals.yml`.
  - If `portals.yml` does not exist or is empty, tell the user:
    > "You don't have a company watchlist yet. Tell me some companies you're interested in (especially in Ireland) and I'll set one up."

- **"scan {industry}":**
  - Use WebSearch to find companies hiring in that industry, with emphasis on Ireland and EU-based roles.
  - Then scan their career pages using the same ATS detection logic.

When interpreting user input, prefer Ireland-based companies and Ireland locations when multiple options exist.


## Step 2: Fetch Job Listings

### Tier 1: WebSearch (Primary)

Use WebSearch with targeted site-scoped queries to find job listings.
Use the ATS type and slug identified in Step 1 to build precise queries.

**Search strategy by ATS:**

- **Ashby:**
  - `site:jobs.ashbyhq.com/{slug} {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Ashby Ireland`

- **Lever:**
  - `site:jobs.lever.co/{slug} {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Lever Ireland`

- **Greenhouse:**
  - `site:job-boards.greenhouse.io/{slug} {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Greenhouse Ireland`
  - Note: Greenhouse pages can be poorly indexed; use both site-scoped and generic queries.

- **SmartRecruiters:**
  - `site:jobs.smartrecruiters.com/{slug} {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} SmartRecruiters Ireland`

- **Workday:**
  - `site:{tenant}.myworkdayjobs.com {target role keywords} Ireland`
  - Fallback: `{company name} Workday jobs {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Workday Ireland`

- **Workable:**
  - `site:apply.workable.com/{slug} {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Workable Ireland`

- **Recruitee:**
  - `site:{slug}.recruitee.com {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Recruitee Ireland`

- **Personio:**
  - `site:jobs.personio.com {company name} {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Personio Ireland`

- **iCIMS:**
  - `site:jobs.icims.com {company name} {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} iCIMS Ireland`

- **Jobvite:**
  - `site:jobs.jobvite.com/{slug} {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Jobvite Ireland`

- **Teamtailor:**
  - `site:{slug}.teamtailor.com {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Teamtailor Ireland`

- **Rezoomo:**
  - `site:rezoomo.com {company name} {target role keywords} Ireland`
  - Fallback: `{company name} careers {target role keywords} Rezoomo Ireland`

- **Generic / unknown ATS:**
  - `{company name} careers {target role keywords} Ireland {current year}`
  - `{company name} jobs {target role keywords} Dublin`
  - `{company name} careers site:{company-domain}`

**Build target role keywords** from the profile: combine `primary_role`, `secondary_roles`, and the top 3 skills.  
Example for a marketing director:  
`marketing director OR head of marketing OR VP marketing`

**Parse search results:**  
Each search result typically contains the job title in the link text and the URL to the posting. Extract:
- Job title
- URL  
If the search result snippet includes location or department, extract those as well.

**Run multiple queries if needed:**
- Run at least one query for the primary target role.
- Optionally run one or more queries for secondary roles.
- Deduplicate by URL before filtering and scoring.

**Ireland-specific rules:**
- Prioritise results that explicitly mention Ireland, Dublin, Cork, Galway, Limerick, hybrid in Ireland, or remote with eligibility for Ireland-based candidates.
- For multinational companies, prefer Ireland-based openings over global or US-only listings.

### Tier 2: Manual Fallback

If WebSearch fails to return usable results for a company:

> "I couldn't find listings automatically for {company}. Here's their careers URL if available: {url}. You can browse it and paste any interesting job postings for me to evaluate."


## Step 3: Filter & Match (Irish Market)

For each job listing found, perform a quick relevance and Irish-market viability check.

### 1. Title relevance

- Compare the job title against target roles from `profile.yml`.
- Include roles that match primary or secondary target titles.
- Exclude roles that clearly do not match seniority (e.g., "Intern" when the user is mid/senior, or "VP" when the user is early-career), unless the user has explicitly asked for those levels.
- Exclude roles whose titles match any `exclude_keywords` from the profile.

### 2. Location / eligibility relevance

- Prefer roles with locations in Ireland (e.g., Dublin, Cork, Galway, Limerick, remote in Ireland).
- Include remote roles when the posting explicitly allows candidates based in Ireland or EU.
- Deprioritise or exclude roles that:
  - are on-site in another country with no relocation support
  - explicitly restrict candidates to a non-Irish location without remote options
- If the user’s profile indicates specific location constraints (e.g., "Dublin only"), apply those constraints.

### 3. Quick relevance score (0–10)

Assign a relevance score based on:
- Title match to target roles: 0–4 points
- Skills/keyword overlap with profile: 0–3 points
- Location/remote match for Ireland: 0–2 points
- Seniority alignment: 0–1 point

Document the reasoning briefly when needed.

### 4. Deduplication

- Check URL against `data/scan-history.md` (skip if seen before).
- Check `company + title` against `data/applications.md` (skip if already tracked).


## Step 4: Output

Produce a concise, structured summary of matches.

```
## Scan Results: {Company or Scope} – {date}

Found **{X}** openings, **{Y}** match your profile and Irish-market preferences.

### Matches (by relevance)

| # | Role | Location | Relevance | Link |
|---|---|---|---|---|
| 1 | {title} | {location} | {score}/10 | {URL} |
| 2 | ... | ... | ... | ... |

### Filtered Out ({Z} roles)
- {short summary, e.g. "3 junior roles", "2 require relocation outside Ireland", "1 unrelated department"}
```

Rules:
- Limit the **Matches** table to the top 10 roles by relevance.
- Keep the "Filtered Out" section to a short bullet list – do not dump full titles/links.
- Do not paste full job descriptions; provide only the key metadata needed for triage.


## Step 5: Save & Next Steps

### Pipeline update

Add all matching roles (top {Y}) to `data/pipeline.md` (create if it does not exist):

```markdown
# Job Pipeline

| Date Found | Company | Role | Location | Relevance | URL | Status |
|---|---|---|---|---|---|---|
| {today} | {company} | {title} | {location} | {score}/10 | {url} | New |
```

### Scan history

Log all seen postings (matches + filtered) to `data/scan-history.md`:

```markdown
| Date | Company | Role | Location | URL | Action |
|---|---|---|---|---|---|
| {today} | {company} | {title} | {location} | {url} | Matched / Filtered: {brief reason} |
```

### Suggested next steps

After saving, respond with concise guidance:

> "Found {Y} matching roles."
>
> Suggested next actions:
> - **Evaluate** the top match: say `evaluate #1`.
> - **Tailor** your CV for a specific role: say `tailor my CV for {company}, role #{n}`.
> - **Scan** another company: say `scan {company}`.

Keep this call-to-action short and specific.
