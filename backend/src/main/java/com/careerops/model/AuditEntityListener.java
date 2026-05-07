package com.careerops.model;

import com.careerops.repository.AuditLogRepository;
import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.UUID;

@Component
public class AuditEntityListener {

    private static AuditLogRepository auditLogRepo;

    @Autowired
    public void setAuditLogRepository(AuditLogRepository repo) {
        auditLogRepo = repo;
    }

    @PostUpdate
    public void onPostUpdate(Object entity) {
        logEvent(entity, "UPDATE");
    }

    @PostRemove
    public void onPostRemove(Object entity) {
        logEvent(entity, "REMOVE");
    }

    private void logEvent(Object entity, String type) {
        if (auditLogRepo == null) return;
        try {
            String className = entity.getClass().getSimpleName();
            String action = className.toUpperCase() + "_" + type;
            UUID userId = null;
            UUID entityId = null;

            try {
                java.lang.reflect.Method getId = entity.getClass().getMethod("getId");
                Object idVal = getId.invoke(entity);
                if (idVal instanceof UUID) {
                    entityId = (UUID) idVal;
                }
            } catch (Exception ignored) {}

            try {
                java.lang.reflect.Method getUserId = entity.getClass().getMethod("getUserId");
                Object userVal = getUserId.invoke(entity);
                if (userVal instanceof UUID) {
                    userId = (UUID) userVal;
                }
            } catch (Exception ignored) {}

            AuditLog entry = AuditLog.builder()
                .userId(userId)
                .action(action)
                .metadata(Map.of(
                    "entity_type", className,
                    "entity_id", entityId != null ? entityId.toString() : "UNKNOWN",
                    "operation", type
                ))
                .build();

            auditLogRepo.save(entry);
        } catch (Exception ignored) {}
    }
}
