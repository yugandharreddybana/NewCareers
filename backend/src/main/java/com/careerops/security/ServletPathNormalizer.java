package com.careerops.security;

import jakarta.servlet.http.HttpServletRequest;

public final class ServletPathNormalizer {

    private ServletPathNormalizer() {
    }

    public static String normalize(HttpServletRequest req) {
        String path = req.getServletPath();
        if (path == null || path.isEmpty()) {
            path = req.getRequestURI().substring(req.getContextPath().length());
        }
        return normalizePath(path);
    }

    public static String normalizePath(String path) {
        if (path == null || path.isBlank()) {
            return "";
        }
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        // Browser /api/v1/* hits Java as servlet path /v1/* — align with /auth, /jobs, etc.
        if (path.startsWith("/v1/")) {
            path = path.substring(3);
        }
        return path;
    }
}
