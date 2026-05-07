package com.careerops.controller;

import com.careerops.dto.WorkspaceDTO;
import com.careerops.service.WorkspaceService;
import com.careerops.util.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/workspaces")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    // Task 49 — POST /workspaces
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceDTO.WorkspaceResponse create(
            @jakarta.validation.Valid @RequestBody WorkspaceDTO.CreateRequest req) {
        UUID userId = AuthUtil.currentUserId();
        return workspaceService.createWorkspace(userId, req);
    }

    // GET /workspaces — list all accessible workspaces
    @GetMapping
    public List<WorkspaceDTO.WorkspaceResponse> listMine() {
        UUID userId = AuthUtil.currentUserId();
        return workspaceService.getMyWorkspaces(userId);
    }

    // Task 51 — GET /workspaces/:id
    @GetMapping("/{id}")
    public WorkspaceDTO.WorkspaceResponse get(
            @PathVariable UUID id) {
        UUID userId = AuthUtil.currentUserId();
        return workspaceService.getWorkspace(id, userId);
    }

    // Task 50 — POST /workspaces/:id/invite
    @PostMapping("/{id}/invite")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceDTO.MemberResponse invite(
            @PathVariable UUID id,
            @jakarta.validation.Valid @RequestBody WorkspaceDTO.InviteRequest req) {
        UUID userId = AuthUtil.currentUserId();
        return workspaceService.inviteMember(id, userId, req);
    }

    public record AcceptInviteRequest(
        @jakarta.validation.constraints.NotBlank(message = "token is required") String token
    ) {}

    // Accept invite via token
    @PostMapping("/invite/accept")
    public WorkspaceDTO.MemberResponse acceptInvite(
            @jakarta.validation.Valid @RequestBody AcceptInviteRequest req) {
        UUID userId = AuthUtil.currentUserId();
        return workspaceService.acceptInvite(req.token(), userId);
    }

    // Task 52 — POST /workspaces/:id/notes
    @PostMapping("/{id}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceDTO.NoteResponse addNote(
            @PathVariable UUID id,
            @jakarta.validation.Valid @RequestBody WorkspaceDTO.NoteRequest req) {
        UUID userId = AuthUtil.currentUserId();
        return workspaceService.addNote(id, userId, req);
    }

    // GET /workspaces/:id/notes
    @GetMapping("/{id}/notes")
    public List<WorkspaceDTO.NoteResponse> getNotes(
            @PathVariable UUID id) {
        UUID userId = AuthUtil.currentUserId();
        return workspaceService.getNotes(id, userId);
    }
}
