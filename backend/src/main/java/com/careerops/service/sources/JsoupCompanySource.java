package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.service.JobDeliveryFilters;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Jsoup-only fallback scraper for company career pages.
 * Prefer {@link com.careerops.service.sources.company.CompanyCareerSource} for tiered ATS → Playwright → Jsoup fetch.
 */
@Component
public class JsoupCompanySource {
    private static final Logger log = LoggerFactory.getLogger(JsoupCompanySource.class);
    private static final int MAX_LINKS_PER_COMPANY = 15;

    /** Key = company name, Value = careers page URL. */
    private static final Map<String, String> CAREER_PAGES = new LinkedHashMap<>() {{
        // ── Big Tech (Dublin offices) ─────────────────────────────────────────
        // ── US Tech Giants / Silicon Docks ────────────────────────────────────
        put("Google",        "https://careers.google.com/jobs/results/?location=Dublin%2C+Ireland");
        put("Meta",          "https://www.metacareers.com/jobs?offices[0]=Dublin%2C+Ireland");
        put("Microsoft",     "https://jobs.microsoft.com/en-us/search?location=Dublin%2C+Ireland");
        put("Apple",         "https://jobs.apple.com/en-ie/search#&t=1&so=&l=Dublin");
        put("Amazon",        "https://www.amazon.jobs/en/search?base_query=software&location=Dublin%2C+Ireland");
        put("LinkedIn",      "https://www.linkedin.com/company/linkedin/jobs/");
        put("Salesforce",    "https://salesforce.wd12.myworkdayjobs.com/Salesforce/jobs?Location_Country=IRL");
        put("HubSpot",       "https://www.hubspot.com/careers/jobs");
        put("Workday",       "https://workday.wd5.myworkdayjobs.com/Workday/jobs?Location_Country=IRL");
        put("Oracle",        "https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs?location=Ireland");
        put("Stripe",        "https://stripe.com/jobs/search?office=dublin");
        put("Twitter/X",     "https://careers.x.com/en/jobs.html");
        put("Zendesk",       "https://jobs.zendesk.com/us/en/search-results?keywords=&location=Dublin%2C+Ireland");
        put("Dropbox",       "https://jobs.dropbox.com/all-jobs?location=Dublin%2C+Ireland");
        put("TikTok",        "https://careers.tiktok.com/position?keywords=&location=Ireland");
        put("Intercom",      "https://boards.greenhouse.io/intercom");
        put("Twilio",        "https://www.twilio.com/en-us/company/jobs?country=IE");

        // ── Irish Founded / Headquartered ─────────────────────────────────────
        put("Teamwork",      "https://www.teamwork.com/careers/");
        put("Clio",          "https://www.clio.com/careers/");
        put("Immedis",       "https://immedis.com/careers/");
        put("Phorest",       "https://www.phorest.com/careers/");
        put("NearForm",      "https://nearform.com/careers/");
        put("Evervault",     "https://evervault.com/careers");
        put("Version 1",     "https://www.version1.com/careers/current-vacancies/");
        put("Ergo",          "https://ergogroup.ie/careers/");
        put("Auxilion",      "https://auxilion.com/careers/");
        put("AMCS Group",    "https://amcsgroup.com/careers/");
        put("Fenergo",       "https://fenergo.com/careers/");
        put("TransferMate",  "https://www.transfermate.com/careers/");
        put("Wayflyer",      "https://www.wayflyer.com/careers");
        put("Cubic Telecom", "https://cubictelecom.com/careers/");
        put("Solgari",       "https://solgari.com/careers/");
        put("Edgescan",      "https://edgescan.com/company/careers/");
        put("Telnyx",        "https://telnyx.com/careers");
        put("Taxback Int.",  "https://www.taxback.com/en/careers/");
        put("Poppulo",       "https://www.poppulo.com/careers/");
        put("Flipdish",      "https://www.flipdish.com/careers/");
        put("Ekco",          "https://www.ekco.io/careers/");
        put("Oneview",       "https://www.oneviewhealthcare.com/careers/");
        put("Datapac",       "https://datapac.com/careers/");
        put("Swoop Funding", "https://swoopfunding.com/ie/careers/");
        put("Buymie",        "https://buymie.eu/careers/");
        put("Conjura",       "https://conjura.com/careers/");
        put("Asavie",        "https://asavie.com/careers/");
        put("Croscon",       "https://croscon.com/careers/");
        put("Fire Financial","https://fire.financial/careers");

        // ── IDA-Backed Multinationals / Consulting ────────────────────────────
        put("PayPal",        "https://careers.pypl.com/home/");
        put("Mastercard",    "https://careers.mastercard.com/us/en/search-results?keywords=&location=Dublin%2C+Ireland");
        put("Visa",          "https://corporate.visa.com/en/jobs.html");
        put("Experian",      "https://www.experianplc.com/careers/search-jobs/?country=Ireland");
        put("SAP",           "https://jobs.sap.com/search/?q=&location=Dublin%2C+Ireland");
        put("IBM",           "https://www.ibm.com/employment/search-jobs/?country=Ireland");
        put("Accenture",     "https://www.accenture.com/ie-en/careers/jobsearch");
        put("Cognizant",     "https://careers.cognizant.com/global/en/search-results?keywords=developer&location=Ireland");
        put("Wipro",         "https://careers.wipro.com/careers-home/jobs?location=Dublin");
        put("Infosys",       "https://career.infosys.com/joblist#?country=Ireland");
        put("HCL Tech",      "https://www.hcltech.com/careers/job-search?country=IRL");
        put("Deloitte",      "https://apply.deloitte.com/careers/SearchJobs/");
        put("PwC Ireland",   "https://www.pwc.ie/careers/experienced-careers.html");
        put("KPMG Ireland",  "https://home.kpmg/ie/en/home/careers.html");
        put("EY",            "https://careers.ey.com/ey/search/#?location=ireland");
        put("TCS",           "https://ibegin.tcs.com/iBegin/faces/SearchJobServlet?location=Ireland");

        // ── Banking, Fintech & Insurance ──────────────────────────────────────
        put("Fexco",         "https://www.fexco.com/fexco/careers/");
        put("Susquehanna",   "https://sig.com/careers/opportunities/");
        put("AIB",           "https://aib.ie/careers");
        put("Bank of Ireland","https://careers.bankofireland.com/en/jobs/");
        put("Permanent TSB", "https://www.permanenttsb.ie/about-us/careers/");
        put("Revolut",       "https://www.revolut.com/en-IE/careers/");
        put("N26",           "https://n26.com/en-eu/careers/overview");
        put("Coinbase",      "https://www.coinbase.com/careers/positions");
        put("JP Morgan",     "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/jobs?Location_Country=IRL");
        put("Citibank",      "https://jobs.citi.com/search-jobs/Dublin/287/1");
        put("State Street",  "https://statestreet.wd1.myworkdayjobs.com/Global/jobs?Location_Country=IRL");
        put("Fidelity",      "https://jobs.fidelity.com/search-jobs/dublin/33161/4");
        put("Irish Life",    "https://www.irishlife.ie/about-us/careers/");
        put("Allianz",       "https://careers.allianz.com/en_US/ireland.html");
        put("AXA",           "https://www.axa.ie/careers/");
        put("Zurich",        "https://www.zurich.ie/careers/");

        // ── Pharma, MedTech & BioTech ─────────────────────────────────────────
        put("Pfizer",        "https://www.pfizer.ie/careers");
        put("MSD",           "https://jobs.msd.com/gb/en/ireland-job-search");
        put("Johnson & Johnson","https://jobs.jnj.com/en/jobs/?location=Ireland");
        put("Boston Scientific","https://careers.bostonscientific.com/search-jobs/Ireland");
        put("Medtronic",     "https://jobs.medtronic.com/jobs/search?q=&location=Ireland");
        put("AbbVie",        "https://careers.abbvie.com/en/search-jobs?k=&l=Ireland");
        put("Novartis",      "https://www.novartis.com/ie-en/careers/career-search");
        put("Regeneron",     "https://careers.regeneron.com/en/jobs/?location=Ireland");
        put("Enovate Medical","https://enovatemedical.com/careers/");
        put("Cerner",        "https://careers.cerner.com/search/?q=&locationsearch=ireland");
        put("Wellola",       "https://wellola.com/careers/");

        // ── Aviation, Travel & Aerospace ──────────────────────────────────────
        put("Ryanair",       "https://careers.ryanair.com/");
        put("Aer Lingus",    "https://www.aerlingus.com/careers/");
        put("DAA",           "https://www.daa.ie/careers/");
        put("Avolon",        "https://www.avolon.aero/careers");
        put("SMBC Aviation", "https://www.smbc.aero/careers");

        // ── Energy, Utilities & Sustainability ────────────────────────────────
        put("ESB",           "https://esb.ie/careers/apply-now/application");
        put("Bord Gais",     "https://www.bordgaisenergy.ie/company/careers");
        put("SSE Airtricity","https://careers.sse.com/jobs/search?location=Ireland");
        put("EirGrid",       "https://www.eirgridgroup.com/about/careers/");
        put("Gael Force Wind","https://www.gaelforcewind.com/careers"); 

        // ── Retail, FMCG & Agri-Food ──────────────────────────────────────────
        put("Dunnes Stores", "https://www.dunnesstores.com/c/careers");
        put("Musgrave",      "https://www.musgravegroup.com/careers/");
        put("Tesco Ireland", "https://ireland.tesco-careers.com/");
        put("Kerry Group",   "https://jobs.kerry.com/search/?q=&locationsearch=Ireland");
        put("Glanbia",       "https://careers.glanbia.com/");
        put("Penneys",       "https://careers.primark.com/search-jobs/Ireland");

        // ── Construction, Engineering & Real Estate ───────────────────────────
        put("CRH",           "https://careers.crh.com/search/?q=&locationsearch=Ireland");
        put("Mercury Eng",   "https://www.mercuryeng.com/careers/");
        put("PM Group",      "https://www.pmgroup-global.com/careers/");
        put("Jones Eng",     "https://joneseng.com/careers/");

        // ── Public Sector, Semi-State & Education ─────────────────────────────
        put("HSE",           "https://www.hse.ie/eng/staff/jobs/");
        put("Dublin City Council", "https://careers.dublincity.ie/");
        put("Trinity College","https://jobs.tcd.ie/");
        put("UCD",           "https://www.ucd.ie/workatucd/jobs/");

        // ── Cybersecurity ─────────────────────────────────────────────────────
        put("WithSecure",    "https://www.withsecure.com/en/about-us/careers");
        put("CrowdStrike",   "https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers/jobs?Location_Country=IRL");
        put("Palo Alto",     "https://jobs.paloaltonetworks.com/en/jobs/?location=Ireland");
        put("Tenable",       "https://careers.tenable.com/jobs?location=Dublin%2C+Ireland");
        put("Qualys",        "https://www.qualys.com/company/careers/");

        // ── SaaS / Cloud ──────────────────────────────────────────────────────
        put("Atlassian",     "https://www.atlassian.com/company/careers/all-jobs#search&location=Dublin%2C+Ireland");
        put("MongoDB",       "https://www.mongodb.com/company/careers/departments");
        put("Cloudflare",    "https://www.cloudflare.com/careers/jobs/?location=Dublin%2C+Ireland");
        put("Snowflake",     "https://careers.snowflake.com/jobs?location=Dublin%2C+Ireland");
        put("Zoom",          "https://careers.zoom.us/jobs/search?location=Dublin%2C+Ireland");
        put("Slack",         "https://slack.com/intl/en-ie/careers");

        // ── E-Commerce / Logistics ────────────────────────────────────────────
        put("Shopify",       "https://www.shopify.com/careers/search#Jobs?location=Ireland");
        put("Zalando",       "https://jobs.zalando.com/en/jobs?location%5B%5D=Dublin%2C+Ireland");
        put("An Post",       "https://www.anpost.com/careers");
        put("DHL Ireland",   "https://careers.dhl.com/global/en/search-results?keywords=&location=Ireland");

        // ── Media / Gaming ────────────────────────────────────────────────────
        put("King",          "https://careers.king.com/jobs/?location=Dublin");
        put("Electronic Arts","https://jobs.ea.com/en_US/jobs#q=&l=Dublin%2C+Ireland");
        put("Keywords Studios","https://www.keywordsstudios.com/en/careers/");

        // ── Telecoms ──────────────────────────────────────────────────────────
        put("Vodafone Ireland","https://careers.vodafone.ie/search/");
        put("Three Ireland", "https://www.three.ie/careers/");
        put("Eir",           "https://eir.ie/careers/");

        // ── Recruitment / HR Tech ─────────────────────────────────────────────
        put("Occupop",       "https://occupop.com/careers/");
    }};

    /** All configured company career pages (for admin/docs). */
    public static List<String> companyNames() {
        return List.copyOf(CAREER_PAGES.keySet());
    }

    public static int companyCount() {
        return CAREER_PAGES.size();
    }

    /** Exposed for {@link com.careerops.service.sources.company.CompanyCareerRegistry}. */
    public static Map<String, String> careerPages() {
        return Collections.unmodifiableMap(CAREER_PAGES);
    }

    /** Jsoup-only scrape for a single company (fallback tier). */
    public List<Job> scrapeCompanyPage(String company, String careersUrl) {
        List<Job> jobs = new ArrayList<>();
        try {
            Document doc = Jsoup.connect(careersUrl)
                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                .followRedirects(true)
                .timeout(9_000)
                .get();

            var links = doc.select(
                "a[href*=/job/], a[href*=/jobs/], a[href*=career], a[href*=position], "
                    + "a[href*=vacanc], a[href*=opening]");
            int added = 0;
            for (Element a : links) {
                String title = a.text().trim();
                if (title.length() < 4 || title.length() > 160) {
                    continue;
                }
                if (!JobDeliveryFilters.isPlausibleJobTitle(title)) {
                    continue;
                }
                String lower = title.toLowerCase();
                if (lower.contains("cookie") || lower.contains("privacy") || lower.contains("sign in")) {
                    continue;
                }
                String href = a.absUrl("href");
                String hrefLower = href.toLowerCase(Locale.ROOT);
                if (hrefLower.contains("search-results") && !hrefLower.contains("/job")) {
                    continue;
                }

                Job j = Job.builder()
                    .title(title)
                    .company(company)
                    .location("Dublin, Ireland")
                    .sourceUrl(href.isEmpty() ? careersUrl : href)
                    .sourceName("jsoup-companies")
                    .currency("EUR")
                    .postedAt(Instant.now())
                    .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                jobs.add(j);
                if (++added >= MAX_LINKS_PER_COMPANY) {
                    break;
                }
            }
        } catch (Exception e) {
            log.debug("jsoup-companies scrape failed {}: {}", company, e.getMessage());
        }
        return jobs;
    }
}
