package com.careerops.service.captcha;

import java.time.Instant;
import java.util.Optional;

/** Shared store for login word-CAPTCHA challenges (M-8). */
public interface WordCaptchaStore {

    void put(String challengeId, String expectedAnswer, Instant expiresAt);

    /** Removes and returns the expected answer if the challenge exists and is not expired. */
    Optional<String> removeIfValid(String challengeId);
}
