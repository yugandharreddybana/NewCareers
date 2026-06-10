package com.careerops.service;

import com.careerops.dto.AuthDtos.WordCaptchaChallengeResponse;
import com.careerops.service.captcha.InMemoryWordCaptchaStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WordCaptchaServiceTest {

    private WordCaptchaService service;

    @BeforeEach
    void setUp() {
        service = new WordCaptchaService(new InMemoryWordCaptchaStore());
    }

    @Test
    @DisplayName("createChallenge returns SVG image without exposing answer in JSON")
    void createReturnsSvgOnly() {
        WordCaptchaChallengeResponse challenge = service.createChallenge();
        assertThat(challenge.challengeId()).isNotBlank();
        assertThat(challenge.imageSvg()).contains("<svg");
        assertThat(challenge.imageSvg()).contains("<text");
    }

    @Test
    @DisplayName("verify accepts answer embedded in SVG and rejects reuse")
    void verifyAndConsume() {
        WordCaptchaChallengeResponse challenge = service.createChallenge();
        String svg = challenge.imageSvg();
        String answer = extractAnswerFromSvg(svg);
        assertThat(answer).hasSize(WordCaptchaService.CODE_LENGTH);

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

    private static String extractAnswerFromSvg(String svg) {
        StringBuilder answer = new StringBuilder();
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("<text\\b[^>]*>([^<])</text>")
                .matcher(svg);
        while (matcher.find()) {
            answer.append(matcher.group(1));
        }
        return answer.toString();
    }
}
