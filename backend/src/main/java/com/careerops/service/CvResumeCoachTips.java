package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Actionable CV coaching tips (resume-writer quality), not keyword-stuffing checklists.
 */
public final class CvResumeCoachTips {

    private CvResumeCoachTips() {}

    public static List<String> build(
            Job job,
            UserProfile profile,
            List<String> matchedInPosting,
            List<String> gapsInPosting,
            int matchPercent) {
        List<String> tips = new ArrayList<>();
        String title = safe(job.getTitle());
        String company = safe(job.getCompany());

        if (!matchedInPosting.isEmpty()) {
            String stack = String.join(", ", matchedInPosting.stream().limit(4).toList());
            tips.add(
                "Professional summary (2–3 lines): open with your level + domain, name the stack this role cares about ("
                    + stack
                    + "), and end with one quantified outcome (revenue, latency, users, or cost). Use the employer's language without copying the posting verbatim.");
        } else {
            tips.add(
                "Professional summary: state your target level, primary domain, and one metric-backed win. Then run Tailor my CV so we can align wording to "
                    + title + " at " + company + ".");
        }

        if (title != null && !title.isBlank() && !"this role".equals(title)) {
            tips.add(
                "Headline / most recent role line: include a title adjacent to \""
                    + title
                    + "\" (e.g. \"Senior Software Engineer — platform / "
                    + shortenTitle(title)
                    + "\") so recruiters see an immediate title match in a 6-second scan.");
        }

        for (String gap : gapsInPosting.stream().limit(4).toList()) {
            tips.add(gapBulletCoaching(gap));
        }

        if (gapsInPosting.isEmpty() && !matchedInPosting.isEmpty()) {
            tips.add(
                "Experience bullets: for each matched skill above, add one STAR bullet (situation → your action → metric). Lead with verbs like shipped, reduced, automated, scaled — avoid duty lists.");
        }

        if (Boolean.TRUE.equals(profile.getSponsorshipRequired()) && !Boolean.TRUE.equals(job.getSponsorship())) {
            tips.add(
                "Work authorisation: if you need sponsorship, add one neutral line in the header or summary (e.g. \"Eligible to work in [country]; require visa sponsorship\") so you are not filtered silently.");
        }

        if (matchPercent < 68) {
            tips.add(
                "Strategic fit: match is below 68% for this posting. Before heavy tailoring, confirm "
                    + title
                    + " matches your target roles; otherwise invest time in higher-overlap roles first.");
        } else {
            tips.add(
                "Final pass: export a tailored PDF, then skim the first half-page as a recruiter would — summary, headline, and top two bullets must echo the posting's top requirements.");
        }

        return tips.stream().limit(8).toList();
    }

    private static String gapBulletCoaching(String skill) {
        return "Gap — "
            + skill
            + ": only add this if you have real evidence. Find one project in the last 3–5 years, write one bullet with a metric (e.g. throughput, error rate, delivery time), and name the tool explicitly. If you cannot defend it in interview, omit it.";
    }

    private static String shortenTitle(String title) {
        if (title.length() <= 40) return title;
        return title.substring(0, 37) + "…";
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "this role" : s.trim();
    }
}
