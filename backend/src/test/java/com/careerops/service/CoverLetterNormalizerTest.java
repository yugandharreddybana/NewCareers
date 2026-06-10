package com.careerops.service;

import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CoverLetterNormalizerTest {

    @Mock UserRepository users;
    @Mock UserProfileRepository profiles;

    private CoverLetterNormalizer normalizer;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        normalizer = new CoverLetterNormalizer(mapper, users, profiles);
    }

    @Test
    void normalize_replacesYourNamePlaceholder() {
        User user = new User();
        user.setName("Jane Doe");
        user.setEmail("jane@example.com");

        ObjectNode raw = mapper.createObjectNode();
        raw.put("letter", "Dear Manager,\n\nBody text.\n\nYours sincerely,\n[Your Name]");

        var out = normalizer.normalize(raw, normalizer.contextFor(user, null));

        assertThat(out.path("letter").asText()).contains("Jane Doe");
        assertThat(out.path("letter").asText()).doesNotContain("[Your Name]");
    }

    @Test
    void normalize_singleBlockWallOfText_splitsParagraphsAndReplacesPlaceholders() {
        User user = new User();
        user.setName("Yugesh Patel");

        UserProfile profile = new UserProfile();
        profile.setWorkExperience(List.of(
                UserProfile.WorkExperienceEntry.builder()
                        .companyName("Acme Corp")
                        .current(true)
                        .build()));

        String letter = "Dear Hiring Manager at TREQS, I am writing to express my interest in the Java "
                + "Software Engineer position. With over 5 years of experience I have delivered APIs. "
                + "Furthermore I led migrations at [Current Company]. Please do not hesitate to contact me. "
                + "Yours sincerely, [Your Name]";

        ObjectNode raw = mapper.createObjectNode();
        raw.put("letter", letter);

        var out = normalizer.normalize(raw, normalizer.contextFor(user, profile));
        String normalized = out.path("letter").asText();

        assertThat(normalized).contains("Dear Hiring Manager at TREQS,");
        assertThat(normalized.split("\\n\\n+").length).isGreaterThanOrEqualTo(3);
        assertThat(normalized).contains("Yugesh Patel");
        assertThat(normalized).contains("Acme Corp");
        assertThat(normalized).doesNotContain("[Your Name]");
        assertThat(normalized).doesNotContain("[Current Company]");
    }

    @Test
    void ensureParagraphBreaks_insertsBreaksForSingleBlock() {
        String letter = "Dear Hiring Manager at Acme, I have ten years of experience. "
                + "I built APIs at scale. Yours sincerely, Jane";
        String normalized = CoverLetterNormalizer.ensureParagraphBreaks(letter);
        assertThat(normalized).contains("\n\n");
        assertThat(normalized).startsWith("Dear Hiring Manager at Acme,");
        assertThat(normalized).contains("Yours sincerely,");
        assertThat(normalized).contains("Jane");
    }

    @Test
    void normalize_recomputesWordCount() {
        User user = new User();
        user.setName("Alex");

        ObjectNode raw = mapper.createObjectNode();
        raw.put("letter", "Dear Team,\n\nOne two three four.\n\nYours sincerely,\nAlex");
        raw.put("wordCount", 0);

        var out = normalizer.normalize(raw, normalizer.contextFor(user, null));

        assertThat(out.path("wordCount").asInt()).isGreaterThan(0);
    }

    @Test
    void resolveCandidateName_fallsBackToEmailLocalPart() {
        User user = new User();
        user.setEmail("alex.smith@example.com");

        assertThat(CoverLetterNormalizer.resolveCandidateName(user)).isEqualTo("alex smith");
    }

    @Test
    void normalizeForUser_loadsUserAndProfile() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setName("Sam Rivera");

        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());

        ObjectNode raw = mapper.createObjectNode();
        raw.put("letter", "Dear Team, Thanks for reading. Yours sincerely, [Your Name]");

        var out = normalizer.normalizeForUser(userId, raw);

        assertThat(out.path("letter").asText()).contains("Sam Rivera");
    }
}
