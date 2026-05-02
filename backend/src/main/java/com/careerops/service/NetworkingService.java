package com.careerops.service;

import com.careerops.dto.NetworkingDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.ContactInteraction;
import com.careerops.model.NetworkContact;
import com.careerops.model.NetworkContact.ContactPipelineStage;
import com.careerops.model.NetworkContact.ContactType;
import com.careerops.repository.ContactInteractionRepository;
import com.careerops.repository.NetworkContactRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Section 3.3 — Task 35 (expanded with delete, stage-update, detail lookup,
 * and per-contact interaction history for full CRM UX).
 */
@Service
public class NetworkingService {

    private static final Logger log = LoggerFactory.getLogger(NetworkingService.class);

    private final NetworkContactRepository contacts;
    private final ContactInteractionRepository interactions;
    private final AuditLogService audit;

    public NetworkingService(NetworkContactRepository contacts,
                             ContactInteractionRepository interactions,
                             AuditLogService audit) {
        this.contacts     = contacts;
        this.interactions = interactions;
        this.audit        = audit;
    }

    // ── Create contact ─────────────────────────────────────────────────────────

    @Transactional
    public ContactResponse createContact(UUID userId, CreateContactRequest req) {
        NetworkContact c = NetworkContact.builder()
                .userId(userId)
                .name(req.name())
                .email(req.email())
                .linkedinUrl(req.linkedinUrl())
                .company(req.company())
                .roleTitle(req.roleTitle())
                .contactType(req.contactType() != null ? req.contactType() : ContactType.recruiter)
                .relationshipTemperature(req.relationshipTemperature() != null
                        ? req.relationshipTemperature()
                        : NetworkContact.RelationshipTemperature.cold)
                .pipelineStage(req.pipelineStage() != null
                        ? req.pipelineStage()
                        : ContactPipelineStage.identified)
                .notes(req.notes())
                .linkedUserJobId(req.linkedUserJobId())
                .build();

        contacts.save(c);
        audit.log(userId, "NETWORKING_CONTACT_CREATED",
                Map.of("contactId", c.getId().toString(), "name", c.getName()));
        log.info("Contact created: {} for user {}", c.getId(), userId);
        return toResponse(c, null);
    }

    // ── Get contact detail ─────────────────────────────────────────────────────

    public ContactResponse getContactDetail(UUID userId, UUID contactId) {
        NetworkContact c = contacts.findByIdAndUserId(contactId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Contact not found"));
        List<ContactInteraction> ci =
                interactions.findByContactIdOrderByCreatedAtDesc(c.getId());
        InteractionSummary last = ci.isEmpty() ? null : toSummary(ci.get(0));
        return toResponse(c, last);
    }

    // ── List contacts (optionally filtered by type) ────────────────────────────

    public ContactListResponse getContacts(UUID userId, ContactType type) {
        List<NetworkContact> list = (type != null)
                ? contacts.findByUserIdAndContactTypeOrderByCreatedAtDesc(userId, type)
                : contacts.findByUserIdOrderByCreatedAtDesc(userId);

        List<ContactResponse> responses = list.stream()
                .map(c -> {
                    List<ContactInteraction> ci =
                            interactions.findByContactIdOrderByCreatedAtDesc(c.getId());
                    InteractionSummary last = ci.isEmpty() ? null : toSummary(ci.get(0));
                    return toResponse(c, last);
                })
                .toList();

        return new ContactListResponse(responses, responses.size());
    }

    // ── Update pipeline stage ──────────────────────────────────────────────────

    @Transactional
    public ContactResponse updatePipelineStage(UUID userId, UUID contactId,
                                                ContactPipelineStage newStage) {
        NetworkContact c = contacts.findByIdAndUserId(contactId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Contact not found"));
        c.setPipelineStage(newStage);
        contacts.save(c);
        audit.log(userId, "NETWORKING_STAGE_UPDATED",
                Map.of("contactId", contactId.toString(), "stage", newStage.name()));
        List<ContactInteraction> ci =
                interactions.findByContactIdOrderByCreatedAtDesc(c.getId());
        InteractionSummary last = ci.isEmpty() ? null : toSummary(ci.get(0));
        return toResponse(c, last);
    }

    // ── Delete contact ─────────────────────────────────────────────────────────

    @Transactional
    public void deleteContact(UUID userId, UUID contactId) {
        NetworkContact c = contacts.findByIdAndUserId(contactId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Contact not found"));
        interactions.deleteByContactId(contactId);
        contacts.delete(c);
        audit.log(userId, "NETWORKING_CONTACT_DELETED",
                Map.of("contactId", contactId.toString()));
        log.info("Contact deleted: {} by user {}", contactId, userId);
    }

    // ── Log interaction ────────────────────────────────────────────────────────

    @Transactional
    public InteractionResponse logInteraction(UUID userId, UUID contactId,
                                               LogInteractionRequest req) {
        NetworkContact contact = contacts.findByIdAndUserId(contactId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Contact not found"));

        ContactInteraction ci = ContactInteraction.builder()
                .contactId(contactId)
                .userId(userId)
                .interactionType(req.interactionType())
                .outcome(req.outcome())
                .notes(req.notes())
                .nextStep(req.nextStep())
                .nextStepDueDate(req.nextStepDueDate())
                .build();

        interactions.save(ci);
        advancePipelineStage(contact, ci);
        contacts.save(contact);

        audit.log(userId, "NETWORKING_INTERACTION_LOGGED",
                Map.of("contactId", contactId.toString(),
                        "type", req.interactionType().name()));
        return toInteractionResponse(ci);
    }

    // ── Interaction history for a contact ─────────────────────────────────────

    public List<InteractionResponse> getInteractionsForContact(UUID userId, UUID contactId) {
        contacts.findByIdAndUserId(contactId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Contact not found"));
        return interactions.findByContactIdOrderByCreatedAtDesc(contactId)
                .stream()
                .map(this::toInteractionResponse)
                .toList();
    }

    // ── Section 3.3 Task 43 — CSV import ──────────────────────────────────────
    // Expected header: name,email,company,role_title,contact_type,linkedin_url,notes
    // contact_type values: recruiter | hiring_manager | alumni | referral (defaults to recruiter)

    @Transactional
    public CsvImportResult importContactsFromCsv(UUID userId, InputStream csvStream) {
        int imported = 0;
        int skipped  = 0;
        List<String> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(csvStream, StandardCharsets.UTF_8))) {

            String header = reader.readLine();
            if (header == null) return new CsvImportResult(0, 0, List.of("File is empty"));

            String line;
            int rowNum = 1;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                line = line.trim();
                if (line.isEmpty()) { skipped++; continue; }

                String[] cols = splitCsvLine(line);
                String name = col(cols, 0);
                if (name.isEmpty()) {
                    errors.add("Row " + rowNum + ": name is required — skipped");
                    skipped++;
                    continue;
                }

                ContactType type;
                try {
                    String raw = col(cols, 4);
                    type = raw.isEmpty() ? ContactType.recruiter : ContactType.valueOf(raw.toLowerCase());
                } catch (IllegalArgumentException e) {
                    type = ContactType.recruiter;
                }

                NetworkContact c = NetworkContact.builder()
                        .userId(userId)
                        .name(name)
                        .email(col(cols, 1))
                        .company(col(cols, 2))
                        .roleTitle(col(cols, 3))
                        .contactType(type)
                        .linkedinUrl(col(cols, 5))
                        .notes(col(cols, 6))
                        .relationshipTemperature(NetworkContact.RelationshipTemperature.cold)
                        .pipelineStage(ContactPipelineStage.identified)
                        .build();

                contacts.save(c);
                imported++;
            }
        } catch (IOException e) {
            log.error("CSV import failed for user {}: {}", userId, e.getMessage());
            return new CsvImportResult(imported, skipped, List.of("Read error: " + e.getMessage()));
        }

        audit.log(userId, "NETWORKING_CSV_IMPORTED",
                Map.of("imported", String.valueOf(imported), "skipped", String.valueOf(skipped)));
        log.info("CSV import for user {}: {} imported, {} skipped", userId, imported, skipped);
        return new CsvImportResult(imported, skipped, errors);
    }

    private String col(String[] cols, int idx) {
        if (idx >= cols.length) return "";
        return cols[idx].trim().replaceAll("^\"|\"$", "");
    }

    private String[] splitCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder sb = new StringBuilder();
        for (char ch : line.toCharArray()) {
            if (ch == '"') { inQuotes = !inQuotes; }
            else if (ch == ',' && !inQuotes) { fields.add(sb.toString()); sb.setLength(0); }
            else { sb.append(ch); }
        }
        fields.add(sb.toString());
        return fields.toArray(new String[0]);
    }

    // ── Overdue follow-ups ─────────────────────────────────────────────────────

    public List<InteractionResponse> getOverdueFollowUps(UUID userId) {
        return interactions.findOverdueByUser(userId, LocalDate.now())
                .stream()
                .map(this::toInteractionResponse)
                .toList();
    }

    // ── Smart next-step suggestion ─────────────────────────────────────────────

    public String suggestNextStep(NetworkContact contact,
                                   List<ContactInteraction> history) {
        if (history.isEmpty()) {
            return "Send an initial LinkedIn connection request or personalised email.";
        }
        ContactInteraction last = history.get(0);
        return switch (last.getOutcome() != null ? last.getOutcome() :
                ContactInteraction.InteractionOutcome.no_response) {
            case no_response   -> "Follow up after 5–7 days with a brief, value-add message.";
            case positive      -> "Schedule a 15-minute coffee chat or virtual call.";
            case meeting_booked -> "Prepare for your meeting — research " +
                    (contact.getCompany() != null ? contact.getCompany() : "the company") +
                    " and prepare 3 talking points.";
            case negative      -> "Give space for 2–3 weeks before trying a different angle.";
        };
    }

    // ── Pipeline auto-advance ──────────────────────────────────────────────────

    private void advancePipelineStage(NetworkContact contact, ContactInteraction ci) {
        if (ci.getOutcome() == null) return;
        ContactPipelineStage current = contact.getPipelineStage();
        ContactPipelineStage next = switch (ci.getOutcome()) {
            case positive       -> advanceFrom(current);
            case meeting_booked -> ContactPipelineStage.meeting_scheduled;
            default             -> current;
        };
        contact.setPipelineStage(next);
    }

    private ContactPipelineStage advanceFrom(ContactPipelineStage stage) {
        return switch (stage) {
            case identified -> ContactPipelineStage.connected;
            case connected  -> ContactPipelineStage.outreached;
            case outreached -> ContactPipelineStage.replied;
            case replied    -> ContactPipelineStage.meeting_scheduled;
            default         -> stage;
        };
    }

    // ── Mappers ────────────────────────────────────────────────────────────────

    private ContactResponse toResponse(NetworkContact c, InteractionSummary last) {
        return new ContactResponse(
                c.getId(), c.getName(), c.getEmail(), c.getLinkedinUrl(),
                c.getCompany(), c.getRoleTitle(), c.getContactType(),
                c.getRelationshipTemperature(), c.getPipelineStage(),
                c.getNotes(), c.getLinkedUserJobId(),
                c.getCreatedAt(), c.getUpdatedAt(), last);
    }

    private InteractionSummary toSummary(ContactInteraction ci) {
        return new InteractionSummary(
                ci.getId(), ci.getInteractionType(), ci.getOutcome(),
                ci.getNextStep(), ci.getNextStepDueDate(), ci.getCreatedAt());
    }

    private InteractionResponse toInteractionResponse(ContactInteraction ci) {
        return new InteractionResponse(
                ci.getId(), ci.getContactId(), ci.getInteractionType(),
                ci.getOutcome(), ci.getNotes(), ci.getNextStep(),
                ci.getNextStepDueDate(), ci.getCreatedAt());
    }
}
