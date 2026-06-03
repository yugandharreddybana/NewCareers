---
name: tailor-resume
description: Generate an ATS-optimized, Ireland-market CV tailored to a specific evaluated job posting. Produces a clean single-column HTML CV designed for browser preview and PDF export. Use when the user wants to tailor, create, update, or regenerate a CV for a specific role or the latest evaluation.
argument-hint: "<company name | role name | latest evaluation>"
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Glob
---

# Tailor CV

Generate a job-specific, ATS-optimized CV from structured profile data and an existing job evaluation.

This skill is for the **Irish market by default**. It produces a clean HTML CV that can be printed to PDF and must remain ATS-safe, truthful, and tightly aligned to the target job description.

Read `references/ats-rules.md` and `references/resume-template.html` before generating output.

## Skill Scope

Use this skill when:
- The user asks to tailor a CV/resume to a job posting.
- The user asks to update their CV for a specific company or role.
- The user wants a fresh CV generated from their profile and an existing evaluation.
- The user says things like:
  - “tailor my resume”
  - “update my CV for Stripe”
  - “create a resume for the latest evaluation”
  - “make my CV ATS friendly for this role”

Do not use this skill when:
- No target job posting or evaluation exists.
- The user only wants keyword extraction, not CV generation.
- The user wants a cover letter only.
- The user wants LinkedIn-only optimization.
- The user wants a graphic/designed resume that may sacrifice ATS readability.

## Core Principles

- Optimize for **ATS readability and recruiter clarity**, not visual novelty.
- Tailor aggressively, but never fabricate experience, tools, achievements, certifications, or metrics.
- Use exact job-description language where supported by evidence.
- Build the CV for the **specific role**, not as a generic master resume.
- Prefer single-column, standard-heading, parse-safe structure over decorative design.
- Treat the HTML as the canonical CV output; PDF is a print export of that HTML.

## Step 0: Load Context

1. Read `data/profile.yml` for structured candidate data.
2. Read `data/resume.md` if it exists for richer wording, extra detail, and legacy bullet content.
3. Identify the target evaluation from `data/evaluations/`:
   - If the user specifies a company or role, find the best matching evaluation.
   - If the user says “latest” or gives no argument, use the most recent evaluation file.
   - If multiple evaluations plausibly match, stop and ask the user to choose.
4. Read the target evaluation fully, including:
   - Job description / posting text
   - keyword analysis
   - fit analysis
   - Block E: Tailoring Plan
5. If no usable evaluation exists, stop and tell the user:
   > I need the job evaluated first so I know what to emphasize. Paste the job posting and I’ll assess it before generating the CV.

## Step 1: Extract ATS Target Signals

From the evaluation + JD, extract **15–20 high-signal ATS keywords and filters**. Build a ranked internal list before writing any CV content.

### Include

- Exact phrases from **Required / Minimum / Must-Have Qualifications**
- Exact target title and seniority language
- Repeated hard skills across title, summary, requirements, and responsibilities
- Tools, platforms, frameworks, and ecosystems explicitly named in the JD
- Certifications, licenses, and credentials named in the JD
- Methodologies and operating models explicitly named in the JD
- Action-verb responsibility phrases that define scope and level
- Experience thresholds and domain requirements
- Preferred / nice-to-have items as lower-priority terms
- Location, work authorization, and work mode when explicitly stated
- Acronym + expanded form where both appear

### Prioritization

Build a three-tier list:

- **Tier 1**: title terms, top Required bullets, repeated hard skills, required certs, core tools
- **Tier 2**: major responsibility terms, realistic preferred skills, domain keywords, key methodologies
- **Tier 3**: bonus tools and nice-to-haves mentioned once

### Exclude or de-prioritize

- Generic soft skills unless strongly emphasized or role-critical
- Company culture slogans
- Vague adjectives with no screening value
- Keywords unsupported by candidate evidence

### Internal validation

Before writing the CV:
- Ensure all critical Required Qualifications the candidate genuinely meets are represented in the target keyword set.
- Ensure the final keyword list is role-specific rather than generic.
- Prefer exact JD phrasing over synonyms for critical terms.

## Step 2: Detect Language & Irish Locale

This skill defaults to the **Irish market**.

### Locale rules

- Assume the role targets Ireland unless the JD explicitly says otherwise.
- Use **A4** conventions for Irish-market applications.
- Use **CV** terminology, not “resume”, in user-facing outputs where appropriate.
- CV language must match the job description language exactly.
- Default to English unless the JD is primarily in Irish or another language.
- If the JD is multilingual, use the dominant hiring language from the qualifications, responsibilities, and application instructions.
- Do not switch to US conventions solely because the employer is US-headquartered.
- Use Irish-market expectations: reverse chronological structure, clean ATS-safe formatting, concise length.
- Use Irish/EU eligibility and location language when supported by profile data or explicitly relevant to the role.

### ATS-safe formatting defaults

- Single-column only
- Standard section headings only
- No tables
- No columns
- No text boxes
- No icons, graphics, or images
- No headers/footers in printable content
- No decorative elements that may interfere with parsing

## Step 3: Build CV Content

Using the evaluation’s **Block E (Tailoring Plan)** as the governing edit plan, rebuild each CV section from profile data.

Every major edit must map back to a real JD requirement, keyword, tool, credential, or responsibility signal.

### Global CV construction rules

- Build the CV in this order:
  1. Contact Information
  2. Professional Summary
  3. Skills
  4. Experience
  5. Education
  6. Certifications
  7. Projects
- Omit empty sections rather than rendering placeholders.
- Use only information supported by `profile.yml`, `resume.md`, and the evaluation.
- Tailor section emphasis to the target role.
- Keep the top third of the CV focused on the strongest JD match signals.
- Use exact JD terminology where truthful and defensible.
- Keywords must appear naturally in evidence-based content, not as stuffing.
- Final CV target length: typically 1–2 A4 pages for the Irish market.

### Contact Information

Include:
- Full name
- Email
- Phone
- Location
- LinkedIn and/or portfolio/GitHub if available and relevant

Rules:
- Keep it simple, single-line or compact stacked format.
- Do not include photo, date of birth, marital status, or other unnecessary personal data.
- Include work authorization only if relevant to the target role or explicitly useful.

### Professional Summary

Write a 4–5 line Professional Summary (Personal Profile) that:

Requirements:

Who you are (intro + experience):
- Open with the candidate’s core professional identity and total relevant years of experience, aligning the wording with the target role title where it is truthful (for example, “Senior Full Stack Engineer with 6+ years…”).

Key skills / expertise (JD-aligned):
- In the middle of the summary, naturally integrate 3–5 of the highest-priority skills, tools, or domain keywords from the JD that the candidate genuinely has, focusing on hard skills, frameworks, and domain expertise that appear in the Required / Responsibilities sections.

Value you bring (impact-focused):
- Clearly state the concrete value the candidate brings by linking those skills to delivery, impact, scope, specialization, or domain fit (for example, improving system reliability, accelerating feature delivery, scaling platforms, reducing incidents, or driving business outcomes).

Forward-looking fit (role connection):
- End with a forward-looking line that connects the candidate’s experience and value to this specific type of role or company, explicitly indicating how they intend to apply their expertise to the role’s challenges and goals.

Rules:

- Do not use generic filler such as “hardworking”, “motivated”, or “results-driven” unless those traits are demonstrated elsewhere in the CV.
- Do not include any claim that cannot be supported by experience, achievements, or evidence in the rest of the CV.
- Keep the summary concise (4–5 lines), credible, and tightly tailored to the specific target role and JD, not to the candidate’s entire career in general.


### Skills

Build a role-prioritized skills section.

Requirements:
- List the most important JD-aligned skills first.
- Prioritize exact terms from the JD where supported by evidence.
- Group by category if the list is long, for example:
  - Languages
  - Frameworks
  - Cloud / DevOps
  - Data / AI
  - Methodologies
  - Tools
- Include both acronym and full form where useful, e.g.:
  - Continuous Integration / Continuous Delivery (CI/CD)
  - Application Programming Interface (API)

Rules:
- Only include skills the candidate can credibly defend.
- Avoid bloated or low-signal skill lists.
- Prefer explicit nouns over vague phrases.

### Experience
#### new rules

Render the Work Experience section in reverse chronological order (most recent role first).

Role header
For each role, show on one line:

   - Company name
   - Job title
   - Location (for example, Dublin, Ireland)
   - Dates in a consistent Mon YYYY – Mon YYYY or Mon YYYY – Present format

Bullet structure (AI = Action + Impact + Value)
For each role, write 3–5 bullets that follow the AI+V pattern and are ordered by relevance to this JD:

   - Role & scope (context line, optional):
      -Briefly state what the role is and the main area of responsibility (for example, “Lead full stack engineer owning end-to-end delivery of customer-facing web features”).

   - Actions (A):
      - What you did, steps you took, tools/skills/technologies you used, and the scope you owned (for example, designed, implemented, led, automated, mentored).

   - Impact (I):
      - The result of those actions, with measurable or clearly observable outcomes where possible (for example, reduced incidents, improved performance, accelerated delivery, increased revenue, enhanced reliability).

   - Value (V):
      - How that impact benefited the team, department, product, or company (for example, “improving customer satisfaction”, “supporting revenue growth”, “enabling faster releases”).

Use this combined pattern for each bullet:

Action Verb + Role/Scope + Tool/Skill/Domain + Quantified Impact + Value to team/company

For example:

- “Led end-to-end delivery of a React/Node.js microservice migration, reducing page-load times by 35% and improving customer retention on key journeys.”

- “Automated CI/CD pipelines in GitHub Actions and AWS, cutting deployment time from weekly to daily and enabling faster release cycles for the product team.”

Requirements for each role

   - Show Company, Title, Location (if useful), and Dates in a consistent format.

   - Include 3–5 bullets per role, each written in the AI+V pattern.

   - Order bullets by relevance to the target JD, not by the original chronological order of tasks.

   - Ensure every bullet contains:

      - A clear Action (what you did).

      - A clear Impact (what changed because you did it).

      - The explicit Value to the business, team, or customer.

      - Tools/skills/domains that match the JD where truthful.

Rules

   - Mirror critical JD wording for skills and responsibilities when accurate (for example, use “project management” if the JD uses that term).

   - Use numbers and measurable outcomes wherever possible (percentages, time saved, throughput, users, revenue, incidents, MTTR, etc.).

   - Prioritize JD-aligned achievements: place bullets that satisfy must-have requirements or top keywords at the top of each role.

   - Remove or demote irrelevant bullets that do not strengthen this application, even if they are impressive.

   - Do not invent metrics, tools, systems, leadership scope, or ownership claims the candidate cannot defend.

   - When the candidate lacks direct experience for a requirement, use the closest truthful adjacent evidence and keep the wording accurate (do not pretend to have done something they have not).

   - Keep bullets concise, specific, and outcome-focused; avoid vague descriptions of responsibilities without impact.


### Education

Include:
- Degree
- Institution
- Year or expected completion year
- Relevant Coursework


Rules:
- Keep concise for experienced candidates.
- Use the relevant coursework line only when it materially strengthens JD fit; otherwise omit it.
- Include coursework, thesis, honors, or awards only if:
  - the candidate is a recent graduate, or
  - the item materially strengthens fit for this role

### Certifications

Include only if applicable.

Requirements:
- Use exact official certification names
- Include issuing body, status, or jurisdiction when relevant
- Mark “In Progress” clearly if not yet completed

Rules:
- Prioritize certifications explicitly named in the JD
- Do not imply a certification is complete if it is only planned or in progress

### Projects

Include only when relevant and valuable for the target role.

Use especially for:
- software engineering
- AI / ML / LLM roles
- product-focused technical roles
- transition cases where projects help cover missing but relevant experience

For each included project:
- Project name
- One-line context or purpose
- Tools / stack
- Link if available
- 1–2 bullets with concrete relevance or measurable outcome

Rules:
- Include projects only if they strengthen role fit
- Do not overload the CV with side projects that dilute the target narrative

## Step 4: Render Final HTML

Read `references/resume-template.html` and use it as the base template.

### Required HTML output behavior

The final HTML must include **all CV sections that were actually built** from Step 3.

If a section contains content, it must be rendered in the HTML.
If a section has no credible content, omit the entire section cleanly.

### Required rendered sections

Render these sections when content exists:
- Contact Information
- Professional Summary
- Skills
- Experience
- Education
- Certifications
- Projects

### HTML rendering rules

- Replace all `{{PLACEHOLDER}}` values fully
- Do not leave any placeholder text in the final file
- Use semantic HTML where possible
- Keep the layout single-column
- Use standard visible section headings:
  - Summary
  - Skills
  - Experience
  - Education
  - Certifications
  - Projects
- Ensure all text is selectable
- Ensure print output is clean and PDF-ready
- Keep the HTML visually polished but ATS-safe
- Do not introduce elements that break ATS parsing

### Non-negotiable ATS / print constraints

- Single column only
- Standard section headers
- No tables for layout
- No multi-column sections
- No icons
- No profile image
- No charts or graphics
- No text embedded in images
- Standard fonts only: Arial, Calibri, Georgia, or system sans-serif
- Body font size 10–12pt
- Name 14–16pt
- Print margins 0.5–1 inch
- Max 2 pages when printed, unless the candidate’s seniority genuinely requires more

## Step 5: Save Output

Write the HTML to:

`data/resumes/{company-slug}-{role-slug}.html`

Slug rules:
- lowercase
- hyphen-separated
- stable and readable
- derived from company + role where possible

## Step 6: Show User Preview

After generating the file, show a concise content preview, not raw HTML.

Format:

## CV Preview: {Name} – {Target Role} at {Company}

**Summary:** {first 2 lines}

**Experience**
- {Role 1} at {Company} ({dates}) – {first bullet}
- {Role 2} at {Company} ({dates}) – {first bullet}

**Skills:** {top 10 skills}

**Keyword coverage:** {n}/{target-total} high-priority JD keywords reflected

## Step 7: PDF Instructions

Tell the user:

> Your tailored CV is saved at `data/resumes/{filename}.html`.
>
> To save it as PDF:
> 1. Open the HTML file in your browser
> 2. Press **Cmd+P** on Mac or **Ctrl+P** on Windows
> 3. Choose **Save as PDF**
> 4. Save
>
> The HTML is optimized for clean printing and ATS-safe PDF export.

## Step 8: Update Application Tracker

Update the matching row in `data/applications.md` when possible:
- If status is `Evaluated`, change it to `Resume Ready`
- Append to Notes: `CV: {filename}`

Do not overwrite unrelated notes.

## Step 9: Next Steps

Offer concise next-step actions:

> CV is ready. Next steps:
> - Review the HTML version
> - Save it as PDF
> - Ask for application help for this role
> - Generate a matching cover letter
> - Compare this role with other evaluated roles

## Final Validation Checklist

Before finishing, verify all of the following:

- The correct evaluation was used
- The CV language matches the JD language
- The CV is tailored to the specific role, not generic
- Tier-1 JD keywords are reflected naturally across Summary, Skills, and Experience
- All claims are truthful and supported by source data
- Standard ATS-safe headings are used
- No tables, columns, icons, headers, or footers were introduced
- Empty sections were omitted cleanly
- All built sections were rendered in the HTML
- No placeholders remain in the final output
- The HTML is printable, readable, and visually clean
- The file path and tracker update are correct

## Never Do

- Never fabricate experience, metrics, tools, responsibilities, or credentials
- Never force a keyword if the candidate cannot support it
- Never output a generic one-size-fits-all CV
- Never use creative section names that ATS may not recognize
- Never leave placeholder tokens in the HTML
- Never render empty sections
- Never prioritize design aesthetics over parsing reliability
- Never assume a US-style resume format for Ireland unless explicitly requested