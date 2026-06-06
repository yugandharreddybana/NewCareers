package com.careerops.security;

import jakarta.servlet.http.HttpServletRequest;

final class ServletPathNormalizer {

    private ServletPathNormalizer() {
    }

    static String normalize(HttpServletRequest req) {
        String path = req.getServletPath();
        if (path == null || path.isEmpty()) {
            path = req.getRequestURI().substring(req.getContextPath().length());
        }
        if (path != null && path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return path;
    }
}
