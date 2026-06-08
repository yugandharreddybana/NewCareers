package com.careerops.validation;

import com.careerops.dto.AuthDtos.GoogleAuthRequest;
import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * When consents are supplied on Google sign-in, terms must be accepted.
 * New-user enforcement (non-null consents) remains in {@link com.careerops.service.AuthService}.
 */
public class GoogleAuthConsentsValidator implements ConstraintValidator<ValidGoogleAuthConsents, GoogleAuthRequest> {

    @Override
    public boolean isValid(GoogleAuthRequest request, ConstraintValidatorContext context) {
        if (request == null) {
            return true;
        }
        SignupConsentsRequest consents = request.consents();
        if (consents == null) {
            return true;
        }
        return Boolean.TRUE.equals(consents.termsAccepted());
    }
}
