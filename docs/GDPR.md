# GDPR implementation (internal reference)

## Lawful bases

| Consent type | Basis | Default for new users |
|--------------|-------|----------------------|
| ESSENTIAL | Contract / necessary processing | Required at signup |
| AI_PROCESSING | Explicit consent (Art. 6(1)(a)) | Unchecked until opt-in |
| MARKETING | Explicit consent | Unchecked until opt-in |
| ANALYTICS | Explicit consent | Unchecked until opt-in |

## Storage

- Append-only table: `careerops.user_consents`
- Audit action: `CONSENT_RECORDED` on every insert
- Legacy `users.ai_processing_consent` deprecated; authoritative source is `user_consents` rows with `consent_type = AI_PROCESSING`

## Enforcement

- **AI:** `UserConsentService.validateAiConsent()` on all LLM skill paths
- **Marketing:** digest/progress emails skip users without `MARKETING`
- **Analytics:** `analytics_events`, onboarding/feature events gated on `ANALYTICS`

## Data subject rights

| Right | Endpoint | Audit action |
|-------|----------|--------------|
| Access / portability | `GET /api/account/export` | `DATA_EXPORT_REQUESTED` |
| Erasure | `DELETE /api/account` or `POST /api/account/delete` | `GDPR_ERASURE_COMPLETE`, then `ACCOUNT_DELETED_GDPR` |
| Consent update | `POST /api/consents` | `CONSENT_RECORDED` |
| AI consent withdrawal (Art. 7(3)) | `DELETE /api/user/consent/ai` | `CONSENT_RECORDED` + `skill_runs` purge metadata |
| Read current consents | `GET /api/consents` | — |

Export payload (`my-data.json`): user (no password/google sub), profile, CV metadata + parsed text (no `fileData` bytes), full `user_jobs` rows, audit log entries, consent history, **`skill_runs`** (output JSON + `resumeHtml`), **`token_usage`** (feature, model, tokens, cost, date). Serialized via Jackson (`GdprExportService`).

## AI consent withdrawal

`DELETE /api/user/consent/ai` (`UserConsentController` → `UserConsentService.withdrawAiConsent`):

1. Appends an `AI_PROCESSING` row with `accepted = false` (idempotent if already withdrawn)
2. Syncs legacy `users.ai_processing_consent` column to `false`
3. Deletes `skill_runs` older than **30 days** for that user (`deleteByUserIdAndCreatedAtBefore`)
4. Returns `skillRunsDeleted` count to the client

Frontend: toggling AI processing **off** in `PrivacySettingsSection` calls `consentApi.withdrawAiConsent()` instead of `POST /consents`.

## Erasure procedure

`UserAnonymizationService.anonymizeAndDelete` immediately:

1. Revokes refresh tokens
2. Deletes all `user_cvs` rows and Supabase CV objects
3. Scrubs profile PII (location, target roles, tech stack, salary range, work experience, education, portfolio, goals)
4. Soft-deletes user row: `name` → Deleted User, `email` → `deleted_<uuid>@redacted.invalid`, clears password/google sub, sets `deleted_at`
5. **Hard-deletes AI personal data:** `skill_runs`, `ai_token_usage`, `career_memories`, `skill_conversations`
6. Logs `GDPR_ERASURE_COMPLETE` (cascade summary) then `ACCOUNT_DELETED_GDPR` with `deletedAt`
7. Nullifies `audit_logs.user_id` for that user
8. Purges remaining Supabase prefixes (application files)

Consent rows for **active** users are retained indefinitely as lawful evidence. After account erasure, consent rows are purged once the grace period below expires.

Networking/outreach rows remain linked to the anonymized UUID (identity unlinked from `users` / profile / CVs).

## Retention schedule

Nightly cleanup runs at **03:00 Europe/Dublin** via `CronJobService.runGdprRetentionCleanup`, logging a single `GDPR_RETENTION_CLEANUP` audit row with per-table delete counts.

| Data | Retention | Cleanup |
|------|-----------|---------|
| `audit_logs` | 12 months (365 days) | Daily 03:00 `GDPR_RETENTION_CLEANUP` |
| `password_resets` | 30 days | Same |
| `refresh_tokens` | Until `expires_at` | 02:00 purge + 03:00 pass (idempotent) |
| `user_consents` | 30 days after account `deleted_at` | Same |
| `skill_runs` (global) | 90 days (`created_at`) | Same — `deleteByCreatedAtBefore` |
| `skill_runs` (cache TTL) | 24h default; 48h for `tailor-resume` (`expires_at`) | `pruneExpiredSkillRuns` cron |
| `skill_runs` (on AI withdraw) | Purge rows older than 30 days | `withdrawAiConsent` |

Fetch-log pruning runs at **03:15** to avoid ShedLock collision with GDPR cleanup.

## Job evaluation cache

`AiEvalCacheService` in-memory light/deep eval cache is **disabled** (no-op stubs; TODO: DB/Redis). Feed and job-open evaluation rely on `user_jobs.score_breakdown` and `skill_runs` DB cache via `SkillRunRepository.findValidCachedRun`.

## Encryption at rest

Defense in depth uses **platform encryption** plus **application-layer AES** for selected PII columns.

### Application layer

- `APP_MASTER_KEK` wraps per-user DEKs in `user_keys.encrypted_dek`
- `APP_ENCRYPTION_KEY` — legacy global fallback
- Encrypted fields: `users.name`, `user_profiles.location`, `goal_title`, `goal_location`
- `email` remains plaintext for login lookups

### PostgreSQL (`pgcrypto`)

Flyway enables the extension on Postgres/Supabase:

- [`V64__database_hardening_and_constraints.sql`](../backend/src/main/resources/db/migration/V64__database_hardening_and_constraints.sql)
- [`V72__schema_comments_and_security_hardening.sql`](../backend/src/main/resources/db/migration/V72__schema_comments_and_security_hardening.sql)

### Supabase (managed Postgres)

Encrypt at Rest is enabled by default on Supabase projects (AES-256 at the storage layer).

## Processors (document in Privacy Policy)

- Anthropic, Google (Gemini), NVIDIA — AI inference
- Resend — transactional and marketing email
- Supabase — file storage

## Related docs

- [pagesflow/shared/gdpr-data-storage.md](../pagesflow/shared/gdpr-data-storage.md) — table-level technical reference
- [pagesflow/account-settings/PAGE.md](../pagesflow/account-settings/PAGE.md) — in-app privacy controls

## Out of scope (organizational)

- DPA execution with processors
- ICO registration
- DPIA document
- 72-hour breach notification runbook
