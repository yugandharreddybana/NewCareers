package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.dto.OrganizationDtos.*;
import com.careerops.model.*;
import com.careerops.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.security.MessageDigest;

@Service
public class OrgService {

    private final OrgRepository orgRepo;
    private final OrgMemberRepository memberRepo;
    private final OrgInvitationRepository inviteRepo;
    private final OrgTeamRepository teamRepo;
    private final SsoProviderRepository ssoRepo;
    private final UserRepository userRepo;

    public OrgService(OrgRepository orgRepo,
                      OrgMemberRepository memberRepo,
                      OrgInvitationRepository inviteRepo,
                      OrgTeamRepository teamRepo,
                      SsoProviderRepository ssoRepo,
                      UserRepository userRepo) {
        this.orgRepo   = orgRepo;
        this.memberRepo = memberRepo;
        this.inviteRepo = inviteRepo;
        this.teamRepo   = teamRepo;
        this.ssoRepo    = ssoRepo;
        this.userRepo   = userRepo;
    }

    // ── Organizations ──────────────────────────────────────────────────────────

    public OrgResponse createOrg(UUID userId, CreateOrgRequest req) {
        if (orgRepo.existsBySlug(req.slug())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Slug already taken");
        }
        Organization org = Organization.builder()
            .name(req.name())
            .slug(req.slug())
            .plan(req.plan() != null ? req.plan() : "starter")
            .domain(req.domain())
            .build();
        org = orgRepo.save(org);

        // creator becomes owner
        OrgMember owner = OrgMember.builder()
            .orgId(org.getId())
            .userId(userId)
            .role("owner")
            .build();
        memberRepo.save(owner);

        return toOrgResponse(org, 1);
    }

    public OrgListResponse listOrgsForUser(UUID userId) {
        List<OrgMember> memberships = memberRepo.findByUserId(userId);
        List<OrgResponse> orgs = memberships.stream()
            .map(m -> orgRepo.findById(m.getOrgId())
                .map(o -> toOrgResponse(o, memberRepo.countByOrgId(o.getId())))
                .orElse(null))
            .filter(Objects::nonNull)
            .toList();
        return new OrgListResponse(orgs, orgs.size());
    }

    public OrgResponse getOrg(UUID userId, UUID orgId) {
        requireMember(userId, orgId);
        Organization org = orgOrThrow(orgId);
        return toOrgResponse(org, memberRepo.countByOrgId(orgId));
    }

    public OrgResponse updateOrg(UUID userId, UUID orgId, UpdateOrgRequest req) {
        requireRole(userId, orgId, "admin", "owner");
        Organization org = orgOrThrow(orgId);
        if (req.name()      != null) org.setName(req.name());
        if (req.logoUrl()   != null) org.setLogoUrl(req.logoUrl());
        if (req.domain()    != null) org.setDomain(req.domain());
        if (req.seatLimit() != null) org.setSeatLimit(req.seatLimit());
        org = orgRepo.save(org);
        return toOrgResponse(org, memberRepo.countByOrgId(orgId));
    }

    public void deleteOrg(UUID userId, UUID orgId) {
        requireRole(userId, orgId, "owner");
        orgRepo.deleteById(orgId);
    }

    // ── Members ────────────────────────────────────────────────────────────────

    public List<OrgMemberResponse> listMembers(UUID userId, UUID orgId) {
        requireMember(userId, orgId);
        return memberRepo.findByOrgId(orgId).stream()
            .map(m -> {
                String name = "";
                String email = "";
                try {
                    @Nullable User u = userRepo.findById(m.getUserId()).orElse(null);
                    if (u != null) { name = u.getName(); email = u.getEmail(); }
                } catch (Exception ignored) {}
                return new OrgMemberResponse(m.getId(), m.getUserId(), m.getRole(),
                    m.getStatus(), m.getJoinedAt(), name, email);
            }).toList();
    }

    public void removeMember(UUID requesterId, UUID orgId, UUID memberId) {
        requireRole(requesterId, orgId, "admin", "owner");
        OrgMember m = memberRepo.findById(memberId)
            .filter(x -> x.getOrgId().equals(orgId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));
        if ("owner".equals(m.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot remove org owner");
        }
        memberRepo.delete(m);
    }

    public OrgMemberResponse updateMemberRole(UUID requesterId, UUID orgId, UUID memberId, String newRole) {
        requireRole(requesterId, orgId, "owner");
        OrgMember m = memberRepo.findById(memberId)
            .filter(x -> x.getOrgId().equals(orgId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));
        m.setRole(newRole);
        m = memberRepo.save(m);
        return new OrgMemberResponse(m.getId(), m.getUserId(), m.getRole(),
            m.getStatus(), m.getJoinedAt(), "", "");
    }

    // ── Invitations ────────────────────────────────────────────────────────────

    public InvitationResponse invite(UUID requesterId, UUID orgId, InviteRequest req) {
        requireRole(requesterId, orgId, "admin", "owner");
        if (inviteRepo.existsByOrgIdAndEmailAndStatus(orgId, req.email(), "pending")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Pending invitation already exists");
        }
        String token = generateToken();
        OrgInvitation inv = OrgInvitation.builder()
            .orgId(orgId)
            .invitedBy(requesterId)
            .email(req.email())
            .role(req.role() != null ? req.role() : "member")
            .tokenHash(hashToken(token))
            .expiresAt(Instant.now().plusSeconds(7 * 24 * 3600))
            .build();
        inv = inviteRepo.save(inv);
        return toInvitationResponse(inv);
    }

    public List<InvitationResponse> listInvitations(UUID userId, UUID orgId) {
        requireRole(userId, orgId, "admin", "owner");
        return inviteRepo.findByOrgId(orgId).stream()
            .map(this::toInvitationResponse).toList();
    }

    public OrgResponse acceptInvitation(UUID userId, String token) {
        OrgInvitation inv = inviteRepo.findByTokenHash(hashToken(token))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid invitation token"));
        if (!"pending".equals(inv.getStatus())) {
            throw new ResponseStatusException(HttpStatus.GONE, "Invitation already used or expired");
        }
        if (inv.getExpiresAt() != null && inv.getExpiresAt().isBefore(Instant.now())) {
            inv.setStatus("expired");
            inviteRepo.save(inv);
            throw new ResponseStatusException(HttpStatus.GONE, "Invitation expired");
        }
        if (!memberRepo.existsByOrgIdAndUserId(inv.getOrgId(), userId)) {
            OrgMember m = OrgMember.builder()
                .orgId(inv.getOrgId())
                .userId(userId)
                .role(inv.getRole())
                .build();
            memberRepo.save(m);
        }
        inv.setStatus("accepted");
        inviteRepo.save(inv);
        Organization org = orgOrThrow(inv.getOrgId());
        return toOrgResponse(org, memberRepo.countByOrgId(org.getId()));
    }

    public void revokeInvitation(UUID userId, UUID orgId, UUID invId) {
        requireRole(userId, orgId, "admin", "owner");
        OrgInvitation inv = inviteRepo.findById(invId)
            .filter(x -> x.getOrgId().equals(orgId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found"));
        inv.setStatus("revoked");
        inviteRepo.save(inv);
    }

    // ── Teams ──────────────────────────────────────────────────────────────────

    public TeamResponse createTeam(UUID userId, UUID orgId, CreateTeamRequest req) {
        requireRole(userId, orgId, "admin", "owner");
        if (teamRepo.existsByOrgIdAndName(orgId, req.name())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Team name already exists");
        }
        OrgTeam team = OrgTeam.builder()
            .orgId(orgId)
            .name(req.name())
            .description(req.description())
            .createdBy(userId)
            .build();
        team = teamRepo.save(team);
        return new TeamResponse(team.getId(), team.getName(), team.getDescription(), 0, team.getCreatedAt());
    }

    public List<TeamResponse> listTeams(UUID userId, UUID orgId) {
        requireMember(userId, orgId);
        return teamRepo.findByOrgId(orgId).stream()
            .map(t -> new TeamResponse(t.getId(), t.getName(), t.getDescription(), 0, t.getCreatedAt()))
            .toList();
    }

    public void deleteTeam(UUID userId, UUID orgId, UUID teamId) {
        requireRole(userId, orgId, "admin", "owner");
        teamRepo.deleteById(teamId);
    }

    // ── SSO ────────────────────────────────────────────────────────────────────

    public com.careerops.dto.SecurityDtos.SsoProviderResponse getSsoProvider(UUID userId, UUID orgId) {
        requireRole(userId, orgId, "admin", "owner");
        return ssoRepo.findFirstByOrgId(orgId)
            .map(s -> new com.careerops.dto.SecurityDtos.SsoProviderResponse(
                s.getId(), s.getProviderType(), s.getMetadataUrl(), s.isEnabled()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No SSO provider configured"));
    }

    public com.careerops.dto.SecurityDtos.SsoProviderResponse upsertSsoProvider(UUID userId, UUID orgId,
            com.careerops.dto.SecurityDtos.UpdateSsoProviderRequest req) {
        requireRole(userId, orgId, "admin", "owner");
        SsoProvider sso = ssoRepo.findFirstByOrgId(orgId).orElse(
            SsoProvider.builder().orgId(orgId).build());
        if (req.providerType() != null) sso.setProviderType(req.providerType());
        if (req.metadataUrl()  != null) sso.setMetadataUrl(req.metadataUrl());
        if (req.clientId()     != null) sso.setClientId(req.clientId());
        if (req.clientSecret() != null) sso.setClientSecret(req.clientSecret());
        sso.setEnabled(req.enabled());
        sso = ssoRepo.save(sso);
        return new com.careerops.dto.SecurityDtos.SsoProviderResponse(
            sso.getId(), sso.getProviderType(), sso.getMetadataUrl(), sso.isEnabled());
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private Organization orgOrThrow(UUID orgId) {
        return orgRepo.findById(orgId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
    }

    private void requireMember(UUID userId, UUID orgId) {
        if (!memberRepo.existsByOrgIdAndUserId(orgId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this organization");
        }
    }

    private void requireRole(UUID userId, UUID orgId, String... roles) {
        OrgMember m = memberRepo.findByOrgIdAndUserId(orgId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member"));
        Set<String> allowed = new HashSet<>(Arrays.asList(roles));
        if (!allowed.contains(m.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient permissions");
        }
    }

    private OrgResponse toOrgResponse(Organization org, int memberCount) {
        return new OrgResponse(org.getId(), org.getName(), org.getSlug(), org.getPlan(),
            org.getLogoUrl(), org.getDomain(), org.getSeatLimit(), memberCount, org.getCreatedAt());
    }

    private InvitationResponse toInvitationResponse(OrgInvitation inv) {
        return new InvitationResponse(inv.getId(), inv.getEmail(), inv.getRole(),
            inv.getStatus(), inv.getExpiresAt(), inv.getCreatedAt());
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(bytes.length * 2);
            for (byte value : bytes) {
                int unsigned = value & 0xff;
                builder.append(Character.forDigit(unsigned >> 4, 16));
                builder.append(Character.forDigit(unsigned & 0xf, 16));
            }
            return builder.toString();
        } catch (Exception exception) {
            throw new RuntimeException(exception);
        }
    }
}
