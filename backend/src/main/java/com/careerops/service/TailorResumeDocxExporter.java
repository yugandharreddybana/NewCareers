package com.careerops.service;



import com.careerops.model.Job;

import com.careerops.model.User;

import com.careerops.model.UserProfile;

import com.fasterxml.jackson.databind.JsonNode;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;

import org.apache.poi.xwpf.usermodel.XWPFDocument;

import org.apache.poi.xwpf.usermodel.XWPFParagraph;

import org.apache.poi.xwpf.usermodel.XWPFRun;

import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTInd;

import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPr;

import org.openxmlformats.schemas.wordprocessingml.x2006.main.STJc;

import org.springframework.stereotype.Component;



import java.io.ByteArrayOutputStream;

import java.io.IOException;

import java.math.BigInteger;

import java.util.List;

import java.util.Locale;



/**

 * Exports tailored CV markdown sections to DOCX with Version 2.0 resume styling.

 */

@Component

public class TailorResumeDocxExporter {



    public byte[] export(UserProfile profile, String summary, JsonNode sections) throws IOException {

        return export(null, profile, null, null, summary, sections);

    }



    public byte[] export(

            User user,

            UserProfile profile,

            Job job,

            String persistedJobTitle,

            String summary,

            JsonNode sections) throws IOException {

        try (XWPFDocument doc = new XWPFDocument();

             ByteArrayOutputStream out = new ByteArrayOutputStream()) {



            String headerText = extractHeaderSectionText(sections);

            CvHeaderParser.HeaderData headerData = CvHeaderParser.parse(headerText, user, profile);

            String name = CvHeaderParser.resolveName(user, headerData);

            String roleLine = CvHeaderParser.resolveContactLine(

                job != null && job.getTitle() != null ? job.getTitle() : persistedJobTitle,

                profile);



            addCenteredText(doc, name, 16, true, "111111");

            if (!roleLine.isBlank()) {

                addCenteredText(doc, roleLine, 10, false, "222222");

            }

            addContactRows(doc, headerData);



            doc.createParagraph();



            if (summary != null && !summary.isBlank()) {

                addSectionHeading(doc, "Professional Summary");

                addJustifiedBody(doc, summary);

            }



            if (sections != null && sections.isArray()) {

                for (JsonNode row : sections) {

                    String sectionName = row.path("name").asText("");

                    String lower = sectionName.toLowerCase(Locale.ROOT);

                    if (lower.equals("header") || lower.equals("contact")

                        || lower.equals("cv") || lower.equals("resume")) {

                        continue;

                    }

                    String rewritten = row.path("rewritten").asText("");

                    if (rewritten.isBlank()) continue;

                    if (lower.contains("summary") && summary != null && !summary.isBlank()) {

                        continue;

                    }

                    addSectionHeading(doc, sectionName);

                    if (lower.contains("experience") || lower.contains("employment")) {

                        addExperienceBody(doc, rewritten);

                    } else if (lower.contains("skill")) {

                        addSkillsBody(doc, rewritten);

                    } else {

                        addJustifiedBody(doc, rewritten);

                    }

                }

            }



            doc.write(out);

            return out.toByteArray();

        }

    }



    private static String extractHeaderSectionText(JsonNode sections) {

        if (sections == null || !sections.isArray()) {

            return "";

        }

        for (JsonNode row : sections) {

            String name = row.path("name").asText("").trim().toLowerCase(Locale.ROOT);

            if (name.equals("header") || name.equals("contact")) {

                String original = row.path("original").asText("").trim();

                return !original.isBlank() ? original : row.path("rewritten").asText("").trim();

            }

        }

        return "";

    }



    private static void addContactRows(XWPFDocument doc, CvHeaderParser.HeaderData data) {

        if (data == null) return;

        StringBuilder contact = new StringBuilder();

        if (data.phone() != null && !data.phone().isBlank()) {

            contact.append("T: ").append(data.phone());

        }

        if (data.email() != null && !data.email().isBlank()) {

            if (!contact.isEmpty()) contact.append(" | ");

            contact.append("E: ").append(data.email());

        }

        if (data.location() != null && !data.location().isBlank()) {

            if (!contact.isEmpty()) contact.append(" | ");

            contact.append(data.location());

        }

        if (!contact.isEmpty()) {

            addCenteredText(doc, contact.toString(), 10, false, "333333");

        }



        StringBuilder links = new StringBuilder();

        appendLinkLabel(links, "LinkedIn", data.linkedInUrl());

        appendLinkLabel(links, "GitHub", data.githubUrl());

        appendLinkLabel(links, "Portfolio", data.portfolioUrl());

        if (!links.isEmpty()) {

            addCenteredText(doc, links.toString(), 10, false, "1155cc");

        }

    }



    private static void appendLinkLabel(StringBuilder sb, String label, String url) {

        if (url == null || url.isBlank()) return;

        if (!sb.isEmpty()) sb.append(" | ");

        sb.append(label);

    }



    private static void addExperienceBody(XWPFDocument doc, String body) {

        List<String> blocks = ExperienceSectionParser.splitIntoRoleBlocks(body);

        if (blocks.isEmpty()) {

            addJustifiedBody(doc, body);

            return;

        }

        for (String block : blocks) {

            if (block.isBlank()) continue;

            ExperienceSectionParser.ParsedRole role = ExperienceSectionParser.parseRoleBlock(block);

            XWPFParagraph header = doc.createParagraph();

            header.setSpacingAfter(40);

            XWPFRun titleRun = header.createRun();

            titleRun.setBold(true);

            titleRun.setFontSize(11);

            titleRun.setFontFamily("Arial");

            titleRun.setText(role.title());

            if (!role.dates().isBlank()) {

                titleRun.addTab();

                XWPFRun datesRun = header.createRun();

                datesRun.setFontSize(10);

                datesRun.setFontFamily("Arial");

                datesRun.setText(role.dates());

            }

            if (!role.company().isBlank()) {

                XWPFParagraph company = doc.createParagraph();

                company.setSpacingAfter(60);

                XWPFRun companyRun = company.createRun();

                companyRun.setBold(true);

                companyRun.setFontSize(10);

                companyRun.setFontFamily("Arial");

                companyRun.setText(role.company());

            }

            for (String bullet : role.bullets()) {

                XWPFParagraph p = doc.createParagraph();

                p.setSpacingAfter(40);

                setJustified(p);

                XWPFRun run = p.createRun();

                run.setFontSize(10);

                run.setFontFamily("Arial");

                run.setText("▪ " + TailorResumeHtmlRenderer.normalizeBulletText(bullet));

            }

        }

    }



    private static void addSkillsBody(XWPFDocument doc, String body) {

        for (String line : body.split("\\r?\\n")) {

            String t = line.trim();

            if (t.isBlank()) continue;

            XWPFParagraph p = doc.createParagraph();

            p.setSpacingAfter(60);

            setJustified(p);
            int colon = t.indexOf(':');
            if (colon > 0) {
                XWPFRun label = p.createRun();
                label.setBold(true);
                label.setFontSize(10);
                label.setFontFamily("Arial");
                label.setText(t.substring(0, colon + 1));
                XWPFRun value = p.createRun();
                value.setFontSize(10);
                value.setFontFamily("Arial");
                value.setText(" " + t.substring(colon + 1).trim());
            } else {
                XWPFRun run = p.createRun();
                run.setFontSize(10);
                run.setFontFamily("Arial");
                run.setText(t);
            }

        }

    }



    private static void addJustifiedBody(XWPFDocument doc, String text) {

        for (String line : text.split("\\r?\\n")) {

            String t = line.trim();

            if (t.isBlank()) continue;

            XWPFParagraph p = doc.createParagraph();

            p.setSpacingAfter(80);

            setJustified(p);

            XWPFRun run = p.createRun();

            run.setFontSize(10);

            run.setFontFamily("Arial");

            if (t.startsWith("•") || t.startsWith("-") || t.startsWith("▪") || t.startsWith("#")) {

                run.setText("▪ " + TailorResumeHtmlRenderer.normalizeBulletText(t));

            } else {

                run.setText(t);

            }

        }

    }



    private static void addCenteredText(

            XWPFDocument doc, String text, int size, boolean bold, String color) {

        XWPFParagraph p = doc.createParagraph();

        p.setAlignment(ParagraphAlignment.CENTER);

        XWPFRun run = p.createRun();

        run.setFontSize(size);

        run.setFontFamily("Arial");

        run.setBold(bold);

        run.setColor(color);

        run.setText(text);

    }



    private static void addSectionHeading(XWPFDocument doc, String title) {

        XWPFParagraph p = doc.createParagraph();

        p.setSpacingBefore(200);

        XWPFRun run = p.createRun();

        run.setBold(true);

        run.setFontSize(12);

        run.setFontFamily("Arial");

        run.setText(title.toUpperCase(Locale.ROOT));

    }



    private static void setJustified(XWPFParagraph p) {

        p.setAlignment(ParagraphAlignment.BOTH);

        CTPPr ppr = p.getCTP().isSetPPr() ? p.getCTP().getPPr() : p.getCTP().addNewPPr();

        if (!ppr.isSetJc()) {

            ppr.addNewJc().setVal(STJc.BOTH);

        } else {

            ppr.getJc().setVal(STJc.BOTH);

        }

        if (!ppr.isSetInd()) {

            CTInd ind = ppr.addNewInd();

            ind.setLeft(BigInteger.valueOf(360));

        }

    }

}


