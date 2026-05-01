package com.careerops.repository;

import com.careerops.model.WorkspaceMember;
import com.careerops.model.WorkspaceMember.InviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, UUID> {

    List<WorkspaceMember> findByWorkspaceId(UUID workspaceId);

    Optional<WorkspaceMember> findByInviteToken(String token);

    Optional<WorkspaceMember> findByWorkspaceIdAndUserId(UUID workspaceId, UUID userId);

    boolean existsByWorkspaceIdAndUserIdAndInviteStatus(UUID workspaceId, UUID userId, InviteStatus status);
}
