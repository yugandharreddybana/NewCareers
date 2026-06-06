package com.careerops.service;

import com.careerops.dto.AuthDtos.WordCaptchaChallengeResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WordCaptchaServiceTest {

    private final WordCaptchaService service = new WordCaptchaService();

    @Test
    @DisplayName("createChallenge returns jumbled letters and verify accepts correct answer")
    void createAndVerify() {
        WordCaptchaChallengeResponse challenge = service.createChallenge();
        assertThat(challenge.challengeId()).isNotBlank();
        assertThat(challenge.letters()).hasSize(5);

        String answer = challenge.letters().stream()
                .map(l -> l.character())
                .reduce("", String::concat);

        String token = challenge.challengeId() + ":" + answer;
        assertThat(service.verifyToken(token)).isTrue();
        assertThat(service.verifyToken(token)).isFalse();
    }

    @Test
    @DisplayName("verify rejects wrong answer")
    void rejectsWrongAnswer() {
        WordCaptchaChallengeResponse challenge = service.createChallenge();
        String token = challenge.challengeId() + ":WRONG";
        assertThat(service.verifyToken(token)).isFalse();
    }
}
