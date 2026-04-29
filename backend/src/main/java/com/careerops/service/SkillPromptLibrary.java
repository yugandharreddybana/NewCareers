package com.careerops.service;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@Service
public class SkillPromptLibrary {

    private static final String[] SKILLS = {
        "evaluate","tailor-resume","research","outreach",
        "apply","compare","triage","prep-interview"
    };

    private final Map<String,String> cache = new HashMap<>();

    public SkillPromptLibrary() {
        for (String s : SKILLS) {
            try {
                ClassPathResource res = new ClassPathResource("career-ops-skills/" + s + "/SKILL.md");
                try (InputStream in = res.getInputStream()) {
                    cache.put(s, new String(in.readAllBytes(), StandardCharsets.UTF_8));
                }
            } catch (Exception e) {
                cache.put(s, "You are a job-search assistant. Skill: " + s);
            }
        }
    }

    public String prompt(String skill) {
        return cache.getOrDefault(skill, "You are a helpful career assistant.");
    }
}
