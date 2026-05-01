package com.careerops.repository;

import com.careerops.model.SharedNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SharedNoteRepository extends JpaRepository<SharedNote, UUID> {

    List<SharedNote> findByWorkspaceIdOrderByCreatedAtDesc(UUID workspaceId);

    List<SharedNote> findByWorkspaceIdAndTargetTypeAndTargetIdOrderByCreatedAtAsc(
            UUID workspaceId, String targetType, UUID targetId);

    @Query("""
        SELECT sn FROM SharedNote sn
        WHERE sn.workspaceId = :workspaceId
          AND sn.parentNoteId IS NULL
        ORDER BY sn.createdAt DESC
        """)
    List<SharedNote> findTopLevelNotesByWorkspace(@Param("workspaceId") UUID workspaceId);
}
