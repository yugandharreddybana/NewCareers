package com.careerops.service;

import com.careerops.exception.ApiException;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Verifies Google Sign-In ID tokens from the frontend GIS / OAuth library.
 */
@Service
public class GoogleOAuthService {

    public record GoogleIdentity(
            String sub,
            String email,
            String name,
            boolean emailVerified
    ) {}

    private final GoogleIdTokenVerifier verifier;
    private final boolean enabled;

    public GoogleOAuthService(@Value("${google.oauth.client-id:}") String clientId) {
        String trimmed = clientId != null ? clientId.trim() : "";
        this.enabled = !trimmed.isBlank();
        this.verifier = new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance())
                .setAudience(Collections.singletonList(trimmed))
                .build();
    }

    public boolean isEnabled() {
        return enabled;
    }

    public GoogleIdentity verifyIdToken(String idToken) {
        if (!enabled) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Google Sign-In is not configured on the server");
        }
        if (idToken == null || idToken.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Google ID token is required");
        }
        try {
            GoogleIdToken token = verifier.verify(idToken);
            if (token == null) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid Google ID token");
            }
            GoogleIdToken.Payload payload = token.getPayload();
            String sub = payload.getSubject();
            String email = payload.getEmail();
            if (sub == null || sub.isBlank() || email == null || email.isBlank()) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Google token missing required claims");
            }
            Boolean verified = payload.getEmailVerified();
            if (verified == null || !verified) {
                throw new ApiException(HttpStatus.UNAUTHORIZED,
                        "Google account email is not verified");
            }
            String name = payload.get("name") != null ? payload.get("name").toString() : null;
            if (name == null || name.isBlank()) {
                name = email.split("@")[0];
            }
            return new GoogleIdentity(sub, email.toLowerCase(), name.trim(), true);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Could not verify Google ID token");
        }
    }
}
