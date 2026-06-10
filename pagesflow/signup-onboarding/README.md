# Signup + Onboarding pipeline documentation

Combined end-to-end reference for deferred email signup (`/signup`) and three-step onboarding (`/onboarding`) through first dashboard visit.

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
| `auth-layers` | Architecture stack |
| `journey-overview` | End-to-end flow |
| `signup-phase0-route` … `signup-phase5-handoff` | Signup phases 0–5 |
| `onboarding-phase0-route` … `onboarding-phase7-redirect` | Onboarding phases 0–7 |

When signup or onboarding code changes, update the matching `.mmd` files, re-render PNGs, rebuild the DOCX, and sync [signup/PAGE.md](../signup/PAGE.md) and [onboarding/PAGE.md](../onboarding/PAGE.md).
