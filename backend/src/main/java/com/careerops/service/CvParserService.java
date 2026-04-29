package com.careerops.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;

@Service
public class CvParserService {
    public String extract(byte[] bytes, String contentType, String fileName) {
        try {
            String lc = (fileName == null ? "" : fileName.toLowerCase());
            if ((contentType != null && contentType.contains("pdf")) || lc.endsWith(".pdf")) {
                try (PDDocument doc = Loader.loadPDF(bytes)) {
                    return new PDFTextStripper().getText(doc);
                }
            }
            if (lc.endsWith(".docx") || (contentType != null && contentType.contains("officedocument"))) {
                try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes));
                     XWPFWordExtractor ex = new XWPFWordExtractor(doc)) {
                    return ex.getText();
                }
            }
        } catch (Exception ignored) {}
        return "";
    }
}
