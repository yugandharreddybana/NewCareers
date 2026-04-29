# CareerOps

AI-powered job search platform. **React** ↔ **Node.js middleware** ↔ **Java Spring Boot** ↔ **Supabase + Gemini**.

> Frontend never talks to Java directly. Middleware is the only door in.

## Architecture
```
React (Vite) ── HTTP ──▶ Node Middleware ── HTTP (internal) ──▶ Java Spring Boot ──▶ Supabase / Gemini
   :5173                       :4000                                   :8080
```

## Skills as Action Buttons
Each skill has a markdown prompt (`backend/src/main/resources/career-ops-skills/`) and a button in the UI:

| Skill          | Button             | Where         |
| -------------- | ------------------ | ------------- |
| evaluate       | Full Evaluation    | Job Detail    |
| tailor-resume  | Tailor My CV       | Job Detail    |
| research       | Research Company   | Job Detail    |
| outreach       | Draft Outreach     | Job Detail    |
| apply          | Apply Assistant    | Job Detail    |
| prep-interview | Prep Interview     | Job Detail    |
| compare        | Compare All        | Dashboard     |
| triage         | Triage All         | Dashboard     |
| track          | Kanban (visual)    | Kanban Page   |

## Quick start
1. **Supabase** — create a project, run `db/schema.sql` in the SQL editor, create private storage buckets `user-cvs` and `application-cvs`.
2. **API keys** — get free keys for Gemini (Google AI Studio), Adzuna, Reed, Resend.
3. **Backend (Java 17 + Maven)**
   ```bash
   cd backend
   cp src/main/resources/application.example.properties src/main/resources/application.properties
   # fill in values
   ./mvnw spring-boot:run
   ```
4. **Middleware (Node 20)**
   ```bash
   cd middleware
   cp .env.example .env
   # fill in values
   npm install
   npm run dev
   ```
5. **Frontend (Vite + React + TS)**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```
6. Visit http://localhost:5173

## Daily limits
- 10 jobs per user per day, total
- 3 delivered automatically by cron at 08:00
- 7 available on demand via "Get More Jobs"
- Limit resets at midnight (Europe/Dublin)

## Build order (matches spec §12)
See `docs/BUILD_ORDER.md`.
