# Signup + Onboarding pipeline documentation

Combined end-to-end reference for deferred email signup (`/signup`) and three-step onboarding (`/onboarding`) through first dashboard visit.

**Last updated:** June 2026 — includes CV AI parse (Nemotron fast tier, `enable_thinking=false`), `cvMarkdown` lifecycle, AI-only/regex modes, org provisioning at register, delivery normalization, and billing 402 handling.

## Artifacts

| File | Description |
|------|-------------|
| [signup-onboarding-pipeline.docx](./signup-onboarding-pipeline.docx) | Full pipeline reference with embedded sequence diagrams |
| [diagrams/](./diagrams/) | Mermaid source (`.mmd`) and rendered PNG exports |
| [../signup/PAGE.md](../signup/PAGE.md) | Concise signup page reference |
| [../onboarding/PAGE.md](../onboarding/PAGE.md) | Concise onboarding page reference |
| [../login/login-pipeline.docx](../login/login-pipeline.docx) | Login flow (Google entry to onboarding) |

## Regenerate

**Prerequisites:** Python 3 with `python-docx`; Node.js for Mermaid CLI.

```powershell
# 1. Render diagram PNGs from .mmd sources
powershell -ExecutionPolicy Bypass -File pagesflow/signup-onboarding/render_diagrams.ps1

# 2. Build the DOCX
python pagesflow/signup-onboarding/build_signup_onboarding_pipeline_docx.py
```

Or from the repo root on Unix:

```bash
cd pagesflow/signup-onboarding/diagrams
for f in *.mmd; do npx --yes @mermaid-js/mermaid-cli -i "$f" -o "${f%.mmd}.png" -b transparent -w 1400; done
python pagesflow/signup-onboarding/build_signup_onboarding_pipeline_docx.py
```

## Diagram index

| Diagram | Phase |
|---------|-------|
| `auth-layers` | Architecture stack (incl. NVIDIA, org provisioning, CV normalization) |
| `journey-overview` | End-to-end flow (cvMarkdown sessionStorage → DB at delivery) |
| `signup-phase0-route` … `signup-phase5-handoff` | Signup phases 0–5 |
| `onboarding-phase0-route` … `onboarding-phase7-redirect` | Onboarding phases 0–7 |

## Key flow facts (quick reference)

| Topic | Behaviour |
|-------|-----------|
| Account creation | Deferred until onboarding finish (`POST /auth/register`) |
| cvMarkdown at step 0 | API string + `careerops_onboarding_cv_draft` in sessionStorage — **no `.md` file on disk** |
| cvMarkdown in DB | Written at delivery `normalizing_cv` via `CvNormalizationService` |
| CV upload at finish | Original PDF/DOCX via `POST /profile/cv` |
| AI parse model | Fast tier `nvidia/nemotron-3-nano-30b-a3b`; `enable_thinking: false` for `onboarding-cv-parse` |
| AI timeout | Backend 60s default; frontend parse request 180s |
| Regex fallback | Controlled by `ONBOARDING_CV_REGEX_ENABLED` (default true) |
| Org at register | `OrgProvisioningService` — workspace + free subscription |

When signup or onboarding code changes, update the matching `.mmd` files, re-render PNGs, rebuild the DOCX, and sync [signup/PAGE.md](../signup/PAGE.md) and [onboarding/PAGE.md](../onboarding/PAGE.md).
