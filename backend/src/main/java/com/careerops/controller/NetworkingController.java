package com.careerops.controller;

import com.careerops.dto.NetworkingDtos.*;
import com.careerops.model.NetworkContact.ContactType;
import com.careerops.service.NetworkingService;
import com.careerops.util.AuthUtil;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Section 3.3 — Tasks 36, 37, 38 + expanded endpoints for full CRM UX.
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/networking")
@io.micrometer.core.annotation.Timed
public class NetworkingController {

    private final NetworkingService networkingService;
    private final com.careerops.service.VirusScannerService scanner;

    public NetworkingController(NetworkingService networkingService, com.careerops.service.VirusScannerService scanner) {
        this.networkingService = networkingService;
        this.scanner = scanner;
    }

    // ── Task 36 — Create contact ───────────────────────────────────────────────

    @PostMapping("/contact")
    public ContactResponse createContact(@RequestBody CreateContactRequest req) {
        return networkingService.createContact(AuthUtil.currentUserId(), req);
    }

    // ── Task 37 — List contacts ────────────────────────────────────────────────

    @GetMapping("/contacts")
    public ContactListResponse getContacts(
            @RequestParam(required = false) ContactType type) {
        return networkingService.getContacts(AuthUtil.currentUserId(), type);
    }

    // ── Get single contact detail ──────────────────────────────────────────────

    @GetMapping("/contact/{contactId}")
    public ContactResponse getContact(@PathVariable UUID contactId) {
        return networkingService.getContactDetail(AuthUtil.currentUserId(), contactId);
    }

    // ── Update pipeline stage ──────────────────────────────────────────────────

    @PatchMapping("/contact/{contactId}/stage")
    public ContactResponse updateStage(
            @PathVariable UUID contactId,
            @jakarta.validation.Valid @RequestBody UpdateStageRequest req) {
        return networkingService.updatePipelineStage(AuthUtil.currentUserId(), contactId, req.stage());
    }

    // ── Delete contact ─────────────────────────────────────────────────────────

    @DeleteMapping("/contact/{contactId}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void deleteContact(@PathVariable UUID contactId) {
        networkingService.deleteContact(AuthUtil.currentUserId(), contactId);
    }

    // ── Task 38 — Log interaction ──────────────────────────────────────────────

    @PostMapping("/contact/{contactId}/log-interaction")
    public InteractionResponse logInteraction(
            @PathVariable UUID contactId,
            @RequestBody LogInteractionRequest req) {
        return networkingService.logInteraction(AuthUtil.currentUserId(), contactId, req);
    }

    // ── Interaction history for a contact ─────────────────────────────────────

    @GetMapping("/contact/{contactId}/interactions")
    public List<InteractionResponse> getInteractions(@PathVariable UUID contactId) {
        return networkingService.getInteractionsForContact(AuthUtil.currentUserId(), contactId);
    }

    // ── Overdue follow-ups ─────────────────────────────────────────────────────

    @GetMapping("/contacts/overdue")
    public List<InteractionResponse> overdueFollowUps() {
        return networkingService.getOverdueFollowUps(AuthUtil.currentUserId());
    }

    // ── Task 43 — CSV import ────────────────────────────────────────────���──────

    @PostMapping("/contacts/import")
    public CsvImportResult importFromCsv(
            @RequestPart("file") MultipartFile file) throws IOException {
        scanner.scan(file); // 2.050 — Security: Scan for viruses before processing
        if (file.isEmpty()) {
            throw com.careerops.exception.ApiException.badRequest("Uploaded file is empty");
        }
        return networkingService.importContactsFromCsv(
                AuthUtil.currentUserId(), file.getInputStream());
    }
}
