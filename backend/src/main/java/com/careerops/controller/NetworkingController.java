package com.careerops.controller;

import com.careerops.dto.NetworkingDtos.*;
import com.careerops.model.NetworkContact.ContactType;
import com.careerops.model.NetworkContact.ContactPipelineStage;
import com.careerops.service.NetworkingService;
import com.careerops.util.AuthUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Section 3.3 — Tasks 36, 37, 38 + expanded endpoints for full CRM UX.
 *
 * POST   /networking/contact                              → create contact
 * GET    /networking/contacts                             → list contacts (?type= filter)
 * GET    /networking/contact/{contactId}                  → get contact detail
 * PATCH  /networking/contact/{contactId}/stage            → update pipeline stage
 * DELETE /networking/contact/{contactId}                  → delete contact
 * POST   /networking/contact/{contactId}/log-interaction  → log interaction
 * GET    /networking/contacts/overdue                     → overdue follow-ups
 * GET    /networking/contact/{contactId}/interactions     → interaction history
 */
@RestController
@RequestMapping("/networking")
public class NetworkingController {

    private final NetworkingService networkingService;

    public NetworkingController(NetworkingService networkingService) {
        this.networkingService = networkingService;
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
            @RequestBody Map<String, String> body) {
        ContactPipelineStage stage = ContactPipelineStage.valueOf(body.get("stage"));
        return networkingService.updatePipelineStage(AuthUtil.currentUserId(), contactId, stage);
    }

    // ── Delete contact ─────────────────────────────────────────────────────────

    @DeleteMapping("/contact/{contactId}")
    public ResponseEntity<Void> deleteContact(@PathVariable UUID contactId) {
        networkingService.deleteContact(AuthUtil.currentUserId(), contactId);
        return ResponseEntity.noContent().build();
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
    public ResponseEntity<CsvImportResult> importFromCsv(
            @RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new CsvImportResult(0, 0, List.of("Uploaded file is empty")));
        }
        CsvImportResult result = networkingService.importContactsFromCsv(
                AuthUtil.currentUserId(), file.getInputStream());
        return ResponseEntity.ok(result);
    }
}
