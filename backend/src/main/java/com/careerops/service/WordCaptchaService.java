package com.careerops.service;

import com.careerops.dto.AuthDtos.WordCaptchaChallengeResponse;
import com.careerops.dto.AuthDtos.WordCaptchaLetter;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Server-issued jumbled character CAPTCHA for login (no third-party widget).
 */
@Service
public class WordCaptchaService {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 5;
    private static final long TTL_SECONDS = 600;
    private static final String[] COLORS = {
        "#022c22", "#065f46", "#10b981", "#047857", "#374151", "#1f2937"
    };

    private final SecureRandom random = new SecureRandom();
    private final Map<String, ChallengeEntry> challenges = new ConcurrentHashMap<>();

    public WordCaptchaChallengeResponse createChallenge() {
        purgeExpired();
        String plain = randomCode();
        List<WordCaptchaLetter> letters = jumble(plain);
        String expected = letters.stream().map(WordCaptchaLetter::character).reduce("", String::concat);

        String id = UUID.randomUUID().toString();
        challenges.put(id, new ChallengeEntry(expected, Instant.now().plusSeconds(TTL_SECONDS)));

        return new WordCaptchaChallengeResponse(id, letters);
    }

    public boolean verifyToken(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        int sep = token.indexOf(':');
        if (sep <= 0 || sep >= token.length() - 1) {
            return false;
        }
        String challengeId = token.substring(0, sep);
        String answer = token.substring(sep + 1).trim();
        return verifyAndConsume(challengeId, answer);
    }

    private boolean verifyAndConsume(String challengeId, String answer) {
        ChallengeEntry entry = challenges.remove(challengeId);
        if (entry == null || Instant.now().isAfter(entry.expiresAt())) {
            return false;
        }
        return entry.expected().equalsIgnoreCase(answer);
    }

    private List<WordCaptchaLetter> jumble(String plain) {
        List<Character> chars = new ArrayList<>();
        for (char c : plain.toCharArray()) {
            chars.add(c);
        }
        Collections.shuffle(chars, random);

        List<WordCaptchaLetter> out = new ArrayList<>(chars.size());
        for (char c : chars) {
            int rotate = random.nextInt(31) - 15;
            int translateY = random.nextInt(7) - 3;
            String color = COLORS[random.nextInt(COLORS.length)];
            out.add(new WordCaptchaLetter(String.valueOf(c), rotate, translateY, color));
        }
        return out;
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return sb.toString();
    }

    private void purgeExpired() {
        Instant now = Instant.now();
        challenges.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
    }

    private record ChallengeEntry(String expected, Instant expiresAt) {}
}
