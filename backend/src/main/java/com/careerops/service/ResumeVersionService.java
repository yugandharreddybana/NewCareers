package com.careerops.service;

import com.careerops.dto.ResumeVersionDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.ResumeVersion;
import com.careerops.repository.ResumeVersionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class ResumeVersionService {

    private final ResumeVersionRepository versionRepo;

    public ResumeVersionService(ResumeVersionRepository versionRepo) {
        this.versionRepo = versionRepo;
    }

    public ResumeVersionListResponse list(UUID userId) {
        List<ResumeVersionResponse> items = versionRepo
            .findByUserIdOrderByVersionNumberDesc(userId)
            .stream().map(this::toResponse).toList();
        return new ResumeVersionListResponse(items, items.size());
    }

    public ResumeVersionResponse get(UUID userId, UUID id) {
        return toResponse(find(userId, id));
    }

    @Transactional
    public ResumeVersionResponse create(UUID userId, CreateResumeVersionRequest req) {
        int nextVersion = versionRepo.countByUserId(userId) + 1;
        if (req.isActive()) {
            versionRepo.findByUserIdAndActiveTrue(userId)
                .ifPresent(v -> { v.setActive(false); versionRepo.save(v); });
        }
        ResumeVersion v = ResumeVersion.builder()
            .userId(userId)
            .name(req.name())
            .versionNumber(nextVersion)
            .source(req.source() != null ? req.source() : "manual")
            .roleTags(req.roleTags() != null ? req.roleTags() : new String[]{})
            .active(req.isActive())
            .favorite(req.isFavorite())
            .outcomeAssociation(req.outcomeAssociation())
            .bestForRoleType(req.bestForRoleType())
            .notes(req.notes())
            .build();
        return toResponse(versionRepo.save(v));
    }

    @Transactional
    public ResumeVersionResponse update(UUID userId, UUID id, UpdateResumeVersionRequest req) {
        ResumeVersion v = find(userId, id);
        if (req.name()               != null) v.setName(req.name());
        if (req.roleTags()           != null) v.setRoleTags(req.roleTags());
        if (req.isActive()           != null) {
            if (req.isActive()) {
                versionRepo.findByUserIdAndActiveTrue(userId)
                    .ifPresent(other -> {
                        if (!other.getId().equals(id)) {
                            other.setActive(false);
                            versionRepo.save(other);
                        }
                    });
            }
            v.setActive(req.isActive());
        }
        if (req.isFavorite()         != null) v.setFavorite(req.isFavorite());
        if (req.outcomeAssociation() != null) v.setOutcomeAssociation(req.outcomeAssociation());
        if (req.bestForRoleType()    != null) v.setBestForRoleType(req.bestForRoleType());
        if (req.notes()              != null) v.setNotes(req.notes());
        return toResponse(versionRepo.save(v));
    }

    @Transactional
    public ResumeVersionResponse recordOutcome(UUID userId, UUID id, RecordOutcomeRequest req) {
        ResumeVersion v = find(userId, id);
        v.setOutcomeAssociation(req.outcome());
        switch (req.outcome()) {
            case "interview" -> v.setInterviewCount(v.getInterviewCount() + 1);
            case "offer"     -> v.setOfferCount(v.getOfferCount() + 1);
        }
        v.setApplicationCount(v.getApplicationCount() + 1);
        return toResponse(versionRepo.save(v));
    }

    public CompareResponse compare(UUID userId, UUID leftId, UUID rightId) {
        ResumeVersionResponse left  = toResponse(find(userId, leftId));
        ResumeVersionResponse right = toResponse(find(userId, rightId));
        String rec;
        if (left.offerCount() > right.offerCount()) {
            rec = left.name() + " leads in offers (" + left.offerCount() + " vs " + right.offerCount() + "). Recommend using it for high-intent applications.";
        } else if (right.offerCount() > left.offerCount()) {
            rec = right.name() + " leads in offers (" + right.offerCount() + " vs " + left.offerCount() + "). Recommend using it for high-intent applications.";
        } else if (left.interviewCount() >= right.interviewCount()) {
            rec = left.name() + " has equal or more interviews. Use it as your primary version.";
        } else {
            rec = right.name() + " has more interviews. Consider switching to it as your primary.";
        }
        return new CompareResponse(left, right, rec);
    }

    public RecommendResponse recommend(UUID userId, String roleType) {
        List<ResumeVersion> versions = versionRepo.findByUserIdOrderByVersionNumberDesc(userId);
        ResumeVersion best = versions.stream()
            .filter(v -> roleType == null || roleType.isBlank()
                || roleType.equalsIgnoreCase(v.getBestForRoleType()))
            .max(Comparator.comparingInt(v ->
                v.getOfferCount() * 3 + v.getInterviewCount() * 2 + v.getApplicationCount()))
            .orElse(versions.isEmpty() ? null : versions.get(0));
        if (best == null) throw new ApiException(HttpStatus.NOT_FOUND, "No resume versions found");
        String reason = "Version " + best.getVersionNumber() + " (" + best.getName() + ") has the strongest outcome track record"
            + (best.getBestForRoleType() != null ? " for " + best.getBestForRoleType() + " roles" : "") + ".";
        return new RecommendResponse(toResponse(best), reason);
    }

    public void delete(UUID userId, UUID id) {
        ResumeVersion v = find(userId, id);
        versionRepo.delete(v);
    }

    private ResumeVersion find(UUID userId, UUID id) {
        return versionRepo.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Resume version not found"));
    }

    private ResumeVersionResponse toResponse(ResumeVersion v) {
        return new ResumeVersionResponse(
            v.getId(), v.getName(), v.getVersionNumber(), v.getSource(),
            v.getRoleTags(), v.isActive(), v.isFavorite(),
            v.getOutcomeAssociation(), v.getInterviewCount(),
            v.getApplicationCount(), v.getOfferCount(),
            v.getBestForRoleType(), v.getNotes(),
            v.getCreatedAt(), v.getUpdatedAt()
        );
    }
}
