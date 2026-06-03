package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;

import java.util.*;

/**
 * Master-level CV coaching tips.
 *
 * <p>Every tip is specific, actionable, and non-repetitive:
 * <ul>
 *   <li>Summary tip — tailored to matched stack, never generic
 *   <li>Headline tip — title-proximity rule with exact example
 *   <li>Gap tips — each skill gets its own concrete write-up strategy
 *   <li>Bullet tip — STAR formula with metric anchors from the matched skills
 *   <li>ATS tip — fired only when total word match is dangerously low
 *   <li>Sponsorship tip — only when profile flags a requirement
 *   <li>Strategic/final-pass tip — depends on match band
 * </ul>
 */
public final class CvResumeCoachTips {

    private CvResumeCoachTips() {}

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    public static List<String> build(
            Job job,
            UserProfile profile,
            List<String> matchedInPosting,
            List<String> gapsInPosting,
            int matchPercent) {

        List<String> tips = new ArrayList<>();
        String title   = safe(job.getTitle());
        String company = safe(job.getCompany());

        // 1 — Professional summary (always first; content differs by match quality)
        tips.add(summaryTip(title, company, matchedInPosting, matchPercent));

        // 2 — Headline / title proximity
        if (!"this role".equals(title)) {
            tips.add(headlineTip(title));
        }

        // 3 — Gap tips (each skill gets a unique, skill-aware write-up strategy)
        for (String gap : gapsInPosting.stream().limit(4).toList()) {
            tips.add(gapTip(gap, title));
        }

        // 4 — Bullet coaching (only when no gap tips consumed the slot)
        if (gapsInPosting.isEmpty() && !matchedInPosting.isEmpty()) {
            tips.add(bulletTip(matchedInPosting));
        }

        // 5 — ATS density warning (fires only when matched skills ≤ 3)
        if (matchedInPosting.size() <= 3 && !matchedInPosting.isEmpty()) {
            tips.add(atsDensityTip(title));
        }

        // 6 — Sponsorship (only when the profile flags it and the job does NOT offer it)
        if (Boolean.TRUE.equals(profile.getSponsorshipRequired())
                && !Boolean.TRUE.equals(job.getSponsorship())) {
            tips.add(
                "Work authorisation: add a single line inside your contact block — e.g. "
                + "\"Open to work | Requires UK Skilled Worker sponsorship\" — so ATS filters and "
                + "recruiters see it before the phone screen and do not reject you silently after an offer.");
        }

        // 7 — Strategic / final-pass (depends on match band)
        tips.add(closingTip(title, company, matchPercent));

        return tips.stream().distinct().limit(8).toList();
    }

    // -----------------------------------------------------------------------
    // Tip builders — each produces a genuinely unique message
    // -----------------------------------------------------------------------

    private static String summaryTip(
            String title, String company,
            List<String> matched, int matchPercent) {

        if (matched.isEmpty()) {
            return "Professional summary: your CV currently has zero overlap with the required stack "
                + "for " + title + " at " + company + ". Open the Tailor CV tool first — it will surface "
                + "the exact keywords to weave in — then rewrite your summary as: "
                + "[level] [domain] engineer with [X] years specialising in [top 3 matched skills], "
                + "who [quantified outcome].";
        }

        String topStack = String.join(", ",
            matched.stream().limit(3).map(CvResumeCoachTips::prettify).toList());
        String metric  = matchPercent >= 75 ? "latency, throughput, or cost" : "revenue, users, or delivery speed";

        return "Professional summary (2–3 lines): lead with your seniority + the domain this posting "
            + "targets, then call out " + topStack + " by name — recruiters scan for these words in "
            + "under 6 seconds. End with one quantified win anchored to " + metric
            + " (a number without a unit reads as padding; always include %, ms, £, or ×).";
    }

    private static String headlineTip(String title) {
        String shortened = title.length() > 38 ? title.substring(0, 35) + "…" : title;
        return "Headline / most recent role title: recruiters keyword-search titles, not summaries. "
            + "If your current job title differs, add a parenthetical or slash variant — e.g. "
            + "\"Senior Software Engineer (\" + " + shortened + " + \")\" or write it as a dual title "
            + "in your role header. Do NOT fabricate a title; a bracketed descriptor adjacent to your "
            + "real title is ATS-safe and passes background checks.";
    }

    /**
     * Produces a skill-specific gap coaching tip instead of the same boilerplate for every skill.
     */
    private static String gapTip(String skill, String jobTitle) {
        String s = skill.toLowerCase(Locale.ROOT);

        // ── Language / runtime gaps ──────────────────────────────────────────
        if (contains(s, "python")) {
            return "Gap — Python: the posting expects Python but your CV is silent. "
                + "Add it only if you have real delivery: pick one project where you used Python "
                + "(data pipeline, script, test suite, ML inference — anything shipped), write one "
                + "STAR bullet naming the library (pandas, FastAPI, boto3 …) and a metric "
                + "(e.g. \"cut pipeline runtime by 40 %\"). If you have zero Python, close the gap "
                + "with a 4-hour project on Kaggle or a FastAPI side service before applying.";
        }
        if (contains(s, "rust")) {
            return "Gap — Rust: interviewers for roles requiring Rust will ask you to write unsafe "
                + "blocks or explain ownership on a whiteboard. If you cannot do that yet, add Rust "
                + "only after shipping at least one crate to crates.io or contributing a non-trivial "
                + "PR to a Rust repo. Document it as: \"Authored [crate/feature] in Rust; achieved "
                + "[metric] vs. equivalent Go/C++ baseline.\"";
        }
        if (contains(s, "go") || contains(s, "golang")) {
            return "Gap — Go: if you have built concurrency-heavy services in Java or Node, you can "
                + "credibly position Go experience by rewriting one microservice or CLI tool. The "
                + "bullet should name a goroutine-/channel-specific technique and quote a throughput "
                + "or latency metric. Avoid generic \"familiar with Go\" — it reads as a padding claim.";
        }
        if (contains(s, "c#") || contains(s, "csharp") || contains(s, "dotnet") || contains(s, ".net")) {
            return "Gap — C# / .NET: this posting expects .NET experience. If your Java background is "
                + "deep, note the proximity explicitly in your summary: \"Java / .NET polyglot with [X] "
                + "years on JVM; shipped one service on ASP.NET Core (link).\" Back it with a GitHub repo "
                + "— even a small .NET port of an existing Java service is enough to pass the CV screen.";
        }
        if (contains(s, "c++") || contains(s, "cpp")) {
            return "Gap — C++: this is a hard signal — roles requiring C++ routinely test memory "
                + "management and RAII on the technical screen. Only list it if you have shipped "
                + "production C++ (embedded, game engine, or systems code). Write: \"[project], "
                + "C++17, [library / platform], delivered [metric].\" If you cannot defend move "
                + "semantics or smart pointer trade-offs in interview, omit C++ entirely.";
        }
        if (contains(s, "kotlin")) {
            return "Gap — Kotlin: if you have solid Java experience, convert one of your Java "
                + "services to Kotlin (coroutines + sealed classes) and publish it. Your bullet: "
                + "\"Migrated [X] Java service to Kotlin; removed 30% boilerplate, added structured "
                + "concurrency via coroutines.\" Interviewers for " + jobTitle + " will probe "
                + "coroutines and extension functions specifically.";
        }
        if (contains(s, "swift") || contains(s, "ios")) {
            return "Gap — Swift / iOS: only credible with a shipped App Store app or a significant "
                + "TestFlight. Link the app in your CV header. The bullet must quote downloads, "
                + "crashes/session rate, or a UI performance metric (frame time). \"Familiar with "
                + "Swift\" with no App Store presence will not pass the screen.";
        }
        if (contains(s, "typescript")) {
            return "Gap — TypeScript: add it if you have written TypeScript with strict mode on and "
                + "used utility types (Partial, Pick, discriminated unions). A \"converted JS codebase "
                + "to TS strict\" bullet with a metric (\"eliminated 120 any-casts, reduced runtime "
                + "errors by 35 % in staging\") is far stronger than \"experienced with TypeScript.\"";
        }

        // ── Cloud / infrastructure gaps ──────────────────────────────────────
        if (contains(s, "aws")) {
            return "Gap — AWS: list specific services you have actually operated in production, "
                + "not the entire catalogue. Strongest signal for " + jobTitle + " hiring managers: "
                + "ECS/EKS + RDS/Aurora + CloudWatch + IAM role design. Each bullet should name the "
                + "service, the scale (requests/s, GB, accounts), and one operational outcome "
                + "(\"reduced P99 latency by 45 % via RDS Proxy connection pooling\").";
        }
        if (contains(s, "gcp") || contains(s, "google cloud")) {
            return "Gap — GCP: if you have AWS depth, bridge it explicitly: \"AWS-primary; shipped "
                + "one data pipeline on GCP (BigQuery + Dataflow + Cloud Run).\" Quote a data volume "
                + "or cost metric. Hiring managers for GCP-native stacks will ask about IAM, "
                + "VPC-SC, and Pub/Sub semantics — be ready for those specific questions.";
        }
        if (contains(s, "azure")) {
            return "Gap — Azure: for enterprise-facing roles, Azure experience often means AKS, "
                + "Service Bus, and Managed Identity. Add only if you have a specific project; note "
                + "the ARM/Bicep or Terraform tooling used. \"Used Azure\" without naming a service "
                + "or resource type is filtered by most hiring managers at " + jobTitle + " level.";
        }
        if (contains(s, "kubernetes") || contains(s, "k8s")) {
            return "Gap — Kubernetes: a surface-level \"familiar with K8s\" claim is immediately "
                + "tested at interview with questions about pod disruption budgets, resource limits, "
                + "and HPA configuration. Document what you have actually operated: cluster size, "
                + "node count, key workloads, and one reliability or cost metric (e.g. \"+2 nines SLO, "
                + "−30% node spend via VPA\").";
        }
        if (contains(s, "terraform")) {
            return "Gap — Terraform: state-management, module versioning, and drift detection are "
                + "the interview hot-spots. Your bullet should name the provider (AWS/GCP/Azure), "
                + "the scope (how many resources under management), and one outcome: \"Managed "
                + "200-resource AWS estate via Terraform Cloud; cut environment provisioning from "
                + "3 days to 40 minutes.\"";
        }

        // ── Data / ML gaps ───────────────────────────────────────────────────
        if (contains(s, "spark") || contains(s, "apache spark")) {
            return "Gap — Spark: quote data volume (TB/day), the execution engine (EMR, Dataproc, "
                + "Databricks), and the optimisation you applied (partition pruning, broadcast join, "
                + "AQE). \"Processed petabyte-scale data with Spark\" is too vague; "
                + "\"reduced Spark job runtime from 6 h to 40 min on 50 TB/day pipeline via "
                + "adaptive query execution and partition key redesign\" is the bar for " + jobTitle + ".";
        }
        if (contains(s, "kafka")) {
            return "Gap — Kafka: document consumer group lag management, exactly-once vs. "
                + "at-least-once trade-offs, and the throughput you operated at (msgs/s or MB/s). "
                + "Interviewers will ask about retention policy, compaction, and re-balancing — "
                + "your bullet should reference at least one of these to signal production experience "
                + "rather than tutorial-level familiarity.";
        }
        if (contains(s, "machine learning") || contains(s, "ml") || contains(s, "pytorch") || contains(s, "tensorflow")) {
            return "Gap — ML / " + prettify(skill) + ": without a shipped model, claims here are "
                + "risky. Strongest CV evidence: a deployed endpoint with latency and accuracy metrics, "
                + "or a Kaggle competition result (top-X%). Frame as: \"fine-tuned \" + prettify(skill) "
                + "+ \" model for [domain]; achieved [metric] at [latency] ms p95 in production.\"";
        }

        // ── Default: concise but still skill-named ───────────────────────────
        return "Gap — " + prettify(skill) + ": the posting mentions "
            + prettify(skill) + " but your CV does not. Only add it if you have shipped something "
            + "with it in the last 3 years. Write one bullet: [action verb] + [tool: " + prettify(skill) + "] "
            + "+ [context] + [metric]. If you cannot answer \"describe a production problem you "
            + "solved with " + prettify(skill) + "\" in an interview, omit it entirely.";
    }

    private static String bulletTip(List<String> matched) {
        String topTwo = String.join(" and ",
            matched.stream().limit(2).map(CvResumeCoachTips::prettify).toList());
        return "Experience bullets: your CV already covers " + topTwo + " — now make each bullet "
            + "earn its space. Replace duty lists with impact statements: "
            + "[strong verb] + [what you built/changed] + [scale or context] + [metric]. "
            + "Verbs that signal seniority: shipped, redesigned, eliminated, reduced, automated, "
            + "scaled. Avoid \"responsible for\" and \"involved in\" — they signal contribution "
            + "ambiguity rather than ownership.";
    }

    private static String atsDensityTip(String title) {
        return "ATS keyword density: only " + "3 or fewer required skills surfaced on your CV for \"" + title
            + "\". Most ATS systems rank candidates by keyword frequency in the first 400 words. "
            + "Run Tailor CV, accept the suggested rewrites for your skills section, and ensure "
            + "each key term appears at least twice (summary + a bullet) without keyword stuffing.";
    }

    private static String closingTip(String title, String company, int matchPercent) {
        if (matchPercent < 55) {
            return "Strategic fit: your match is " + matchPercent + "% — below the 55% threshold "
                + "where tailoring alone closes the gap. Before spending 2+ hours rewriting, check: "
                + "(1) does \"" + title + "\" sit within your next-role target, and "
                + "(2) do you have 60%+ overlap roles in your inbox? If yes, apply there first and "
                + "use this one as a reach application.";
        }
        if (matchPercent < 75) {
            return "Tailoring priority: match is " + matchPercent + "% — strong enough to proceed, "
                + "but the gap skills above are visible to the recruiter at " + company + ". "
                + "Focus your rewrite on the top 2 gap skills: one STAR bullet each, with a metric. "
                + "Do not pad skills you cannot defend — " + title + " roles routinely probe "
                + "all listed technologies in the technical screen.";
        }
        return "Final pass (" + matchPercent + "% match): strong signal. Export a tailored PDF and "
            + "read only the first half-page — summary, headline, and top two bullets. They must "
            + "echo the posting's top requirements using the employer's exact language. Then check "
            + "the PDF in plain text (copy-paste into Notepad): if the stack keywords disappear, "
            + "your formatter is hiding them from ATS parsers.";
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static boolean contains(String haystack, String needle) {
        return haystack.contains(needle);
    }

    /** Capitalise first letter of each word for display. */
    private static String prettify(String skill) {
        if (skill == null || skill.isBlank()) return skill;
        String[] words = skill.trim().split("\\s+");
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
