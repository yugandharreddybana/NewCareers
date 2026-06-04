# Performance Tests — Batch 6

Gatling simulations that verify p95 latency SLOs across all critical NewCareers endpoints.

## Simulations

| Simulation | Endpoint(s) | Peak VUs | p95 SLO |
|---|---|---|---|
| `HealthCheckSimulation` | `/health` | 100 | ≤ 200 ms |
| `JobsApiSimulation` | `/api/v1/jobs`, `/api/v1/kanban` | 50 | ≤ 800 ms |
| `SkillsAiSimulation` | `/api/v1/skills/run` | 20 | ≤ 2 000 ms |
| `ProfileSimulation` | `/api/v1/profile`, `/api/v1/notifications`, `/api/v1/analytics` | 40 | ≤ 500 ms |
| `FullJourneySimulation` | All routes mixed | ~50 | ≤ 1 000 ms |

## Run locally

```bash
# Point at local dev stack
cd performance/gatling
sbt -DBASE_URL=http://localhost:4000 -DAUTH_TOKEN=<your-token> gatling:test

# Point at staging
sbt -DBASE_URL=https://staging.newcareers.io -DAUTH_TOKEN=<staging-token> \
    -Dgatling.simulationClass=simulations.FullJourneySimulation gatling:test
```

## CI

The `performance.yml` workflow runs `HealthCheckSimulation` and `JobsApiSimulation`
on every PR against `main` using a stub backend (WireMock). Full load tests
run nightly on the staging environment.

## Adding a new simulation

1. Extend `NewCareersBaseSimulation`.
2. Define your scenario and call `rampAndHold(scn, peak = N)` with `.assertions(...)`.
3. Add an entry to the table above.
