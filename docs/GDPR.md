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
- Legacy `users.ai_processing_consent` deprecated; use `AI_PROCESSING` rows

## Enforcement

- **AI:** `UserConsentService.validateAiConsent()` on all LLM skill paths
- **Marketing:** digest/progress emails skip users without `MARKETING`
- **Analytics:** `analytics_events`, onboarding/feature events gated on `ANALYTICS`

## Data subject rights

| Right | Endpoint | Audit action |
|-------|----------|--------------|
| Access / portability | `GET /api/account/export` | `DATA_EXPORT_REQUESTED` |
| Erasure | `DELETE /api/account` | `ACCOUNT_DELETED_GDPR` |
| Consent withdrawal | `POST /api/consents` | `CONSENT_RECORDED` |
| Read current consents | `GET /api/consents` | — |

Export payload (`my-data.json`): user (no password/google sub), profile, CV metadata + parsed text (no `fileData` bytes), full `user_jobs` rows, audit log entries, consent history. Serialized via Jackson.

## Erasure procedure

`UserAnonymizationService` immediately:

1. Revokes refresh tokens
2. Deletes all `user_cvs` rows and Supabase CV objects
3. Scrubs profile PII (location, target roles, tech stack, salary range, work experience, education, portfolio)
4. Soft-deletes user row: `name` → Deleted User, `email` → `deleted_<uuid>@redacted.invalid`, clears password/google sub, sets `deleted_at`
5. Logs `ACCOUNT_DELETED_GDPR` with `deletedAt` timestamp
6. Purges remaining Supabase prefixes (application files)
7. Nullifies `audit_logs.user_id` for that user

Consent rows for **active** users are retained indefinitely as lawful evidence. After account erasure, consent rows are purged once the grace period below expires.

## Retention schedule

Nightly cleanup runs at **03:00 Europe/Dublin** via `CronJobService.runGdprRetentionCleanup`, logging a single `GDPR_RETENTION_CLEANUP` audit row with per-table delete counts.

| Data | Retention | Cleanup |
|------|-----------|---------|
| `audit_logs` | 12 months (365 days) | Daily 03:00 `GDPR_RETENTION_CLEANUP` |
| `password_resets` | 30 days | Same |
| `refresh_tokens` | Until `expires_at` | 02:00 purge + 03:00 pass (idempotent) |
| `user_consents` | 30 days after account `deleted_at` | Same |

Fetch-log pruning was moved to **03:15** to avoid ShedLock collision with GDPR cleanup.

## Encryption at rest

Defense in depth uses **platform encryption** plus **application-layer AES** for selected PII columns.

### Application layer

- `APP_ENCRYPTION_KEY` (256-bit, Base64) drives `AesFieldEncryptor` / JPA `EncryptedStringConverter`.
- Encrypted fields: `users.name`, `user_profiles.location`, `goal_title`, `goal_location`.
- `email` remains plaintext for login lookups (hash-based search is a separate follow-up).

### PostgreSQL (`pgcrypto`)

Flyway enables the extension on Postgres/Supabase:

- [`V64__database_hardening_and_constraints.sql`](../backend/src/main/resources/db/migration/V64__database_hardening_and_constraints.sql)
- [`V72__schema_comments_and_security_hardening.sql`](../backend/src/main/resources/db/migration/V72__schema_comments_and_security_hardening.sql)

Used for `gen_random_uuid()` on older PG versions and available for future `pgp_sym_encrypt` column encryption if needed. Verify in SQL Editor:

```sql
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
```

### Supabase (managed Postgres)

- **Encrypt at Rest** is enabled by default on Supabase projects (AES-256 at the storage layer). Confirm under **Project Settings → Infrastructure** if auditing for compliance.
- No extra toggle is required for standard projects; rely on platform encryption for all table data not covered by app-layer AES.

### Self-hosted Postgres

Platform encryption is your responsibility:

- Prefer **Transparent Data Encryption (TDE)** where your Postgres distribution supports it, **or**
- Encrypt the underlying disk/volume (e.g. **AWS EBS encryption**, Azure disk encryption, LUKS on bare metal).
- Still run Flyway so `pgcrypto` is available; set `APP_ENCRYPTION_KEY` in the Java runtime the same as production.

## Processors (document in Privacy Policy)

- Anthropic, Google (Gemini), NVIDIA — AI inference
- Resend — transactional and marketing email
- Supabase — file storage

## Out of scope (organizational)

- DPA execution with processors
- ICO registration
- DPIA document
- 72-hour breach notification runbook
