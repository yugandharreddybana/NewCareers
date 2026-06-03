package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;

import java.util.*;

/**
 * Master-level CV coaching tips that are genuinely dynamic:
 * <ul>
 *   <li>No hardcoded skill list — any skill extracted from the JD gets a tip
 *   <li>Each tip type (summary, headline, gap, bullet, ATS, sponsorship, closing) is a
 *       different shape with different content — no two tips ever say the same thing
 *   <li>Gap tips are driven by {@link CvSkillCategory} and {@link CvSkillContext} so a
 *       \"Kafka\" gap and a \"RabbitMQ\" gap both get messaging-specific advice rather than
 *       the same boilerplate with the name swapped
 * </ul>
 *
 * <p>Call {@link #build(Job, UserProfile, List, List, int, String)} when you have the raw
 * JD text (preferred). The 5-arg overload falls back gracefully without JD text.
 */
public final class CvResumeCoachTips {

    private CvResumeCoachTips() {}

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Full build — uses raw JD text to produce skill-context-aware tips.
     * Each gap tip is unique because context (frequency, placement, category) differs per skill.
     */
    public static List<String> build(
            Job job,
            UserProfile profile,
            List<String> matchedInPosting,
            List<String> gapsInPosting,
            int matchPercent,
            String rawJobDescription) {

        List<String> tips = new ArrayList<>();
        String title   = safe(job.getTitle());
        String company = safe(job.getCompany());
        String jd      = rawJobDescription == null ? "" : rawJobDescription;

        // --- 1. Professional summary (always first) -------------------------
        tips.add(summaryTip(title, company, matchedInPosting, matchPercent));

        // --- 2. Headline ----------------------------------------------------
        if (!"this role".equals(title)) {
            tips.add(headlineTip(title));
        }

        // --- 3. Gap tips (each skill gets context-aware, category-specific advice) ---
        int gapSlots = 0;
        for (String gap : gapsInPosting.stream().limit(4).toList()) {
            CvSkillContext ctx = CvSkillContext.from(gap, jd);
            String tip = gapTip(ctx, title);
            if (!tips.contains(tip)) {   // deduplicate identical tips (shouldn't happen but safe)
                tips.add(tip);
                gapSlots++;
            }
        }

        // --- 4. Bullet coaching (only when no gap slots consumed) -----------
        if (gapSlots == 0 && !matchedInPosting.isEmpty()) {
            tips.add(bulletTip(matchedInPosting, title));
        }

        // --- 5. ATS density warning (only when match is very thin) ----------
        if (matchedInPosting.size() <= 3 && !matchedInPosting.isEmpty()) {
            tips.add(atsDensityTip(title, matchedInPosting.size()));
        }

        // --- 6. Sponsorship ------------------------------------------------
        if (Boolean.TRUE.equals(profile.getSponsorshipRequired())
                && !Boolean.TRUE.equals(job.getSponsorship())) {
            tips.add(sponsorshipTip());
        }

        // --- 7. Closing tip (band-specific) --------------------------------
        tips.add(closingTip(title, company, matchPercent, gapsInPosting.size()));

        return tips.stream().distinct().limit(8).toList();
    }

    /** Backward-compatible 5-arg overload (no JD text). */
    public static List<String> build(
            Job job,
            UserProfile profile,
            List<String> matchedInPosting,
            List<String> gapsInPosting,
            int matchPercent) {
        return build(job, profile, matchedInPosting, gapsInPosting, matchPercent, "");
    }

    // -----------------------------------------------------------------------
    // Tip builders — every method returns a distinct shape
    // -----------------------------------------------------------------------

    private static String summaryTip(
            String title, String company,
            List<String> matched, int matchPercent) {

        if (matched.isEmpty()) {
            return "Professional summary: zero overlap with the required stack for “" + title
                + "\u201d at " + company + ". Open Tailor CV first — it will surface exact keywords — "
                + "then rewrite as: [seniority] [domain] engineer with [X] years, specialising in "
                + "[top 3 matched skills], who [quantified outcome].";
        }
        String topStack = String.join(", ",
            matched.stream().limit(3).map(CvResumeCoachTips::cap).toList());
        String metricAnchor = matchPercent >= 75
            ? "latency reduction, throughput increase, or infrastructure cost"
            : "revenue impact, user growth, or delivery speed";
        return "Professional summary: lead with seniority + domain, then name "
            + topStack + " explicitly — recruiters scan for these words in the first 6 seconds. "
            + "Close with one quantified win anchored to " + metricAnchor
            + ". A number without a unit (%, ms, \u00a3, \u00d7) reads as padding; always include the unit.";
    }

    private static String headlineTip(String title) {
        String ex = title.length() > 38 ? title.substring(0, 35) + "\u2026" : title;
        return "Headline: recruiters keyword-search role titles, not summaries. "
            + "If your current job title differs from \u201c" + ex + "\u201d, add a bracketed descriptor "
            + "adjacent to your real title (e.g. \u201cSoftware Engineer (" + ex + ")\u201d). "
            + "This is ATS-safe and survives background-check title verification — "
            + "fabricating the title itself does not.";
    }

    /**
     * The core of the engine: each gap skill is classified into a category,
     * and the tip shape changes per category. Within a category, urgency signals
     * (likelyRequired, appearsInJobSummary, jdFrequency) further differentiate the message.
     * Result: no two gap tips look the same even for similar skills.
     */
    static String gapTip(CvSkillContext ctx, String jobTitle) {
        String skill    = ctx.name();
        boolean hot     = ctx.likelyRequired();   // mentioned 2+ times in JD
        boolean header  = ctx.appearsInJobSummary();
        int freq        = ctx.jdFrequency();

        // Urgency prefix — changes per-skill based on JD signals
        String urgency = header
            ? "This is a headline requirement for " + jobTitle + " — "
            : hot
                ? "Mentioned " + freq + "\u00d7 in the JD (a strong signal) — "
                : "";

        return switch (ctx.category()) {

            case LANGUAGE -> urgency +
                "Gap \u2014 " + skill + " (language): add it only with a shipped project. "
                + languageProofBar(skill)
                + " Bullet template: [verb] " + skill + " service/tool that [what it did], "
                + "reducing [metric] by [X%/ms/\u00a3].";

            case FRAMEWORK -> urgency +
                "Gap \u2014 " + skill + " (framework): hiring managers probe internals, not tutorials. "
                + frameworkProofBar(skill)
                + " A GitHub repo with a non-trivial " + skill + " project is the minimum credible signal. "
                + "Bullet: \u201cbuilt [feature] with " + skill + "; reduced [metric] by [X]\u201d.";

            case DATABASE -> urgency +
                "Gap \u2014 " + skill + " (database): interviewers for " + jobTitle
                + " will probe schema design and " + databaseDeepDive(skill) + ". "
                + "Document the specific scale you operated at: rows, GB, QPS, or SLO. "
                + "\u201cUsed " + skill + "\u201d without a size or performance metric is ignored by engineers reviewing CVs.";

            case CLOUD -> urgency +
                "Gap \u2014 " + skill + " (cloud): list specific services, not just the platform name. "
                + cloudDeepDive(skill)
                + " Each bullet must name the service + scale (requests/s, GB, accounts) "
                + "+ one operational outcome (e.g. \u201creduced P99 latency by 45% via [service] change\u201d).";

            case DEVOPS -> urgency +
                "Gap \u2014 " + skill + " (DevOps/infra): "
                + devopsProofBar(skill)
                + " Document cluster/pipeline scope and one reliability or cost outcome. "
                + "Interviewers distinguish \u201coperated in production\u201d from \u201cfollowed a tutorial\u201d "
                + "by asking about failure modes: what broke and how you fixed it.";

            case DATA -> urgency +
                "Gap \u2014 " + skill + " (data/ML): "
                + dataProofBar(skill)
                + " Quote data volume (GB/TB/day), the execution platform, and the optimisation applied. "
                + "\u201cExperienced with " + skill + "\u201d with no volume metric is filtered by data-team hiring managers.";

            case TESTING -> urgency +
                "Gap \u2014 " + skill + " (testing): go beyond \u201cwrote unit tests\u201d. "
                + "Document coverage delta achieved, number of regressions caught pre-production, "
                + "or a specific " + skill + " pattern you applied (e.g. test pyramid strategy, "
                + "contract testing, mutation testing). A metric like \u201cPR cycle time −30% after "
                + "adding " + skill + " gate to CI\u201d is much stronger than a checkbox.";

            case ARCHITECTURE -> urgency +
                "Gap \u2014 " + skill + " (architecture/methodology): this signals seniority. "
                + "Do not list " + skill + " as a skill tag — demonstrate it through a bullet: "
                + "\u201cintroduced [" + skill + " pattern] to [problem]; reduced [coupling/latency/incidents] "
                + "by [X]\u201d. Interviewers will ask you to draw a diagram or walk through a "
                + "trade-off decision, not just confirm you know the term.";

            case SOFT_SKILL -> urgency +
                "Gap \u2014 " + skill + ": soft skills are validated through stories, not bullet tags. "
                + "Replace \u201c" + skill + "\u201d as a skill tag with one concrete story in your summary or a role "
                + "description: who you influenced, what the stakes were, what changed as a result. "
                + "Quantify where possible (team size, budget, scope, delivery date).";

            default -> urgency +
                "Gap \u2014 " + skill + ": the posting uses this term " + (freq > 1 ? freq + " times" : "at least once")
                + ". Add it only with a specific deliverable: [what you built using " + skill + "] + [context] "
                + "+ [metric]. If you cannot explain a real production challenge you solved with "
                + skill + " in an interview, leave it off.";
        };
    }

    // -----------------------------------------------------------------------
    // Category-specific \"proof bar\" helpers — vary by sub-skill signals
    // -----------------------------------------------------------------------

    private static String languageProofBar(String skill) {
        String s = skill.toLowerCase(Locale.ROOT);
        if (s.contains("rust"))
            return "Minimum bar: one published crate or a merged upstream PR. Interviewers will test ownership semantics and unsafe blocks.";
        if (s.contains("c++") || s.contains("cpp"))
            return "Minimum bar: shipped production C++ (embedded, systems, or performance-critical). Be ready for move semantics, RAII, and smart pointer trade-offs.";
        if (s.contains("go") || s.contains("golang"))
            return "Minimum bar: a Go service or CLI tool with goroutine/channel usage documented. \u201cFamiliar with Go\u201d without concurrent code is a red flag.";
        if (s.contains("python"))
            return "Minimum bar: one shipped script/service with a named library (pandas, FastAPI, boto3\u2026) and a % or time metric.";
        return "Minimum bar: one shipped project with this language, link in CV or GitHub.";
    }

    private static String frameworkProofBar(String skill) {
        String s = skill.toLowerCase(Locale.ROOT);
        if (s.contains("react") || s.contains("next"))
            return "Interviewers probe: rendering model (SSR/SSG/RSC), state management strategy, and performance optimisation (bundle size, hydration).";
        if (s.contains("spring"))
            return "Interviewers probe: bean lifecycle, autoconfiguration, transaction propagation, and security filter chain.";
        if (s.contains("angular"))
            return "Interviewers probe: change detection strategy (OnPush), lazy loading, RxJS operators, and DI hierarchy.";
        if (s.contains("vue"))
            return "Interviewers probe: Composition API vs Options API trade-offs, Pinia state, and SSR with Nuxt.";
        return "Interviewers probe framework internals — be ready to explain at least one lifecycle, one performance pattern, and one debugging approach.";
    }

    private static String databaseDeepDive(String skill) {
        String s = skill.toLowerCase(Locale.ROOT);
        if (s.contains("postgres") || s.contains("sql"))
            return "query plan analysis (EXPLAIN ANALYZE), index design, and connection pool sizing";
        if (s.contains("mongo"))
            return "document schema design, index strategy (compound, sparse, TTL), and aggregation pipeline performance";
        if (s.contains("redis"))
            return "eviction policy selection, key expiry patterns, and pub/sub vs. Streams trade-offs";
        if (s.contains("elasticsearch") || s.contains("opensearch"))
            return "mapping design, shard sizing, and relevance tuning (BM25, function score)";
        if (s.contains("cassandra"))
            return "partition key design, consistency level trade-offs, and compaction strategy";
        if (s.contains("dynamo"))
            return "single-table design, GSI/LSI strategy, and capacity mode (on-demand vs. provisioned)";
        return "query performance, schema/data model design, and operational concerns at scale";
    }

    private static String cloudDeepDive(String skill) {
        String s = skill.toLowerCase(Locale.ROOT);
        if (s.contains("aws"))
            return "Strongest signals for senior AWS roles: ECS/EKS + RDS/Aurora + IAM role design + CloudWatch alarms. Avoid listing every service — depth beats breadth.";
        if (s.contains("gcp") || s.contains("google cloud"))
            return "Strongest signals: BigQuery + Cloud Run or GKE + IAM/VPC-SC + Pub/Sub delivery semantics. Bridge from AWS if that is your primary platform.";
        if (s.contains("azure"))
            return "Strongest signals: AKS + Service Bus + Managed Identity + Bicep/ARM or Terraform AzureRM. \u201cUsed Azure\u201d without a named service is immediately discounted.";
        return "Name the specific services you operated, not just the platform, and include the region-scale and one SLO or cost outcome.";
    }

    private static String devopsProofBar(String skill) {
        String s = skill.toLowerCase(Locale.ROOT);
        if (s.contains("kubernetes") || s.contains("k8s"))
            return "Minimum bar: operated a cluster in production. Interviewers ask about HPA, PodDisruptionBudgets, resource limits, and a real incident you debugged.";
        if (s.contains("terraform"))
            return "Minimum bar: managed a multi-resource estate with remote state and modules. Quote the provider, resource count, and environment provisioning time.";
        if (s.contains("docker"))
            return "Go beyond \u201ccontainerised apps\u201d: document multi-stage build optimisation (image size before/after), layer caching strategy, or a security hardening step.";
        if (s.contains("github actions") || s.contains("gitlab ci") || s.contains("jenkins"))
            return "Document the pipeline stages, test/deploy gate you built, and a before/after metric (build time, deploy frequency, or failure rate).";
        return "Document what you operated, at what scale, and what broke and how you fixed it.";
    }

    private static String dataProofBar(String skill) {
        String s = skill.toLowerCase(Locale.ROOT);
        if (s.contains("kafka"))
            return "Minimum bar: operated a consumer group in production. Interviewers ask about lag management, exactly-once vs. at-least-once, and partition key design.";
        if (s.contains("spark"))
            return "Minimum bar: optimised a Spark job beyond the defaults. Quote the execution engine (EMR/Dataproc/Databricks), data volume (TB/day), and the optimisation applied.";
        if (s.contains("pytorch") || s.contains("tensorflow") || s.contains("keras"))
            return "Minimum bar: a deployed model endpoint with p95 latency and accuracy metrics, or a top-X% Kaggle leaderboard result with public notebook.";
        if (s.contains("dbt"))
            return "Document model count, tests written, and one materialisation strategy decision (incremental vs. table vs. view and why).";
        if (s.contains("airflow") || s.contains("prefect"))
            return "Document the DAG count you managed, a real retry/backfill scenario you solved, and the data volume moving through the pipeline per day.";
        return "Quote data volume, platform, and a concrete optimisation or reliability improvement.";
    }

    private static String bulletTip(List<String> matched, String title) {
        String topTwo = String.join(" and ",
            matched.stream().limit(2).map(CvResumeCoachTips::cap).toList());
        return "Experience bullets: your CV already covers " + topTwo
            + " — the differentiator for " + title + " is evidence of scale and ownership. "
            + "Rewrite each bullet as: [strong verb] + [what you built/changed] + [at what scale] + [measured outcome]. "
            + "Power verbs: shipped, redesigned, eliminated, automated, scaled, reduced. "
            + "Delete every \u201cresponsible for\u201d and \u201cinvolved in\u201d — they signal contribution ambiguity, not ownership.";
    }

    private static String atsDensityTip(String title, int matchCount) {
        return "ATS keyword density: only " + matchCount + " required skill"
            + (matchCount == 1 ? "" : "s") + " surfaced on your CV for \u201c" + title + "\u201d. "
            + "Most ATS systems score the first 400 words of your document by keyword frequency. "
            + "Run Tailor CV, accept the rewrite suggestions, then ensure each key skill appears "
            + "at least twice — once in the summary and once in an experience bullet — without stuffing.";
    }

    private static String sponsorshipTip() {
        return "Work authorisation: add one explicit line in your contact block: "
            + "e.g. \u201cOpen to work \u00b7 Requires Skilled Worker visa sponsorship\u201d. "
            + "Without this, recruiters who cannot offer sponsorship often shortlist you, then drop you "
            + "after the first call — costing both sides time. Front-loading it filters the right matches in.";
    }

    private static String closingTip(
            String title, String company, int matchPercent, int gapCount) {
        if (matchPercent < 55) {
            return "Strategic fit ("+matchPercent+"% match): tailoring alone will not close a "
                + (100 - matchPercent) + "% gap. Before investing 2+ hours rewriting: "
                + "check whether \u201c" + title + "\u201d sits inside your target role family, and compare this "
                + "against higher-overlap roles in your inbox. Use this as a reach application.";
        }
        if (matchPercent < 75) {
            return "Tailoring priority (" + matchPercent + "% match): solid enough to apply, but "
                + company + "\u2019s recruiter will notice the " + gapCount + " gap skill"
                + (gapCount == 1 ? "" : "s") + " above. Focus your rewrite exclusively on the top "
                + "2 gap items — one STAR bullet each. Do not pad skills you cannot defend; "
                + title + " technical screens probe every listed technology.";
        }
        return "Final pass (" + matchPercent + "% \u2014 strong): export a tailored PDF, then paste the "
            + "first half-page into plain text (Notepad / cat). If key stack words disappear, your "
            + "formatter is hiding them from ATS parsers. Summary, headline, and top two bullets "
            + "must echo " + company + "\u2019s exact language for the primary required skills.";
    }

    // -----------------------------------------------------------------------
    // Utilities
    // -----------------------------------------------------------------------

    private static String cap(String s) {
        if (s == null || s.isBlank()) return s;
        String[] words = s.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1));
        }
        return sb.toString();
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "this role" : s.trim();
    }
}
