package simulations

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

/**
 * Batch 6 — Jobs API p95 SLO: ≤ 800 ms under 50 concurrent VUs.
 *
 * Simulates the most common user flow:
 *   1. GET /api/v1/jobs?page=1&limit=20   (list)
 *   2. GET /api/v1/jobs/:id               (detail)
 *   3. POST /api/v1/kanban/:id            (move to Applied)
 *
 * Feeder provides random job IDs so the cache is exercised realistically.
 */
class JobsApiSimulation extends NewCareersBaseSimulation {

  // Simple feeder: cycle through IDs 1–200
  val jobIdFeeder = Iterator.continually((1 to 200).map(i => Map("jobId" -> i))).flatten

  val browseJobs = scenario("Browse and apply to jobs")
    .feed(jobIdFeeder)
    .exec(
      http("GET /jobs list")
        .get("/api/v1/jobs?page=1&limit=20")
        .check(status.in(200, 304))
    )
    .pause(500.milliseconds, 1.second)
    .exec(
      http("GET /jobs/:id")
        .get("/api/v1/jobs/#{jobId}")
        .check(status.in(200, 404))
    )
    .pause(200.milliseconds)
    .exec(
      http("POST /kanban/:id")
        .post("/api/v1/kanban/#{jobId}")
        .body(StringBody("""{ \"kanbanColumn\": \"Applied\" }"""))
        .check(status.in(200, 201, 404))
    )

  rampAndHold(browseJobs, peak = 50)
    .assertions(
      global.responseTime.percentile(95).lt(800),
      global.failedRequests.percent.lt(1.0)
    )
}
