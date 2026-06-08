package com.careerops.service;

import com.careerops.dto.AuthDtos.WordCaptchaChallengeResponse;
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
        int idx = 0;
        while (true) {
            int start = svg.indexOf('>', idx);
            if (start < 0) break;
            int end = svg.indexOf("</text>", start);
            if (end < 0) break;
            String inner = svg.substring(start + 1, end).trim();
            if (inner.length() == 1) {
                answer.append(inner);
            }
            idx = end + 7;
        }
        return answer.toString();
    }
}
