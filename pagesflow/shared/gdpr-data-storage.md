# GDPR data storage

How CareerOps stores personal data in PostgreSQL and object storage, and how that maps to GDPR requirements. This is the technical companion to the public [privacy policy](../privacy/PAGE.md) and the in-app controls on [account settings](../account-settings/PAGE.md).

**Schema:** all application tables live in PostgreSQL schema `careerops` (Flyway migrations under `backend/src/main/resources/db/migration/`).

**Last reviewed:** June 2026.

---

## GDPR principles → implementation

| GDPR principle | How CareerOps implements it |
|----------------|----------------------------|
| **Lawfulness & transparency** | Signup requires **ESSENTIAL** consent (Terms). Optional consents recorded at signup and in `/account`. Public policy at `/privacy`. |
| **Purpose limitation** | Data is collected for job search, CV management, AI career tools, and account operation — not repurposed without consent. |
| **Data minimisation** | Passwords stored as bcrypt hashes only. Export omits `password_hash`, `google_sub`, and raw CV bytes. OTPs stored hashed. |
| **Accuracy** | Users edit profile and preferences via `/account` and onboarding. |
| **Storage limitation** | Scheduled retention cleanup (audit logs, password-reset tokens, expired refresh tokens, consents for deleted users). Skill-run cache TTLs. |
| **Integrity & confidentiality** | Per-user AES-GCM field encryption for selected PII; TLS in transit; HMAC-signed API requests; role-based access. |
| **Accountability** | Append-only `user_consents` and `audit_logs`; export and deletion events audited. |

---

## Storage architecture

```mermaid
flowchart TB
    subgraph client [Browser]
        UI[React app]
        Cookie[co_session / co_refresh / co_csrf]
        Local[sessionStorage + cookie consent flags]
    end

    subgraph bff [Middleware BFF]
        MW[Express proxy + cookies]
    end

    subgraph backend [Java API]
        SVC[Services + JPA]
        ENC[FieldEncryptionListener]
        GDPR[GdprExportService / UserAnonymizationService]
    end

    subgraph data [Persistent stores]
        PG[(PostgreSQL careerops schema)]
        SB[(Supabase object storage)]
    end

    UI --> MW --> SVC
    SVC --> ENC --> PG
    SVC --> SB
    GDPR --> PG
    GDPR --> SB
```

| Store | What it holds | GDPR notes |
|-------|---------------|------------|
| **PostgreSQL `careerops`** | Users, profiles, jobs pipeline, consents, audit trail, AI run history, networking, etc. | Primary system of record. EU-hosted Postgres recommended for production (see privacy policy processors). |
| **Supabase Storage** | CV files, application assets, resume versions (when configured) | Purged on account deletion via `SupabaseStorageService.purgeUserFiles`. Metadata also in `user_cvs.storage_path`. |
| **Browser** | Access token (memory), refresh token (sessionStorage or HttpOnly cookie), pending signup, analytics cookie consent flag | Not server DB; cleared on sign-out. See [auth-infrastructure.md](./auth-infrastructure.md). |

---

## Personal data categories

### 1. Identity & authentication (`users`)

| Column | Personal data? | Storage treatment |
|--------|----------------|-------------------|
| `email`, `name`, `username` | Yes | `name` encrypted at rest (per-user DEK). Email/username plaintext for login lookup. |
| `password_hash` | Credential | bcrypt; never exported; cleared on deletion. |
| `google_sub` | Identifier | Cleared on deletion; never exported. |
| `failed_login_attempts`, `locked_until` | Security metadata | Retained while account active. |
| `email_verified_at`, `last_login_at`, `locale` | Account metadata | Exported; anonymized on deletion. |
| `deleted_at` | Erasure marker | Soft-delete: row kept, PII replaced (see erasure below). |

JPA hides soft-deleted users: `@SQLRestriction("deleted_at IS NULL")` on `User`.

### 2. Profile & preferences (`user_profiles`)

One row per user (`user_id` UNIQUE, `ON DELETE CASCADE`).

| Data | Format | Encryption |
|------|--------|------------|
| `location`, `goal_title`, `goal_location` | TEXT | AES-GCM per user |
| `target_roles`, `tech_stack`, `sectors`, `work_types` | `text[]` | Plaintext arrays |
| `work_experience`, `education`, `portfolio_items` | JSONB | Plaintext JSON |
| `salary_min`, `salary_max`, `min_match_percent`, visa flags | Scalar / boolean | Plaintext |
| `onboarded`, `experience_level`, availability | Flags / enums | Plaintext |

Profile PII is **scrubbed** on account deletion (location, roles, salary, work history, education, portfolio, goals).

### 3. CVs (`user_cvs`)

| Column | Notes |
|--------|-------|
| `file_name`, `parsed_text`, `cv_markdown`, `vector_json` | Derived personal data from uploaded CV |
| `storage_path` | Pointer to Supabase object |
| `file_data` | Legacy `bytea` fallback in dev; not included in GDPR export |

**Erasure:** all rows deleted; Supabase objects removed (`CvService.deleteAllForUser`).

### 4. Consent records (`user_consents`)

Append-only trail — **latest row per `consent_type` is authoritative**.

| `consent_type` | Required? | Withdrawable? | Governs |
|----------------|-----------|---------------|---------|
| `ESSENTIAL` | Yes (signup) | No (via API) | Terms of service / core processing |
| `AI_PROCESSING` | No (opt-in/out) | Yes | Skills, Gemini, Claude, NVIDIA agent calls |
| `MARKETING` | No | Yes | Marketing email |
| `ANALYTICS` | No | Yes | `analytics_events`, onboarding analytics |

Each row stores `version`, `accepted`, `accepted_at`, `ip_address`, `user_agent` for demonstrable consent.

Legacy `users.ai_processing_consent` is **deprecated** (V114); `user_consents` is source of truth.

### 5. Job pipeline (`user_jobs`, `jobs`)

| Table | Personal link |
|-------|---------------|
| `user_jobs` | `user_id`, `notes`, kanban state, match scores — linked to anonymized UUID after deletion |
| `jobs` | Mostly non-personal job listings (shared catalogue) |

### 6. AI & activity history

| Table | Content | Consent gate |
|-------|---------|--------------|
| `skill_runs` | AI skill outputs (JSON), TTL cache per skill | `AI_PROCESSING` |
| `analytics_events` | Event type + JSONB metadata | `ANALYTICS` |
| `onboarding_events` | Funnel telemetry | `ANALYTICS` |
| `ai_token_usage` | Token counts per run | Operational; tied to `user_id` |
| `memory_embeddings` | Agent memory vectors | `AI_PROCESSING` |

### 7. Networking & outreach

| Table | PII examples |
|-------|--------------|
| `network_contacts` | Contact name, email, LinkedIn, company |
| `contact_interactions` | Notes, interaction history |
| `outreach_*` | Campaign copy, message bodies |

These tables reference `user_id`. They are **not individually scrubbed** by the current erasure service; they remain attached to the anonymized account UUID. Identity fields in `users` / `user_profiles` / CVs are removed so the UUID alone is not relinkable to a living identity without other leaks.

### 8. Security & session artefacts

| Table | Purpose | Retention |
|-------|---------|-----------|
| `refresh_tokens` | Hashed refresh JWTs | Deleted when expired (nightly) or on logout / password change / account deletion |
| `password_resets` | Hashed reset tokens | 30 days, then cron purge |
| `email_verifications` | Hashed OTP, email, attempt counts | Short-lived; consumed rows inactive |
| `user_keys` | Wrapped per-user DEK | One row per user; retained with anonymized account |

### 9. Audit & compliance (`audit_logs`)

Stores `action`, `ip_address`, `user_agent`, JSONB `metadata`, optional `user_id`.

| Action examples | Meaning |
|-----------------|---------|
| `CONSENT_RECORDED` | Consent change |
| `DATA_EXPORT_REQUESTED` | Portability export |
| `ACCOUNT_DELETED_GDPR` | Erasure completed |
| `GDPR_RETENTION_CLEANUP` | Nightly retention job |

On erasure, historical rows are **detached**: `audit_logs.user_id` set to `NULL` (user reference removed, event retained).

---

## Encryption at rest

Per-user envelope encryption for selected PII fields:

```
APP_MASTER_KEK (env: app.master.kek)
    └── wraps DEK in user_keys.encrypted_dek (per user_id)
            └── encrypts users.name, user_profiles.location,
                user_profiles.goal_title, user_profiles.goal_location
```

| Component | File |
|-----------|------|
| JPA listener | `backend/.../persistence/FieldEncryptionListener.java` |
| Codec | `backend/.../security/AesGcmCodec.java` |
| Key provisioning | `backend/.../service/UserKeyService.java` |
| Migration (column widths) | `V115__widen_encrypted_pii_columns.sql` |
| Key table | `V116__user_keys.sql` |

Ciphertext is stored as Base64 in `TEXT` columns. Legacy global key fallback may apply to rows encrypted before per-user keys (see `AesFieldEncryptor`).

---

## Consent lifecycle

```mermaid
sequenceDiagram
    participant User
    participant Signup as Signup / Onboarding
    participant API as ConsentController
    participant SVC as UserConsentService
    participant DB as user_consents

    User->>Signup: Accept terms (+ optional AI / marketing / analytics)
    Signup->>SVC: recordSignupConsents()
    SVC->>DB: INSERT append-only rows (version, IP, UA)

    User->>API: POST /consents (toggle AI / marketing / analytics)
    API->>SVC: updateConsent()
    Note over SVC: ESSENTIAL cannot be withdrawn via API
    SVC->>DB: INSERT new row (latest wins)

    User->>API: Run AI skill
    API->>SVC: validateAiConsent()
    alt no AI_PROCESSING consent
        SVC-->>User: 403
    end
```

| Entry point | Service method |
|-------------|----------------|
| Email signup | `AuthService.register` → `recordSignupConsents` |
| Google signup | `AuthService.createGoogleUser` → `recordSignupConsents` |
| Account settings | `ConsentController` → `updateConsent` |
| AI skills | `UserConsentService.validateAiConsent` |
| Marketing email | `requireMarketingConsent` |
| Analytics | `hasAnalyticsConsent` / `requireAnalyticsConsent` |

Frontend: `frontend/src/components/gdpr/PrivacySettingsSection.tsx`  
API: `GET /consents`, `POST /consents` (proxied via middleware).

---

## Data subject rights (in-app)

| Right | GDPR article | User action | Backend |
|-------|--------------|-------------|---------|
| **Access / portability** | Art. 15, 20 | **Export my data** on `/account` | `GET /account/export` → `GdprExportService` |
| **Erasure** | Art. 17 | **Delete account** (password or Google re-auth) | `DELETE` or `POST /account/delete` → `UserAnonymizationService` |
| **Restrict processing** | Art. 18 | Turn off AI / marketing / analytics consents | `POST /consents` |
| **Object** | Art. 21 | Withdraw marketing / analytics | Same consent toggles |
| **Information** | Art. 13–14 | Read `/privacy` | Static legal page |

### Export contents (`my-data.json`)

Included: `UserExport` (no secrets), full `UserProfile`, CV metadata (`parsed_text`, `cv_markdown`, paths — **not** `file_data`), `user_jobs`, `audit_logs`, all `user_consents`.

Excluded: `password_hash`, `google_sub`, raw CV bytes.

### Erasure sequence

```mermaid
sequenceDiagram
    participant User
    participant Account as AccountController
    participant Anon as UserAnonymizationService
    participant Auth as AuthService
    participant CV as CvService
    participant Store as SupabaseStorage

    User->>Account: DELETE /account { password | idToken }
    Account->>Anon: anonymizeAndDelete(userId)
    Anon->>Auth: revokeAllTokensForUser
    Anon->>CV: deleteAllForUser (DB + storage paths)
    Anon->>Anon: scrubProfile (clear PII fields)
    Anon->>Anon: users.email → deleted_{uuid}@redacted.invalid
    Note over Anon: name → "Deleted User", clear password/google_sub, set deleted_at
    Anon->>Anon: audit_logs.nullifyUserId
    Anon->>Store: purgeUserFiles(userId prefix)
    Anon->>Anon: audit ACCOUNT_DELETED_GDPR
```

**Soft-delete model:** the `users` row is retained with pseudonymous identifiers for referential integrity. `@SQLRestriction` prevents the account from authenticating or appearing in normal queries.

---

## Retention schedule (automated)

Cron: `CronJobService.runGdprRetentionCleanup` — **03:00 Europe/Dublin** daily.

| Dataset | Retention | Mechanism |
|---------|-----------|-----------|
| `audit_logs` | **365 days** | `deleteByCreatedAtBefore` |
| `password_resets` | **30 days** | `deleteByCreatedAtBefore` |
| `refresh_tokens` | Until `expires_at` | `deleteByExpiresAtBefore` (+ logout paths) |
| `user_consents` for deleted users | **30 days** after `users.deleted_at` | `deleteForUsersDeletedBefore` |
| `skill_runs` | Skill-specific TTL (1–7 days) or none | `expires_at` on row |
| `email_verifications` | Until consumed / expired | Application logic |

Each cleanup run writes `GDPR_RETENTION_CLEANUP` to `audit_logs` with deletion counts.

---

## Tables linked to `user_id` (reference)

All foreign keys to `users(id)` use `ON DELETE CASCADE` where defined — relevant only on **hard** delete. Current erasure uses **soft delete**, so child rows typically remain unless explicitly removed by a service.

| Domain | Tables |
|--------|--------|
| Core | `user_profiles`, `user_jobs`, `user_cvs`, `user_consents`, `user_keys`, `refresh_tokens` |
| AI | `skill_runs`, `batch_skill_runs`, `memory_embeddings`, `ai_token_usage` |
| Career ops | `application_tasks`, `application_runs`, `resume_versions`, `resume_version_assets`, `job_watchlists`, `watchlist_runs` |
| Interviews | `interview_tracks`, `interview_sessions` |
| Networking | `network_contacts`, `contact_interactions`, `outreach_campaigns`, `outreach_messages`, `outreach_sequences` |
| Collaboration | `shared_workspaces`, `workspace_members`, `shared_notes` |
| Analytics | `analytics_events`, `onboarding_events`, `feature_adoption_events`, `weekly_progress_snapshots`, `user_streaks`, `daily_activity_log` |
| Other | `notifications`, `referrals`, `seen_jobs`, `experiment_assignments`, `deadline_events` |

**Non-personal / aggregate:** `jobs`, `permit_*`, `experiments`, `feature_flags`, `daily_fetch_log`.

---

## Environment variables (operators)

| Variable | Purpose |
|----------|---------|
| `APP_MASTER_KEK` / `app.master.kek` | Wraps per-user DEKs in `user_keys` |
| `APP_ENCRYPTION_KEY` | Legacy global encryption fallback |
| Supabase URL + service key | CV / asset storage and purge |
| `e2e.test.email` | Dev-only test account bypass (not production GDPR surface) |

See also [mandatory-fields.md](../mandatory-fields.md).

---

## Code map

| Concern | Path |
|---------|------|
| Export | `backend/.../service/GdprExportService.java`, `dto/GdprExportDtos.java` |
| Erasure | `backend/.../service/UserAnonymizationService.java` |
| Consent | `backend/.../service/UserConsentService.java`, `controller/ConsentController.java` |
| Account API | `backend/.../controller/AccountController.java` |
| Retention cron | `backend/.../service/CronJobService.java` |
| CV purge | `backend/.../service/CvService.java`, `SupabaseStorageService.java` |
| Migrations | `V113__user_consents.sql`, `V114__gdpr_ai_processing_consent.sql`, `V115__*`, `V116__user_keys.sql` |
| UI | `frontend/src/components/gdpr/PrivacySettingsSection.tsx` |
| Middleware proxy | `middleware/src/routes/account.routes.ts`, `consents.routes.ts` |

---

## Related docs

- [privacy/PAGE.md](../privacy/PAGE.md) — public-facing policy
- [account-settings/PAGE.md](../account-settings/PAGE.md) — export, consent toggles, delete account
- [signup/PAGE.md](../signup/PAGE.md) — signup consent capture
- [auth-infrastructure.md](./auth-infrastructure.md) — tokens and cookies
- [mandatory-fields.md](../mandatory-fields.md) — deployment configuration
