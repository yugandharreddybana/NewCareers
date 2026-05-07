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
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(CvParserService.class);

    public String extract(java.io.InputStream is, String contentType, String fileName) {
        try {
            String lc = (fileName == null ? "" : fileName.toLowerCase());
            if ((contentType != null && contentType.contains("pdf")) || lc.endsWith(".pdf")) {
                try (var doc = Loader.loadPDF(new org.apache.pdfbox.io.RandomAccessReadBuffer(is))) {
                    return new PDFTextStripper().getText(doc);
                }
            }
            if (lc.endsWith(".docx") || (contentType != null && contentType.contains("officedocument"))) {
                try (XWPFDocument doc = new XWPFDocument(is);
                     XWPFWordExtractor ex = new XWPFWordExtractor(doc)) {
                    return ex.getText();
                }
            }
            throw new com.careerops.exception.ApiException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Unsupported file type. Only PDF and DOCX are supported.");
        } catch (Exception e) {
            log.error("Failed to extract text from file '{}' (type={}): {}", fileName, contentType, e.getMessage());
            throw new com.careerops.exception.ApiException(
                    org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                    "Could not parse the document. Please ensure it is not password protected and is a valid PDF/DOCX file.");
        }
    }
}
