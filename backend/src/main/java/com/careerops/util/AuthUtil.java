package com.careerops.util;

import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public final class AuthUtil {
    private AuthUtil() {}

    public static UUID currentUserId() {
        Object p = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return UUID.fromString(p.toString());
    }
}
