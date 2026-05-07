package com.careerops.util;

import com.careerops.exception.ApiException;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public final class AuthUtil {
    private AuthUtil() {}

    public static UUID currentUserId() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            throw ApiException.unauthorized("Authentication required");
        }
        Object p = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (p == null) {
            throw ApiException.unauthorized("Authentication required");
        }
        if (p instanceof String s) {
            try {
                return UUID.fromString(s);
            } catch (IllegalArgumentException e) {
                throw ApiException.unauthorized("Invalid authentication principal format");
            }
        }
        if (p instanceof UUID u) {
            return u;
        }
        throw ApiException.unauthorized("Unsupported authentication principal type");
    }
}
