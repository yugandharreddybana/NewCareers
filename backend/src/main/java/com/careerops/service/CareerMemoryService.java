package com.careerops.service;

import com.careerops.dto.CareerMemoryDtos.*;
import com.careerops.model.CareerMemory;
import com.careerops.exception.ApiException;
import com.careerops.model.CareerMemory;
import com.careerops.repository.CareerMemoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CareerMemoryService {

    private final CareerMemoryRepository memoryRepo;

    public CareerMemoryService(CareerMemoryRepository memoryRepo) {
        this.memoryRepo = memoryRepo;
    }

    public MemoryListResponse list(UUID userId) {
        List<MemoryResponse> items = memoryRepo
            .findByUserIdOrderByCategoryAscKeyAsc(userId)
            .stream().map(this::toResponse).toList();
        return new MemoryListResponse(items, items.size());
    }

    public MemoryListResponse listByCategory(UUID userId, String category) {
        List<MemoryResponse> items = memoryRepo
            .findByUserIdAndCategoryOrderByKeyAsc(userId, category)
            .stream().map(this::toResponse).toList();
        return new MemoryListResponse(items, items.size());
    }

    @Transactional
    public MemoryResponse upsert(UUID userId, UpsertMemoryRequest req) {
        CareerMemory m = memoryRepo.findByUserIdAndCategoryAndKey(userId, req.category(), req.key())
            .orElseGet(() -> CareerMemory.builder()
                .userId(userId)
                .category(req.category())
                .key(req.key())
                .build());
        m.setValue(req.value());
        if (req.source()        != null) m.setSource(req.source());
        if (req.whySuggested()  != null) m.setWhySuggested(req.whySuggested());
        if (req.confidence()    != null) m.setConfidence(req.confidence());
        return toResponse(memoryRepo.save(m));
    }

    @Transactional
    public MemoryResponse toggle(UUID userId, UUID id, ToggleMemoryRequest req) {
        CareerMemory m = find(userId, id);
        m.setMemoryEnabled(req.memoryEnabled());
        return toResponse(memoryRepo.save(m));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        find(userId, id);
        memoryRepo.deleteByIdAndUserId(id, userId);
    }

    @Transactional
    public void resetAll(UUID userId) {
        memoryRepo.deleteByUserId(userId);
    }

    /** Returns only enabled memories — used by skill prompts for personalisation. */
    public List<MemoryResponse> listEnabled(UUID userId) {
        return memoryRepo.findByUserIdAndMemoryEnabledTrueOrderByCategoryAscKeyAsc(userId)
            .stream().map(this::toResponse).toList();
    }

    /**
     * Upserts a memory entry on behalf of the AI (e.g. after a skill run).
     * Lower confidence than user-set entries; will not overwrite if already exists with higher confidence.
     */
    @Transactional
    public void extractFromSkillRun(UUID userId, String category, String key, String value,
                                    String source, short confidence) {
        memoryRepo.findByUserIdAndCategoryAndKey(userId, category, key)
            .ifPresentOrElse(
                existing -> {
                    if (existing.getConfidence() <= confidence) {
                        existing.setValue(value);
                        existing.setSource(source);
                        existing.setConfidence(confidence);
                        memoryRepo.save(existing);
                    }
                },
                () -> memoryRepo.save(CareerMemory.builder()
                    .userId(userId).category(category).key(key)
                    .value(value).source(source).confidence(confidence)
                    .whySuggested("Inferred from a skill run.").build())
            );
    }

    private CareerMemory find(UUID userId, UUID id) {
        return memoryRepo.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Memory not found"));
    }

    private MemoryResponse toResponse(CareerMemory m) {
        return new MemoryResponse(
            m.getId(), m.getCategory(), m.getKey(), m.getValue(),
            m.getSource(), m.getWhySuggested(), m.getConfidence(),
            m.isMemoryEnabled(), m.getCreatedAt(), m.getUpdatedAt()
        );
    }
}
