package com.careerops.controller;

import com.careerops.dto.NetworkingDtos.*;
import com.careerops.model.NetworkContact.ContactType;
import com.careerops.service.NetworkingService;
import com.careerops.util.AuthUtil;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Section 3.3 — Tasks 36, 37, 38
 *
 * POST   /networking/contact                        → create contact
 * GET    /networking/contacts                       → list contacts (optional ?type= filter)
 * POST   /networking/contact/{contactId}/log-interaction → log interaction
 * GET    /networking/contacts/overdue               → overdue follow-ups
 */
@RestController
@RequestMapping("/networking")
public class NetworkingController {

    private final NetworkingService networkingService;

    public NetworkingController(NetworkingService networkingService) {
        this.networkingService = networkingService;
    }

    // Task 36 — POST /networking/contact
    @PostMapping("/contact")
    public ContactResponse createContact(@RequestBody CreateContactRequest req) {
        return networkingService.createContact(AuthUtil.currentUserId(), req);
    }

    // Task 37 — GET /networking/contacts
    @GetMapping("/contacts")
    public ContactListResponse getContacts(
            @RequestParam(required = false) ContactType type) {
        return networkingService.getContacts(AuthUtil.currentUserId(), type);
    }

    // Task 38 — POST /networking/contact/{contactId}/log-interaction
    @PostMapping("/contact/{contactId}/log-interaction")
    public InteractionResponse logInteraction(
            @PathVariable UUID contactId,
            @RequestBody LogInteractionRequest req) {
        return networkingService.logInteraction(AuthUtil.currentUserId(), contactId, req);
    }

    // Bonus — GET /networking/contacts/overdue (used by dashboard nudges)
    @GetMapping("/contacts/overdue")
    public List<InteractionResponse> overdueFollowUps() {
        return networkingService.getOverdueFollowUps(AuthUtil.currentUserId());
    }
}
