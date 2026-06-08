package com.careerops.validation;

import com.careerops.dto.AuthDtos.GoogleAuthRequest;
import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleAuthConsentsValidatorTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    @DisplayName("rejects Google auth when consents omit terms acceptance")
    void rejectsMissingTermsWhenConsentsPresent() {
        GoogleAuthRequest request = new GoogleAuthRequest(
                "a".repeat(120),
                new SignupConsentsRequest(false, true, false, false),
                null);

        Set<ConstraintViolation<GoogleAuthRequest>> violations = validator.validate(request);

        assertThat(violations).isNotEmpty();
    }

    @Test
    @DisplayName("allows Google auth without consents for returning users")
    void allowsMissingConsents() {
        GoogleAuthRequest request = new GoogleAuthRequest("a".repeat(120), null, null);

        Set<ConstraintViolation<GoogleAuthRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }
}
