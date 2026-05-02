package com.careerops.controller;

import com.careerops.dto.OutreachDtos.*;
import com.careerops.service.OutreachCampaignService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/outreach")
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
    public ResponseEntity<CampaignResponse> create(@RequestBody CreateCampaignRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.create(AuthUtil.currentUserId(), req));
    }

    @PostMapping("/campaigns/{id}/launch")
    public CampaignResponse launch(@PathVariable UUID id) {
        return service.launch(AuthUtil.currentUserId(), id);
    }

    @DeleteMapping("/campaigns/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(AuthUtil.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/campaigns/{id}/sequences")
    public SequenceResponse addSequence(@PathVariable UUID id,
                                        @RequestBody CreateSequenceRequest req) {
        return service.addSequence(AuthUtil.currentUserId(), id, req);
    }

    @PostMapping("/campaigns/{id}/messages")
    public ResponseEntity<MessageResponse> addMessage(@PathVariable UUID id,
                                                      @RequestBody AddMessageRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.addMessage(AuthUtil.currentUserId(), id, req));
    }

    @PatchMapping("/messages/{messageId}")
    public MessageResponse updateMessageStatus(@PathVariable UUID messageId,
                                               @RequestBody UpdateMessageStatusRequest req) {
        return service.updateMessageStatus(AuthUtil.currentUserId(), messageId, req);
    }
}
