package com.careerops.service;

import com.careerops.dto.OutreachDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.OutreachCampaign;
import com.careerops.model.OutreachMessage;
import com.careerops.model.OutreachSequence;
import com.careerops.repository.OutreachCampaignRepository;
import com.careerops.repository.OutreachMessageRepository;
import com.careerops.repository.OutreachSequenceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class OutreachCampaignService {

    private final OutreachCampaignRepository campaignRepo;
    private final OutreachSequenceRepository sequenceRepo;
    private final OutreachMessageRepository  messageRepo;

    public OutreachCampaignService(OutreachCampaignRepository campaignRepo,
                                   OutreachSequenceRepository sequenceRepo,
                                   OutreachMessageRepository messageRepo) {
        this.campaignRepo = campaignRepo;
        this.sequenceRepo = sequenceRepo;
        this.messageRepo  = messageRepo;
    }

    public CampaignListResponse list(UUID userId) {
        List<CampaignResponse> items = campaignRepo
            .findByUserIdOrderByCreatedAtDesc(userId)
            .stream().map(c -> toResponse(c, false)).toList();
        return new CampaignListResponse(items, items.size());
    }

    public CampaignResponse get(UUID userId, UUID id) {
        return toResponse(find(userId, id), true);
    }

    @Transactional
    public CampaignResponse create(UUID userId, CreateCampaignRequest req) {
        OutreachCampaign c = OutreachCampaign.builder()
            .userId(userId)
            .name(req.name())
            .campaignType(req.campaignType() != null ? req.campaignType() : "recruiter_outreach")
            .status("draft")
            .build();
        return toResponse(campaignRepo.save(c), false);
    }

    @Transactional
    public CampaignResponse launch(UUID userId, UUID id) {
        OutreachCampaign c = find(userId, id);
        if (!c.getStatus().equals("draft") && !c.getStatus().equals("paused")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Campaign cannot be launched in current state");
        }
        c.setStatus("active");
        // Mark all draft messages as scheduled
        List<OutreachMessage> msgs = messageRepo.findByCampaignIdOrderByCreatedAtDesc(id);
        for (OutreachMessage m : msgs) {
            if (m.getStatus().equals("draft")) m.setStatus("scheduled");
        }
        messageRepo.saveAll(msgs);
        c.setTargetCount(msgs.size());
        return toResponse(campaignRepo.save(c), true);
    }

    @Transactional
    public SequenceResponse addSequence(UUID userId, UUID campaignId, CreateSequenceRequest req) {
        find(userId, campaignId);
        OutreachSequence s = OutreachSequence.builder()
            .campaignId(campaignId)
            .userId(userId)
            .stepNumber(req.stepNumber())
            .delayDays(req.delayDays())
            .subjectTemplate(req.subjectTemplate())
            .bodyTemplate(req.bodyTemplate())
            .channel(req.channel() != null ? req.channel() : "linkedin")
            .build();
        return toSeqResponse(sequenceRepo.save(s));
    }

    @Transactional
    public MessageResponse addMessage(UUID userId, UUID campaignId, AddMessageRequest req) {
        find(userId, campaignId);
        OutreachMessage m = OutreachMessage.builder()
            .campaignId(campaignId)
            .sequenceId(req.sequenceId())
            .userId(userId)
            .contactName(req.contactName())
            .contactEmail(req.contactEmail())
            .contactLinkedin(req.contactLinkedin())
            .personalisedBody(req.personalisedBody())
            .status("draft")
            .build();
        return toMsgResponse(messageRepo.save(m));
    }

    @Transactional
    public MessageResponse updateMessageStatus(UUID userId, UUID messageId,
                                               UpdateMessageStatusRequest req) {
        OutreachMessage m = messageRepo.findByIdAndUserId(messageId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message not found"));
        m.setStatus(req.status());
        if (req.status().equals("sent"))    m.setSentAt(Instant.now());
        if (req.status().equals("replied")) m.setRepliedAt(Instant.now());
        m = messageRepo.save(m);

        // Update campaign counters
        OutreachCampaign c = campaignRepo.findByIdAndUserId(m.getCampaignId(), userId).orElse(null);
        if (c != null) {
            c.setSentCount((int) messageRepo.countByCampaignIdAndStatus(c.getId(), "sent"));
            c.setRepliedCount((int) messageRepo.countByCampaignIdAndStatus(c.getId(), "replied"));
            campaignRepo.save(c);
        }
        return toMsgResponse(m);
    }

    @Transactional
    public MessageResponse unsubscribeMessage(UUID userId, UUID messageId) {
        OutreachMessage m = messageRepo.findByIdAndUserId(messageId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Message not found"));
        m.setUnsubscribed(true);
        m.setStatus("bounced");
        return toMsgResponse(messageRepo.save(m));
    }

    public SendTimeSuggestionResponse getSendTimeSuggestion(UUID userId, UUID campaignId) {
        find(userId, campaignId);
        // Rule-based suggestion: Tuesday/Wednesday 10-11am gets highest reply rates
        return new SendTimeSuggestionResponse(
            "Tuesday or Wednesday",
            "10:00 – 11:00 AM recipient time zone",
            "Studies show mid-week morning outreach achieves 25-40% higher open rates for professional contacts."
        );
    }

    public void delete(UUID userId, UUID id) {
        OutreachCampaign c = find(userId, id);
        campaignRepo.delete(c);
    }

    private OutreachCampaign find(UUID userId, UUID id) {
        return campaignRepo.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Campaign not found"));
    }

    private CampaignResponse toResponse(OutreachCampaign c, boolean full) {
        List<SequenceResponse> seqs = full
            ? sequenceRepo.findByCampaignIdOrderByStepNumberAsc(c.getId()).stream().map(this::toSeqResponse).toList()
            : List.of();
        List<MessageResponse> msgs = full
            ? messageRepo.findByCampaignIdOrderByCreatedAtDesc(c.getId()).stream().map(this::toMsgResponse).toList()
            : List.of();
        double replyRate = c.getSentCount() > 0
            ? Math.round((c.getRepliedCount() * 100.0 / c.getSentCount()) * 10) / 10.0
            : 0.0;
        return new CampaignResponse(
            c.getId(), c.getName(), c.getCampaignType(), c.getStatus(),
            c.getTargetCount(), c.getSentCount(), c.getRepliedCount(), c.getPositiveCount(),
            replyRate, c.getCreatedAt(), seqs, msgs
        );
    }

    private SequenceResponse toSeqResponse(OutreachSequence s) {
        return new SequenceResponse(s.getId(), s.getStepNumber(), s.getDelayDays(),
            s.getSubjectTemplate(), s.getBodyTemplate(), s.getChannel());
    }

    private MessageResponse toMsgResponse(OutreachMessage m) {
        return new MessageResponse(
            m.getId(), m.getContactName(), m.getContactEmail(), m.getContactLinkedin(),
            m.getPersonalisedBody(), m.getStatus(), m.getScore(),
            m.isUnsubscribed(), m.getSendTimeHint(),
            m.getSentAt(), m.getRepliedAt(), m.getCreatedAt()
        );
    }
}
