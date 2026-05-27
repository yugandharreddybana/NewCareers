# Job evaluation contract (EvaluationReportV2)

Stored in `user_jobs.score_breakdown` (JSONB). See `backend/src/main/java/com/careerops/service/EvaluationReportValidator.java` for server-side normalization.

- **schemaVersion:** `2`
- **applyScore:** 0–5 weighted mean of dimensions; apply gate at **4.0**
- **dimensions:** 10 keys (`role_fit`, `skills_match`, …) — see master plan
- **evaluationStatus:** `complete` | `partial` | `failed`

Legacy v1 rows without `schemaVersion` are displayed with a legacy badge in the UI.

**Producers:** `JobDeliveryService` (daily + onboarding), `SkillService` evaluate skill (`source: skill_evaluate`).

**Fixture:** `backend/src/test/resources/evaluation-v2-fixture.json` — used by `EvaluationReportValidatorTest`.

Plugin prompts: [yugandharreddybana/career-ops-plugin](https://github.com/yugandharreddybana/career-ops-plugin) (synced into `career-ops-skills/evaluate/SKILL.md` with appended V2 JSON schema).

Upstream reference: [santifer/career-ops](https://github.com/santifer/career-ops).
