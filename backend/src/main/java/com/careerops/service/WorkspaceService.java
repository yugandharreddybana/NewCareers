package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.dto.WorkspaceDTO;
import com.careerops.model.SharedNote;
import com.careerops.model.SharedWorkspace;
import com.careerops.model.WorkspaceMember;
import com.careerops.model.WorkspaceMember.InviteStatus;
import com.careerops.model.WorkspaceMember.Role;
import com.careerops.repository.SharedNoteRepository;
import com.careerops.repository.SharedWorkspaceRepository;
import com.careerops.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final SharedWorkspaceRepository workspaceRepo;
    private final WorkspaceMemberRepository memberRepo;
    private final SharedNoteRepository noteRepo;
    private final EmailService emailService;
    private final com.careerops.repository.OrgRepository orgRepo;
    private final com.careerops.repository.OrgMemberRepository orgMemberRepo;

    // ----------------------------------------------------------------
    // Task 49 — Create workspace
    // ----------------------------------------------------------------
    @Transactional(timeout = 10)
    public WorkspaceDTO.WorkspaceResponse createWorkspace(UUID ownerId, WorkspaceDTO.CreateRequest req) {
        // Find owner's primary organization to link
        @Nullable UUID orgId = orgMemberRepo.findByUserId(ownerId).stream()
                .filter(m -> "owner".equals(m.getRole()))
                .map(com.careerops.model.OrgMember::getOrgId)
                .findFirst()
                .orElse(null);

        SharedWorkspace ws = SharedWorkspace.builder()
                .ownerId(ownerId)
                .orgId(orgId)
                .name(req.getName())
                .description(req.getDescription())
                .build();
        ws = workspaceRepo.save(ws);

        // Auto-assign owner as a member
        WorkspaceMember ownerMember = WorkspaceMember.builder()
                .workspaceId(ws.getId())
                .userId(ownerId)
                .role(Role.owner)
                .inviteStatus(InviteStatus.accepted)
                .joinedAt(Instant.now())
                .build();
        memberRepo.save(ownerMember);

        return toWorkspaceResponse(ws, List.of(ownerMember));
    }

    // ----------------------------------------------------------------
    // Task 50 — Invite member (only owner can invite)
    // ----------------------------------------------------------------
    @Transactional(timeout = 10)
    public WorkspaceDTO.MemberResponse inviteMember(UUID workspaceId, UUID requestingUserId,
                                                     WorkspaceDTO.InviteRequest req) {
        assertOwner(workspaceId, requestingUserId);

        SharedWorkspace ws = workspaceRepo.findById(workspaceId)
                .orElseThrow(() -> new IllegalArgumentException("Workspace not found"));

        // 2.055 — Security: Check membership-quota / org plan
        if (ws.getOrgId() != null) {
            com.careerops.model.Organization organization = orgRepo.findById(ws.getOrgId()).orElse(null);
            if (organization != null) {
                int currentMembers = memberRepo.findByWorkspaceId(workspaceId).size();
                if (currentMembers >= organization.getSeatLimit()) {
                    throw new com.careerops.exception.ApiException(
                        HttpStatus.PAYMENT_REQUIRED, // 402
                        "Organization seat limit reached (" + organization.getSeatLimit() + "). Please upgrade your plan."
                    );
                }
            }
        }

        Role role = Role.valueOf(req.getRole());
        if (role == Role.owner) throw new IllegalArgumentException("Cannot assign owner role via invite.");

        String token = UUID.randomUUID().toString().replace("-", "");
        WorkspaceMember member = WorkspaceMember.builder()
                .workspaceId(workspaceId)
                .invitedEmail(req.getEmail())
                .role(role)
                .inviteStatus(InviteStatus.pending)
                .inviteToken(token)
                .inviteTokenExpiresAt(Instant.now().plus(72, ChronoUnit.HOURS))
                .build();
        member = memberRepo.save(member);

        // Task 58 — send email invite
        emailService.sendWorkspaceInvite(req.getEmail(), ws.getName(), role.name(), token);

        return toMemberResponse(member);
    }

    // ----------------------------------------------------------------
    // Accept invite via token
    // ----------------------------------------------------------------
    @Transactional(timeout = 10)
    public WorkspaceDTO.MemberResponse acceptInvite(String token, UUID acceptingUserId) {
        WorkspaceMember member = memberRepo.findByInviteToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired invite token."));

        if (member.getInviteTokenExpiresAt() != null && Instant.now().isAfter(member.getInviteTokenExpiresAt())) {
            throw new IllegalStateException("Invite token has expired.");
        }

        member.setUserId(acceptingUserId);
        member.setInviteStatus(InviteStatus.accepted);
        member.setJoinedAt(Instant.now());
        member.setInviteToken(null);
        member.setInviteTokenExpiresAt(null);
        member = memberRepo.save(member);
        return toMemberResponse(member);
    }

    // ----------------------------------------------------------------
    // Task 51 — Get workspace (access controlled)
    // ----------------------------------------------------------------
    public WorkspaceDTO.WorkspaceResponse getWorkspace(UUID workspaceId, UUID requestingUserId) {
        assertMember(workspaceId, requestingUserId);
        SharedWorkspace ws = workspaceRepo.findById(workspaceId)
                .orElseThrow(() -> new IllegalArgumentException("Workspace not found"));
        List<WorkspaceMember> members = memberRepo.findByWorkspaceId(workspaceId);
        return toWorkspaceResponse(ws, members);
    }

    // ----------------------------------------------------------------
    // Get all workspaces accessible to user
    // ----------------------------------------------------------------
    public List<WorkspaceDTO.WorkspaceResponse> getMyWorkspaces(UUID userId) {
        return workspaceRepo.findAllAccessibleByUser(userId).stream()
                .map(ws -> {
                    List<WorkspaceMember> members = memberRepo.findByWorkspaceId(ws.getId());
                    return toWorkspaceResponse(ws, members);
                })
                .collect(Collectors.toList());
    }

    // ----------------------------------------------------------------
    // Task 52 — Add shared note
    // ----------------------------------------------------------------
    @Transactional(timeout = 10)
    public WorkspaceDTO.NoteResponse addNote(UUID workspaceId, UUID authorId, WorkspaceDTO.NoteRequest req) {
        assertMember(workspaceId, authorId);
        SharedNote note = SharedNote.builder()
                .workspaceId(workspaceId)
                .authorId(authorId)
                .targetType(req.getTargetType())
                .targetId(req.getTargetId())
                .content(req.getContent())
                .parentNoteId(req.getParentNoteId())
                .resolved(false)
                .build();
        note = noteRepo.save(note);
        return toNoteResponse(note);
    }

    public List<WorkspaceDTO.NoteResponse> getNotes(UUID workspaceId, UUID requestingUserId) {
        assertMember(workspaceId, requestingUserId);
        return noteRepo.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId).stream()
                .map(this::toNoteResponse)
                .collect(Collectors.toList());
    }

    // ----------------------------------------------------------------
    // Access control helpers
    // ----------------------------------------------------------------
    private void assertOwner(UUID workspaceId, UUID userId) {
        memberRepo.findByWorkspaceIdAndUserId(workspaceId, userId)
                .filter(m -> m.getRole() == Role.owner)
                .orElseThrow(() -> new SecurityException("Only the workspace owner can perform this action."));
    }

    private void assertMember(UUID workspaceId, UUID userId) {
        boolean isMember = memberRepo.existsByWorkspaceIdAndUserIdAndInviteStatus(
                workspaceId, userId, InviteStatus.accepted);
        if (!isMember) throw new SecurityException("Access denied: not a workspace member.");
    }

    // ----------------------------------------------------------------
    // Mappers
    // ----------------------------------------------------------------
    private WorkspaceDTO.WorkspaceResponse toWorkspaceResponse(SharedWorkspace ws, List<WorkspaceMember> members) {
        return WorkspaceDTO.WorkspaceResponse.builder()
                .id(ws.getId())
                .ownerId(ws.getOwnerId())
                .name(ws.getName())
                .description(ws.getDescription())
                .createdAt(ws.getCreatedAt())
                .updatedAt(ws.getUpdatedAt())
                .members(members.stream().map(this::toMemberResponse).collect(Collectors.toList()))
                .build();
    }

    private WorkspaceDTO.MemberResponse toMemberResponse(WorkspaceMember m) {
        return WorkspaceDTO.MemberResponse.builder()
                .id(m.getId())
                .userId(m.getUserId())
                .invitedEmail(m.getInvitedEmail())
                .role(m.getRole().name())
                .inviteStatus(m.getInviteStatus().name())
                .joinedAt(m.getJoinedAt())
                .build();
    }

    private WorkspaceDTO.NoteResponse toNoteResponse(SharedNote n) {
        return WorkspaceDTO.NoteResponse.builder()
                .id(n.getId())
                .workspaceId(n.getWorkspaceId())
                .authorId(n.getAuthorId())
                .targetType(n.getTargetType())
                .targetId(n.getTargetId())
                .content(n.getContent())
                .parentNoteId(n.getParentNoteId())
                .resolved(n.getResolved())
                .createdAt(n.getCreatedAt())
                .updatedAt(n.getUpdatedAt())
                .build();
    }
}
