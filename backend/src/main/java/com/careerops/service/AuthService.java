// NOTE: Add revokeAllTokensForUser(UUID userId) to your existing AuthService.
// This stub shows only the NEW method — merge it into the existing class body.
//
// If your AuthService already has a RefreshTokenRepository or blacklist mechanism,
// replace the body below with a call to that. The method is called by AccountController
// when a user deletes their account.

/*  ---- MERGE THIS METHOD INTO AuthService.java ----

    /**
     * Revokes / deletes all active refresh tokens for a user.
     * Called before account deletion so tokens can’t be replayed after the
     * user row is gone.
     *\/
    @Transactional
    public void revokeAllTokensForUser(UUID userId) {
        // If you use a refresh_tokens table:
        // refreshTokenRepository.deleteByUserId(userId);
        //
        // If you use a blacklist table:
        // tokenBlacklistRepository.blacklistAllForUser(userId);
        //
        // If tokens are stateless (no DB store), this is a no-op —
        // the account DELETE cascade is sufficient.
        try {
            refreshTokenRepository.deleteByUserId(userId);
        } catch (Exception e) {
            log.warn("revokeAllTokensForUser: could not revoke tokens for {} — {}",
                     userId, e.getMessage());
        }
    }

    ---- END MERGE ---- */

package com.careerops.service;
// This file is intentionally a merge-instruction stub.
// Do not replace AuthService.java wholesale — only add the method above.
