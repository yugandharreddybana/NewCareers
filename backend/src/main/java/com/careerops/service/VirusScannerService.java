package com.careerops.service;

import com.careerops.exception.ApiException;
import fi.solita.clamav.ClamAVClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

/**
 * Issue 2.050 — Virus Scanning Service.
 * Integrates with a ClamAV daemon (clamd) to scan uploaded files.
 */
@Service
@Slf4j
public class VirusScannerService {

    private final ClamAVClient client;
    private final boolean enabled;

    public VirusScannerService(
            @Value("${clamav.host:localhost}") String host,
            @Value("${clamav.port:3310}") int port,
            @Value("${clamav.timeout:5000}") int timeout,
            @Value("${clamav.enabled:false}") boolean enabled) {
        this.client = new ClamAVClient(host, port, timeout);
        this.enabled = enabled;
    }

    public void scan(MultipartFile file) {
        if (!enabled) {
            log.warn("Virus scanning is DISABLED. Skipping scan for: {}", file.getOriginalFilename());
            return;
        }
        try (InputStream is = file.getInputStream()) {
            scanInternal(is, file.getOriginalFilename());
        } catch (IOException e) {
            log.error("Failed to read file for virus scanning: {}", e.getMessage());
            throw com.careerops.exception.ApiException.internalError("File scan failure");
        }
    }

    public void scan(byte[] bytes, String originalFilename) {
        if (!enabled) {
            log.warn("Virus scanning is DISABLED. Skipping scan for: {}", originalFilename);
            return;
        }
        try (InputStream is = new java.io.ByteArrayInputStream(bytes)) {
            scanInternal(is, originalFilename);
        } catch (IOException e) {
            log.error("Failed to scan byte array for viruses: {}", e.getMessage());
            throw com.careerops.exception.ApiException.internalError("File scan failure");
        }
    }

    private void scanInternal(InputStream is, String filename) throws IOException {
        byte[] result = client.scan(is);
        if (!ClamAVClient.isCleanReply(result)) {
            String reply = new String(result).trim();
            log.error("VIRUS DETECTED in file {}: {}", filename, reply);
            throw new ApiException(
                org.springframework.http.HttpStatus.UNSUPPORTED_MEDIA_TYPE, // 415
                "Security violation: Virus detected in uploaded file"
            );
        }
    }
}
