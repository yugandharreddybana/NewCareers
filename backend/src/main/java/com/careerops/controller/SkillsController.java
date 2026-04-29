package com.careerops.controller;

import com.careerops.dto.SkillDtos.*;
import com.careerops.service.SkillService;
import com.careerops.util.AuthUtil;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/skills")
public class SkillsController {

    private final SkillService skills;

    public SkillsController(SkillService s) { this.skills = s; }

    @PostMapping("/evaluate")
    public JsonNode evaluate(@RequestBody SkillRequest req) {
        return skills.evaluate(AuthUtil.currentUserId(), req.userJobId());
    }

    @PostMapping("/tailor-resume")
    public JsonNode tailor(@RequestBody SkillRequest req) {
        return skills.tailorResume(AuthUtil.currentUserId(), req.userJobId());
    }

    @PostMapping("/research")
    public JsonNode research(@RequestBody SkillRequest req) {
        return skills.researchCompany(AuthUtil.currentUserId(), req.userJobId());
    }

    @PostMapping("/outreach")
    public JsonNode outreach(@RequestBody OutreachRequest req) {
        return skills.draftOutreach(AuthUtil.currentUserId(), req.userJobId(),
            req.channel() == null ? "linkedin" : req.channel(),
            req.tone() == null ? "professional" : req.tone());
    }

    @PostMapping("/apply")
    public JsonNode apply(@RequestBody ApplyRequest req) {
        return skills.applyAssistant(AuthUtil.currentUserId(), req.userJobId(), req.step());
    }

    @PostMapping("/prep-interview")
    public JsonNode prep(@RequestBody SkillRequest req) {
        return skills.prepInterview(AuthUtil.currentUserId(), req.userJobId());
    }

    @PostMapping("/compare")
    public JsonNode compare(@RequestBody CompareRequest req) {
        return skills.compare(AuthUtil.currentUserId(), req.userJobIds());
    }

    @PostMapping("/triage")
    public JsonNode triage() {
        return skills.triage(AuthUtil.currentUserId());
    }

    @GetMapping("/last")
    public JsonNode last(@RequestParam UUID userJobId, @RequestParam String skill) {
        JsonNode out = skills.lastRun(AuthUtil.currentUserId(), userJobId, skill);
        return out;
    }
}
