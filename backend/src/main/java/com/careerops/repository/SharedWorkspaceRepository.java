package com.careerops.repository;

import com.careerops.model.SharedWorkspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SharedWorkspaceRepository extends JpaRepository<SharedWorkspace, UUID> {

    List<SharedWorkspace> findByOwnerId(UUID ownerId);

    @Query("""
        SELECT DISTINCT sw FROM SharedWorkspace sw
        LEFT JOIN WorkspaceMember wm ON wm.workspaceId = sw.id
        WHERE sw.ownerId = :userId
           OR (wm.userId = :userId AND wm.inviteStatus = 'accepted')
        ORDER BY sw.updatedAt DESC
        """)
    List<SharedWorkspace> findAllAccessibleByUser(@Param("userId") UUID userId);
}
