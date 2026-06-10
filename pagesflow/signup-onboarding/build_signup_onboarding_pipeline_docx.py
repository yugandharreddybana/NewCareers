#!/usr/bin/env python3
"""Generate signup-onboarding-pipeline.docx from structured content and diagram PNGs."""
from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

BASE = Path(__file__).resolve().parent
DIAGRAMS = BASE / "diagrams"
OUT = BASE / "signup-onboarding-pipeline.docx"


def add_title(doc: Document, text: str, level: int = 1) -> None:
    doc.add_heading(text, level=level)


def add_para(doc: Document, text: str, bold: bool = False) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    if bold:
        run.bold = True


def add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def add_table(doc: Document, headers: list[str], rows: list[list[str]]) -> None:
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for p in hdr[i].paragraphs:
            for r in p.runs:
                r.bold = True
    for ri, row in enumerate(rows):
        cells = table.rows[ri + 1].cells
        for ci, val in enumerate(row):
            cells[ci].text = val
    doc.add_paragraph()


def add_diagram(doc: Document, title: str, png_name: str, caption: str | None = None) -> None:
    add_title(doc, title, level=2)
    png = DIAGRAMS / png_name
    if png.exists():
        doc.add_picture(str(png), width=Inches(6.5))
        last = doc.paragraphs[-1]
        last.alignment = WD_ALIGN_PARAGRAPH.CENTER
    else:
        add_para(doc, f"[Diagram missing: {png_name}]", bold=True)
    if caption:
        cap = doc.add_paragraph(caption)
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in cap.runs:
            r.italic = True
            r.font.size = Pt(9)
            r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
    doc.add_paragraph()


def build() -> None:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    title = doc.add_heading("CareerOps Signup + Onboarding Pipeline — Complete Reference", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph(
        "End-to-end documentation for deferred email signup (/signup) and three-step onboarding "
        "(/onboarding) through first dashboard visit (/dashboard?welcome=1). Covers the Google "
        "shortcut entry path, all validation rules, HTTP errors, sessionStorage handoff, email OTP "
        "verification, account registration on finish, CV AI parse, and job delivery polling/SSE."
    )

    # ── Part C intro: journey ──
    add_title(doc, "0. End-to-End Journey Overview", 1)
    add_diagram(
        doc,
        "0.1 Full journey",
        "journey-overview.png",
        "Signup → Onboarding (3 steps) → Email OTP (deferred only) → Register → Job delivery → Dashboard",
    )
    add_title(doc, "0.2 Scenario matrix", 2)
    add_table(
        doc,
        ["Scenario", "Entry", "OTP", "Register at finish", "Outcome"],
        [
            ["Happy path email", "/signup", "Yes", "Yes", "Dashboard + welcome=1"],
            ["Duplicate email decoy", "/signup", "Yes", "Fails at register", "Generic error at finish; intent was never stored"],
            ["Tab closed mid-flow", "any", "—", "—", "Must restart from /signup"],
            ["Session expired", "onboarding", "—", "—", "/signup?reason=session_expired"],
            ["Google new user", "/login", "No", "No (already authed)", "Dashboard after delivery"],
            ["Delivery timeout", "finish", "—", "Profile saved", "Toast + continue to dashboard"],
            ["Plan limit 402", "delivery start", "—", "Profile saved", "Upgrade toast; billing redirect intended"],
            ["CV parse AI fallback", "step 0", "—", "—", "Regex parse + warning toast"],
        ],
    )

    # ── 1. Architecture ──
    add_title(doc, "1. Architecture Overview", 1)
    add_para(
        doc,
        "Four layers: React UI (Signup.tsx, Onboarding.tsx), Axios HTTP client with CSRF, Express "
        "middleware BFF (auth.routes.ts, onboarding.routes.ts), and Spring Boot backend "
        "(SignupIntentService, OnboardingEmailVerificationService, OnboardingCvParseService, "
        "OnboardingDeliveryService, AuthService.register). Deferred signup stores credentials "
        "server-side as a signup intent; the frontend only holds intent id + consents in sessionStorage.",
    )
    add_diagram(doc, "1.1 Auth stack layers", "auth-layers.png", "Frontend → Middleware BFF → Java backend with HMAC trust boundary")

    # ── Part A: Signup ──
    add_title(doc, "Part A — Signup (/signup)", 1)

    add_title(doc, "2. Signup Route and Access Control", 1)
    add_table(
        doc,
        ["Property", "Value"],
        [
            ["URL", "/signup (canonical); /register redirects here"],
            ["Guard", "GuestRoute"],
            ["Layout", "Standalone (SignupPageShell)"],
            ["Redirects (logged-in)", "onboarded → /dashboard; not onboarded → /onboarding"],
        ],
    )
    add_title(doc, "2.1 Query parameters", 2)
    add_table(
        doc,
        ["Param", "Effect"],
        [
            ["?reason=session_expired", "Clears tokens, co_pending_signup_v2, co_onboarding_verification_v2; logout; shows banner"],
        ],
    )

    add_title(doc, "3. Signup Fields, Validation, and Consents", 1)
    add_table(
        doc,
        ["Field", "Required", "Validation", "When shown"],
        [
            ["Full name", "Yes", "Non-empty trim", "Always"],
            ["Email", "Yes", "HTML5 email; trimmed on submit", "Always"],
            ["Password", "Yes", "Min 8; upper+lower+digit; HIBP server check", "Always"],
            ["Terms + Privacy", "Yes", "termsAccepted must be true", "Always"],
            ["AI processing consent", "Yes", "Required for CV parse during onboarding", "Always"],
            ["Marketing emails", "No", "Optional", "Always"],
            ["Analytics consent", "No", "Optional; also written to cookie consent", "Always"],
            ["reCAPTCHA", "Conditional", "Required when VITE_RECAPTCHA_SITE_KEY set", "When CAPTCHA_ENABLED"],
        ],
    )
    add_title(doc, "3.1 Password strength (client indicator)", 2)
    add_bullets(
        doc,
        [
            "Too short (<8), Weak (pattern fail), Fair/Good/Strong (pattern pass) — only acceptable passwords submit.",
            "Server pattern: ^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$ plus HIBP pwned-password check.",
            "Pwned password → 400: This password is not secure enough. HIBP down (prod) → 503.",
        ],
    )
    add_title(doc, "3.2 Duplicate email (anti-enumeration)", 2)
    add_bullets(
        doc,
        [
            "If email already registered, SignupIntentService returns HTTP 200 with a random decoy UUID (never persisted).",
            "UI navigates to onboarding identically; registration fails later at finish when intent is consumed.",
            "Logs SIGNUP_INTENT_DECOY server-side. Frontend mapSignupIntentError still handles 409 if ever returned elsewhere.",
        ],
    )

    add_title(doc, "4. Signup Pipeline — Phased Flow", 1)
    add_para(doc, "Signup journey split into six phases before onboarding handoff.")

    add_title(doc, "4.0 Phase 0 — Route entry", 2)
    add_bullets(
        doc,
        [
            "GuestRoute wraps /signup; shouldSkipInitialSessionProbe() on guest pages with no tokens.",
            "Authenticated users redirected via loginRedirectTarget before Signup.tsx renders.",
        ],
    )
    add_diagram(doc, "Diagram: Signup Phase 0", "signup-phase0-route.png")

    add_title(doc, "4.1 Phase 1 — Session expired bootstrap", 2)
    add_bullets(
        doc,
        [
            "?reason=session_expired: tokenStore.clear(), clearPendingSignup(), clearOnboardingVerification().",
            "Best-effort authApi.logout() to clear HttpOnly cookies.",
            "Banner: Your sign-up session expired. Please enter your details again to continue.",
        ],
    )
    add_diagram(doc, "Diagram: Signup Phase 1", "signup-phase1-session-expired.png")

    add_title(doc, "4.2 Phase 2 — Client validation", 2)
    add_bullets(
        doc,
        [
            "All validation runs before any API call; errors shown inline in alert role=alert.",
            "Editing email clears the error message.",
        ],
    )
    add_diagram(doc, "Diagram: Signup Phase 2", "signup-phase2-validation.png")

    add_title(doc, "4.3 Phase 3 — reCAPTCHA", 2)
    add_bullets(
        doc,
        [
            "RecaptchaBlock when CAPTCHA_ENABLED (VITE_RECAPTCHA_SITE_KEY set).",
            "Server: CaptchaService.requireRecaptchaWhenConfigured on signup-intent.",
            "Failed submit resets captcha widget. Signup does NOT use login word-CAPTCHA.",
        ],
    )
    add_diagram(doc, "Diagram: Signup Phase 3", "signup-phase3-recaptcha.png")

    add_title(doc, "4.4 Phase 4 — POST /auth/signup-intent", 2)
    add_bullets(
        doc,
        [
            "Middleware: authLimiter (20/15min prod), csrfGuard, express-validator.",
            "Java: IpRateLimitFilter 20/min/IP; consent checks; decoy or real intent (30min TTL).",
            "Success: { signupIntentId, expiresAt }. No JWT/cookies issued.",
        ],
    )
    add_diagram(doc, "Diagram: Signup Phase 4", "signup-phase4-signup-intent.png")

    add_title(doc, "4.5 Phase 5 — Handoff to onboarding", 2)
    add_bullets(
        doc,
        [
            "writePendingSignup → co_pending_signup_v2 (30min client TTL aligned with server).",
            "writePendingGoogleConsents + writeAnalyticsConsent for Google path consistency.",
            "navigate('/onboarding', { replace: true }). OnboardingRoute requires hasPendingSignup() for guests.",
        ],
    )
    add_diagram(doc, "Diagram: Signup Phase 5", "signup-phase5-handoff.png")

    add_title(doc, "5. Signup API and Error Catalog", 1)
    add_title(doc, "5.1 Middleware POST /api/v1/auth/signup-intent", 2)
    add_table(
        doc,
        ["Status", "Condition", "Response"],
        [
            ["200", "Success (incl. decoy)", "{ signupIntentId, expiresAt }"],
            ["400", "express-validator failure", "{ error: Invalid input, details: [...] }"],
            ["400", "Backend 4xx forwarded", "Backend message"],
            ["403", "CSRF failure", "CSRF validation failed"],
            ["429", "authLimiter", "Too many auth attempts. Try again later."],
        ],
    )
    add_title(doc, "5.2 Java POST /auth/signup-intent", 2)
    add_table(
        doc,
        ["Status", "Message / condition"],
        [
            ["200", "New intent saved or decoy UUID for existing email"],
            ["400", "You must accept the Terms of Service"],
            ["400", "AI processing consent is required to upload and parse your CV during onboarding."],
            ["400", "This password is not secure enough. Please choose a different password. (HIBP)"],
            ["400", "Security verification failed. Please try again. (reCAPTCHA)"],
            ["400", "Validation failed (Jakarta @Valid fieldErrors)"],
            ["429", "Too many requests. Please wait 60 second(s) before retrying."],
            ["503", "Password security check is temporarily unavailable. Please try again shortly."],
        ],
    )
    add_title(doc, "5.3 Frontend error mapping (mapSignupIntentError)", 2)
    add_table(
        doc,
        ["Status", "User-facing message"],
        [
            ["409", "An account may already exist for this email. Try signing in or use a different email."],
            ["400 password/pwned", "This password is not secure enough. Please choose a different password."],
            ["400 captcha", "Security verification failed. Please try again."],
            ["400 consent", "Could not continue. Please try again."],
            ["429", "Too many attempts. Please wait and try again."],
            ["503", "Service temporarily unavailable. Please try again shortly."],
            ["default", "Could not continue. Please try again."],
        ],
    )

    add_title(doc, "6. Signup sessionStorage", 1)
    add_table(
        doc,
        ["Key", "TTL", "Contents"],
        [
            ["co_pending_signup_v2", "30 min (expiresAt)", "signupIntentId, email, consents, optional name"],
            ["co_pending_signup_v1", "—", "Legacy; cleared on clearPendingSignup"],
            ["co_google_consents_v1", "Session", "Consents for Google OAuth reuse from signup"],
        ],
    )

    # ── Part B: Onboarding ──
    add_title(doc, "Part B — Onboarding (/onboarding)", 1)

    add_title(doc, "7. Onboarding Route and Entry Paths", 1)
    add_table(
        doc,
        ["Property", "Value"],
        [
            ["URL", "/onboarding"],
            ["Guard", "OnboardingRoute"],
            ["Layout", "Full-width standalone (OnboardingPageShell)"],
            ["Guest without pendingSignup", "Redirect /signup"],
            ["Already onboarded", "Redirect /dashboard or /dashboard?welcome=1"],
        ],
    )
    add_title(doc, "7.1 Entry paths", 2)
    add_table(
        doc,
        ["Path", "How user arrives", "pendingSignup", "JWT", "Email OTP at finish"],
        [
            ["Deferred signup", "/signup → signup-intent", "Yes", "No until register", "Yes"],
            ["Google user", "/login → Google OAuth", "No", "Yes", "No"],
            ["Return mid-flow", "Authenticated, !onboarded", "Maybe", "Yes", "Depends"],
        ],
    )
    add_title(doc, "7.2 Billing exempt during onboarding", 2)
    add_bullets(
        doc,
        [
            "ProtectedRoute allows /account/billing, /billing/success, /billing/cancel without completing onboarding.",
            "Plan limit 402 on delivery shows upgrade toast; intended redirect to /account/billing.",
            "Known gap: Onboarding.tsx L402 calls navigate() but hook is nav — billing redirect may not fire.",
        ],
    )
    add_diagram(doc, "Diagram: Onboarding Phase 0", "onboarding-phase0-route.png")

    add_title(doc, "8. Onboarding Fields by Step", 1)
    add_title(doc, "8.1 Step 0 — Basic info + CV (BasicInfoStep)", 2)
    add_table(
        doc,
        ["Field", "Required", "Validation"],
        [
            ["Full name", "Yes", "Non-empty trim"],
            ["Headline", "Yes", "Non-empty trim (required at Continue)"],
            ["Years of experience", "Yes", "Selected value"],
            ["Location", "Yes", "Default Dublin, Ireland"],
            ["LinkedIn / Portfolio / GitHub", "No", "Valid URL if non-empty"],
            ["CV file", "Yes", "PDF or DOCX, max 5 MB"],
            ["reCAPTCHA", "Conditional", "Required when CAPTCHA_ENABLED on parse"],
        ],
    )
    add_title(doc, "8.2 Step 1 — Experience (ExperienceStep)", 2)
    add_bullets(
        doc,
        [
            "Work Experience, Education, Projects — collapsible sections; prefilled from CV parse.",
            "No required fields; invalid project URL shows toast but Continue still advances (soft validation).",
            "AI review banner when parseSource=ai and sections have rows.",
        ],
    )
    add_title(doc, "8.3 Step 2 — Preferences (PreferencesStep)", 2)
    add_table(
        doc,
        ["Field", "Required", "Notes"],
        [
            ["Target roles", "Yes (gate)", "At least one role chip; cvFile must exist in state"],
            ["Work settings", "Yes", "At least one of remote/onsite/hybrid"],
            ["Tech stack", "No", "Prefilled from extractedTechStack on AI parse"],
            ["Salary range", "No", "Clamped 20–300k EUR, 5k min gap"],
            ["Availability / filters", "No", "Defaults: 2 weeks notice, 60% match, 7 day job age"],
        ],
    )
    add_title(doc, "8.4 Email verification modal", 2)
    add_table(
        doc,
        ["Field", "Required", "Notes"],
        [
            ["8-digit OTP", "Yes", "Exactly 8 digits (not 6)"],
            ["reCAPTCHA", "Conditional", "On send and verify when CAPTCHA_ENABLED"],
        ],
    )

    add_title(doc, "9. Onboarding Pipeline — Phased Flow", 1)

    add_title(doc, "9.1 Phase 1 — CV parse at Step 0 Continue", 2)
    add_bullets(
        doc,
        [
            "POST /auth/onboarding/parse-cv — multipart file, signupIntentId, email, captchaToken.",
            "AI path when consent + onboarding.cv.ai-parse.enabled + NVIDIA configured; else regex.",
            "AI failure → regex fallback with parseWarnings toast.",
            "writeOnboardingCvDraft (cvMarkdown truncated 32KB client-side).",
        ],
    )
    add_diagram(doc, "Diagram: Onboarding Phase 1", "onboarding-phase1-cv-parse.png")

    add_title(doc, "9.2 Phase 2 — Experience review", 2)
    add_diagram(doc, "Diagram: Onboarding Phase 2", "onboarding-phase2-experience.png")

    add_title(doc, "9.3 Phase 3 — Preferences", 2)
    add_diagram(doc, "Diagram: Onboarding Phase 3", "onboarding-phase3-preferences.png")

    add_title(doc, "9.4 Phase 4 — Email OTP (deferred signup only)", 2)
    add_bullets(
        doc,
        [
            "Skipped for Google users (already authenticated, email verified at Google signup).",
            "send-verification-otp → 202; verify-email → verificationId.",
            "writeOnboardingVerification → co_onboarding_verification_v2, 15 min TTL.",
            "Registered email: decoy OTP (202 accepted, no email sent) — anti-enumeration.",
            "Max 3 resends; 300s cooldown; max 3 verify attempts; OTP expires 15 min.",
        ],
    )
    add_diagram(doc, "Diagram: Onboarding Phase 4", "onboarding-phase4-email-otp.png")

    add_title(doc, "9.5 Phase 5 — Finish pipeline (completeOnboardingFinish)", 2)
    add_bullets(
        doc,
        [
            "1. signUp (pending) or ensureFreshSession (Google) — Creating your account…",
            "2. PUT /profile onboarded:true — Saving your profile…",
            "3. POST /profile/cv + POST /profile/portfolio per project",
            "4. POST /onboarding/delivery/start — Starting job search…",
            "5. clearPendingSignup + clearOnboardingVerification on success",
        ],
    )
    add_diagram(doc, "Diagram: Onboarding Phase 5", "onboarding-phase5-finish.png")

    add_title(doc, "9.6 Phase 6 — Job delivery", 2)
    add_bullets(
        doc,
        [
            "Stages: reading_cv → normalizing_cv → fetching_jobs → evaluating_jobs → ready | ready_partial | failed.",
            "Poll GET /onboarding/delivery/status every 1.5s, max 5 minutes.",
            "JobSearchRadarLoader overlay with per-stage messages.",
            "@PlanGated ai_skill_run → 402 if monthly quota exceeded.",
        ],
    )
    add_diagram(doc, "Diagram: Onboarding Phase 6", "onboarding-phase6-delivery.png")

    add_title(doc, "9.7 Phase 7 — Redirect to dashboard", 2)
    add_bullets(
        doc,
        [
            "SSE GET /api/jobs/evaluation-progress?userId= — SOURCE_FOUND, JOB_EVALUATED, COMPLETE.",
            "finishToDashboard: clearOnboardingCvDraft, setWelcomePendingFlag (nc_welcome_pending).",
            "Navigate /dashboard?welcome=1; CareersHomeDashboard shows welcome celebration.",
            "Poll ready OR SSE COMPLETE can trigger dashboard navigation.",
        ],
    )
    add_diagram(doc, "Diagram: Onboarding Phase 7", "onboarding-phase7-redirect.png")

    add_title(doc, "10. Onboarding API Catalog", 1)
    add_table(
        doc,
        ["User action", "Frontend", "Middleware", "Java"],
        [
            ["Parse CV", "authApi.parseOnboardingCv", "POST /auth/onboarding/parse-cv", "OnboardingCvParseService"],
            ["Send OTP", "authApi.sendOnboardingVerificationOtp", "POST /auth/onboarding/send-verification-otp", "OnboardingEmailVerificationService"],
            ["Resend OTP", "authApi.resendOnboardingVerificationOtp", "POST /auth/onboarding/resend-verification-otp", "OnboardingEmailVerificationService"],
            ["Verify email", "authApi.verifyOnboardingEmail", "POST /auth/onboarding/verify-email", "OnboardingEmailVerificationService"],
            ["Register", "authApi.signup via signUp", "POST /auth/signup", "AuthService.signup"],
            ["Update profile", "profileApi.update", "PUT /profile", "ProfileController"],
            ["Upload CV", "profileApi.uploadCv", "POST /profile/cv", "ProfileController"],
            ["Portfolio", "profileApi.addPortfolioItem", "POST /profile/portfolio", "ProfileController"],
            ["Start delivery", "onboardingApi.startDelivery", "POST /onboarding/delivery/start", "OnboardingDeliveryService"],
            ["Poll status", "onboardingApi.deliveryStatus", "GET /onboarding/delivery/status", "OnboardingDeliveryService"],
            ["SSE progress", "useJobEvaluationProgress", "GET /api/jobs/evaluation-progress", "JobEvaluationProgressController"],
        ],
    )

    add_title(doc, "11. Complete Error Catalog", 1)

    add_title(doc, "11.1 CV parse errors", 2)
    add_table(
        doc,
        ["Status", "Message"],
        [
            ["400", "Upload your CV to continue"],
            ["400", "Sign-up session expired. Please start again."],
            ["400", "AI processing consent is required to parse your CV."],
            ["400", "Sign-up session required. (prod/staging)"],
            ["400", "Email is required with sign-up session."],
            ["413", "Max 5 MB"],
            ["415", "Only PDF or DOCX / security violation content mismatch"],
            ["422", "Could not read text from your CV file"],
        ],
    )

    add_title(doc, "11.2 Email OTP errors", 2)
    add_table(
        doc,
        ["Status", "Message"],
        [
            ["202", "OTP send/resend accepted"],
            ["400", "Invalid code."],
            ["400", "Unable to send code. Please try again."],
            ["400", "Security verification failed. Please try again."],
            ["429", "Resend cooldown (retryAfterSeconds, default 300s)"],
        ],
    )

    add_title(doc, "11.3 Register / finish errors", 2)
    add_table(
        doc,
        ["Status", "Message / frontend"],
        [
            ["400", "Email verification required."],
            ["400", "Sign-up session expired. Please start again."],
            ["400", "You must accept the Terms of Service"],
            ["409", "Unable to create account / username conflict (retries with suffix)"],
            ["402", "PLAN_LIMIT_EXCEEDED on CV upload or delivery start"],
            ["403", "AI processing consent required for delivery"],
        ],
    )

    add_title(doc, "11.4 Delivery errors", 2)
    add_table(
        doc,
        ["Status / stage", "Message"],
        [
            ["400", "Complete your profile first / Mark onboarding complete / Upload your CV"],
            ["failed stage", "We could not find enough matching roles yet. You can fetch more from the dashboard."],
            ["exception", "Job matching hit a snag — try again from the dashboard."],
            ["poll timeout", "Matching is taking longer than expected. You can open the dashboard."],
        ],
    )

    add_title(doc, "11.5 Session and storage", 2)
    add_table(
        doc,
        ["Key", "Storage", "TTL", "Purpose"],
        [
            ["co_pending_signup_v2", "sessionStorage", "30 min", "Deferred signup handoff"],
            ["co_onboarding_verification_v2", "sessionStorage", "15 min", "verificationId after OTP"],
            ["careerops_onboarding_cv_draft", "sessionStorage", "—", "CV parse metadata between steps"],
            ["nc_welcome_pending", "sessionStorage", "—", "Dashboard welcome modal flag"],
            ["co_google_consents_v1", "sessionStorage", "Session", "Google consent handoff"],
        ],
    )

    add_title(doc, "12. File Map, Environment, Related Docs", 1)

    add_title(doc, "12.1 Frontend", 2)
    add_table(
        doc,
        ["Role", "Path"],
        [
            ["Signup page", "frontend/src/pages/Signup.tsx"],
            ["Onboarding page", "frontend/src/pages/Onboarding.tsx"],
            ["Pending signup", "frontend/src/lib/pendingSignup.ts"],
            ["Finish orchestration", "frontend/src/lib/completeOnboardingFinish.ts"],
            ["Email verification session", "frontend/src/lib/onboardingVerification.ts"],
            ["CV draft", "frontend/src/lib/onboardingCvDraft.ts"],
            ["Session expiry", "frontend/src/lib/onboardingSession.ts"],
            ["Auth errors", "frontend/src/lib/authErrors.ts"],
            ["Route guards", "frontend/src/components/ProtectedRoute.tsx"],
            ["Email modal", "frontend/src/components/onboarding/OnboardingEmailVerificationModal.tsx"],
            ["Step components", "frontend/src/components/onboarding/BasicInfoStep.tsx, ExperienceStep.tsx, PreferencesStep.tsx"],
            ["Delivery UI", "frontend/src/components/onboarding/JobSearchRadarLoader.tsx"],
            ["SSE hook", "frontend/src/hooks/useJobEvaluationProgress.ts"],
        ],
    )

    add_title(doc, "12.2 Middleware", 2)
    add_table(
        doc,
        ["Role", "Path"],
        [
            ["Auth routes", "middleware/src/routes/auth.routes.ts"],
            ["Onboarding delivery", "middleware/src/routes/onboarding.routes.ts"],
        ],
    )

    add_title(doc, "12.3 Backend", 2)
    add_table(
        doc,
        ["Role", "Path"],
        [
            ["Auth controller", "backend/src/main/java/com/careerops/controller/AuthController.java"],
            ["Onboarding controller", "backend/src/main/java/com/careerops/controller/OnboardingController.java"],
            ["Signup intent", "backend/src/main/java/com/careerops/service/SignupIntentService.java"],
            ["Email verification", "backend/src/main/java/com/careerops/service/OnboardingEmailVerificationService.java"],
            ["CV parse", "backend/src/main/java/com/careerops/service/OnboardingCvParseService.java"],
            ["CV AI parse", "backend/src/main/java/com/careerops/service/OnboardingCvAiParseService.java"],
            ["Job delivery", "backend/src/main/java/com/careerops/service/OnboardingDeliveryService.java"],
            ["Registration", "backend/src/main/java/com/careerops/service/AuthService.java"],
            ["reCAPTCHA", "backend/src/main/java/com/careerops/service/CaptchaService.java"],
        ],
    )

    add_title(doc, "12.4 Environment variables", 2)
    add_table(
        doc,
        ["Variable", "Layer", "Purpose"],
        [
            ["VITE_RECAPTCHA_SITE_KEY / RECAPTCHA_SECRET_KEY", "Frontend + Java", "reCAPTCHA on signup-intent, CV parse, OTP"],
            ["onboarding.cv.ai-parse.enabled", "Java", "Enable NVIDIA AI CV parse"],
            ["NVIDIA API keys", "Java", "OnboardingCvAiParseService"],
            ["APP_INTERNAL_SECRET", "Middleware + Java", "HMAC BFF → backend"],
            ["JWT keys", "Middleware + Java", "Session cookies at register"],
        ],
    )

    add_title(doc, "12.5 Related documentation", 2)
    add_bullets(
        doc,
        [
            "pagesflow/signup/PAGE.md — concise signup reference",
            "pagesflow/onboarding/PAGE.md — concise onboarding reference",
            "pagesflow/login/login-pipeline.docx — login flow (Google entry to onboarding)",
            "pagesflow/shared/auth-infrastructure.md — cookies, refresh, axios, HMAC",
            "pagesflow/shared/route-guards.md — GuestRoute, OnboardingRoute, ProtectedRoute",
            "pagesflow/mandatory-fields.md — env vars for dev/prod",
        ],
    )

    doc.add_paragraph()
    footer = doc.add_paragraph(
        "Generated for CareerOps pagesflow/signup-onboarding. "
        "Diagram sources: pagesflow/signup-onboarding/diagrams/*.mmd"
    )
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in footer.runs:
        r.italic = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(0x88, 0x88, 0x88)

    doc.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
