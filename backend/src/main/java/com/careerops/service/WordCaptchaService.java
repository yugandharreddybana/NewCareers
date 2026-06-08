package com.careerops.service;

import com.careerops.dto.AuthDtos.WordCaptchaChallengeResponse;
import com.careerops.service.captcha.WordCaptchaStore;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Server-issued jumbled character CAPTCHA for login (no third-party widget).
 * Challenge answer is embedded only in the SVG image — never returned as JSON fields.
 */
@Service
public class WordCaptchaService {

    public static final int CODE_LENGTH = 5;

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final long TTL_SECONDS = 600;
    private static final String[] COLORS = {
        "#022c22", "#065f46", "#10b981", "#047857", "#374151", "#1f2937"
    };

    private final SecureRandom random = new SecureRandom();
    private final WordCaptchaStore store;

    public WordCaptchaService(WordCaptchaStore store) {
        this.store = store;
    }

    public WordCaptchaChallengeResponse createChallenge() {
        String plain = randomCode();
        List<Glyph> glyphs = jumble(plain);
        String expected = glyphs.stream().map(Glyph::character).reduce("", String::concat);

        String id = UUID.randomUUID().toString();
        store.put(id, expected, Instant.now().plusSeconds(TTL_SECONDS));

        return new WordCaptchaChallengeResponse(id, buildSvg(glyphs));
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
        return store.removeIfValid(challengeId)
                .map(expected -> expected.equalsIgnoreCase(answer))
                .orElse(false);
    }

    private List<Glyph> jumble(String plain) {
        List<Character> chars = new ArrayList<>();
        for (char c : plain.toCharArray()) {
            chars.add(c);
        }
        Collections.shuffle(chars, random);

        List<Glyph> out = new ArrayList<>(chars.size());
        for (char c : chars) {
            int rotate = random.nextInt(31) - 15;
            int translateY = random.nextInt(7) - 3;
            String color = COLORS[random.nextInt(COLORS.length)];
            out.add(new Glyph(String.valueOf(c), rotate, translateY, color));
        }
        return out;
    }

    private String buildSvg(List<Glyph> glyphs) {
        StringBuilder sb = new StringBuilder();
        sb.append("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"280\" height=\"56\" viewBox=\"0 0 280 56\" role=\"img\" aria-label=\"Security check\">");
        sb.append("<rect width=\"280\" height=\"56\" fill=\"#f9fafb\" rx=\"8\"/>");
        int x = 24;
        for (Glyph glyph : glyphs) {
            sb.append(String.format(
                    "<text x=\"%d\" y=\"34\" font-family=\"ui-monospace,monospace\" font-size=\"26\" font-weight=\"700\" fill=\"%s\" transform=\"rotate(%d %d 34) translate(0 %d)\">%s</text>",
                    x,
                    glyph.color(),
                    glyph.rotate(),
                    x,
                    glyph.translateY(),
                    escapeXml(glyph.character())));
            x += 46;
        }
        sb.append("</svg>");
        return sb.toString();
    }

    private static String escapeXml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return sb.toString();
    }

    private record Glyph(String character, int rotate, int translateY, String color) {}
}
