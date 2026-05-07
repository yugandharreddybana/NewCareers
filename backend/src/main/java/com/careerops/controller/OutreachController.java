package com.careerops.controller;

import com.careerops.dto.OutreachDtos.*;
import com.careerops.service.OutreachCampaignService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/outreach")
@io.micrometer.core.annotation.Timed
public class OutreachController {

    private final OutreachCampaignService service;

    public OutreachController(OutreachCampaignService service) {
        this.service = service;
    }

    @GetMapping("/campaigns")
    public CampaignListResponse list() {
        return service.list(AuthUtil.currentUserId());
    }

    @GetMapping("/campaigns/{id}")
    public CampaignResponse get(@PathVariable UUID id) {
        return service.get(AuthUtil.currentUserId(), id);
    }

    @PostMapping("/campaigns")
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignResponse create(@RequestBody CreateCampaignRequest req) {
        return service.create(AuthUtil.currentUserId(), req);
    }

    @PostMapping("/campaigns/{id}/launch")
    public CampaignResponse launch(@PathVariable UUID id) {
        return service.launch(AuthUtil.currentUserId(), id);
    }

    /**
     * DELETE /outreach/campaigns/{id}
     * Deletes the named outreach campaign.
     * Note: Requires `confirm=true` query parameter for safety.
     */
    @DeleteMapping("/campaigns/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @RequestParam(required = false) Boolean confirm) {
        if (!Boolean.TRUE.equals(confirm)) {
            throw com.careerops.exception.ApiException.badRequest("Must confirm campaign deletion with ?confirm=true");
        }
        service.delete(AuthUtil.currentUserId(), id);
    }

    @PostMapping("/campaigns/{id}/sequences")
    public SequenceResponse addSequence(@PathVariable UUID id,
                                        @RequestBody CreateSequenceRequest req) {
        return service.addSequence(AuthUtil.currentUserId(), id, req);
    }

    @PostMapping("/campaigns/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse addMessage(@PathVariable UUID id,
                                                      @RequestBody AddMessageRequest req) {
        return service.addMessage(AuthUtil.currentUserId(), id, req);
    }

    @PatchMapping("/messages/{messageId}")
    public MessageResponse updateMessageStatus(@PathVariable UUID messageId,
                                               @RequestBody UpdateMessageStatusRequest req) {
        return service.updateMessageStatus(AuthUtil.currentUserId(), messageId, req);
    }

    @PatchMapping("/messages/{messageId}/unsubscribe")
    public MessageResponse unsubscribe(@PathVariable UUID messageId) {
        return service.unsubscribeMessage(AuthUtil.currentUserId(), messageId);
    }

    @GetMapping("/campaigns/{id}/send-time")
    public SendTimeSuggestionResponse getSendTime(@PathVariable UUID id) {
        return service.getSendTimeSuggestion(AuthUtil.currentUserId(), id);
    }
}
