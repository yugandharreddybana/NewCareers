# Build Order

Each step is independently testable.

1. Supabase: schema + RLS + storage buckets (`user-cvs`, `application-cvs`)
2. Java backend: auth (register/login/forgot), profile CRUD, CV upload
3. Node middleware: JWT guard, all auth routes, rate limiter, CORS
4. React auth screens: Login, Signup, Forgot Password
5. React onboarding: 3-step wizard, profile save, CV upload
6. Java job scraping: Adzuna + RSS + Reed + Remotive + Jsoup, dedup, 96h freshness
7. Gemini scoring: JobEvaluation, top-5 selection, persistence
8. Dashboard: job cards, "Get More Jobs", daily counter
9. Job Detail: skill chips, match circle, CV tips, **6 skill buttons**
10. Kanban: 6 columns, drag-and-drop, Applied CV upload modal
11. Profile: edit prefs, CV mgmt, stats
12. Cron: daily 08:00 auto-deliver 3 jobs/user
13. QA: e2e flows, security audit, mobile (375px) + desktop (1280px)
