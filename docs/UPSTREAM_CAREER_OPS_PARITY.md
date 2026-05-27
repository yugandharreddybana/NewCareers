# Plugin skill → SaaS parity

Fork: [yugandharreddybana/career-ops-plugin](https://github.com/yugandharreddybana/career-ops-plugin)  
Sync: `scripts/sync-career-ops-plugin.ps1` → `backend/src/main/resources/career-ops-skills/`

| Plugin skill | SaaS status | Notes |
|--------------|-------------|-------|
| evaluate | Shipped | `EvaluationReportV2` in `score_breakdown`; validator in delivery + skill path |
| tailor-resume | Shipped | Phase 1 agent loop + ATS refs |
| apply | Shipped | Phase 1 agent loop |
| outreach | Shipped | Phase 1 agent loop |
| research | Shipped | Phase 1 agent loop |
| prep-interview | Shipped | Bundled prompt + enhanced instructions |
| compare | Shipped | Phase 1 agent loop |
| triage | Shipped | Phase 1 agent loop |
| scan | Shipped | Phase 1 agent loop |
| track | Shipped | `CatalogSkillService` — Kanban-backed JSON summary |
| help | Shipped | `CatalogSkillService` — skill directory + next-step hint |
| salary-negotiation | Shipped | Phase 2 handler |
| culture-fit | Shipped | Phase 2 handler |
| linkedin-optimize | Shipped | Phase 2 handler |
| cover-letter | Shipped | Phase 2 handler |
| skills-gap-plan | Shipped | Phase 2 handler |
| setup | N/A (SaaS) | Replaced by onboarding + Account Settings |
| quick-eval | Partial | Full eval via daily delivery / evaluate skill |

Prompt layers: upstream GitHub → fork (`GITHUB_FORK_OWNER`) → classpath bundle → inline fallback.
