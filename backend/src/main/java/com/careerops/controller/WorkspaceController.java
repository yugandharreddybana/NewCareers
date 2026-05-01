package com.careerops.controller;

import com.careerops.dto.WorkspaceDTO;
import com.careerops.service.WorkspaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    // Task 49 — POST /workspaces
    @PostMapping
    public ResponseEntity<WorkspaceDTO.WorkspaceResponse> create(
            @RequestBody WorkspaceDTO.CreateRequest req,
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workspaceService.createWorkspace(userId, req));
    }

    // GET /workspaces — list all accessible workspaces
    @GetMapping
    public ResponseEntity<List<WorkspaceDTO.WorkspaceResponse>> listMine(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(workspaceService.getMyWorkspaces(userId));
    }

    // Task 51 — GET /workspaces/:id
    @GetMapping("/{id}")
    public ResponseEntity<WorkspaceDTO.WorkspaceResponse> get(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(workspaceService.getWorkspace(id, userId));
    }

    // Task 50 — POST /workspaces/:id/invite
    @PostMapping("/{id}/invite")
    public ResponseEntity<WorkspaceDTO.MemberResponse> invite(
            @PathVariable UUID id,
            @RequestBody WorkspaceDTO.InviteRequest req,
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workspaceService.inviteMember(id, userId, req));
    }

    // Accept invite via token
    @PostMapping("/invite/accept")
    public ResponseEntity<WorkspaceDTO.MemberResponse> acceptInvite(
            @RequestParam String token,
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(workspaceService.acceptInvite(token, userId));
    }

    // Task 52 — POST /workspaces/:id/notes
    @PostMapping("/{id}/notes")
    public ResponseEntity<WorkspaceDTO.NoteResponse> addNote(
            @PathVariable UUID id,
            @RequestBody WorkspaceDTO.NoteRequest req,
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workspaceService.addNote(id, userId, req));
    }

    // GET /workspaces/:id/notes
    @GetMapping("/{id}/notes")
    public ResponseEntity<List<WorkspaceDTO.NoteResponse>> getNotes(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(workspaceService.getNotes(id, userId));
    }
}
