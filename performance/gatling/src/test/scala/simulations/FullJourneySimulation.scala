package simulations

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

/**
 * Batch 6 — Composite "full user journey" simulation.
 *
 * Blends all routes together to mimic a real traffic distribution:
 *   40% browsing jobs
 *   25% viewing profile / notifications
 *   20% skills + kanban
 *   10% AI skills run
 *    5% health probes (load-balancer traffic)
 *
 * SLO: global p95 ≤ 1 000 ms, error rate < 1%.
 */
class FullJourneySimulation extends NewCareersBaseSimulation {

  val jobIdFeeder = Iterator.continually((1 to 200).map(i => Map("jobId" -> i))).flatten

  val browseJobs = scenario("Browse jobs")
    .feed(jobIdFeeder)
    .exec(http("GET /jobs").get("/api/v1/jobs?page=1&limit=20").check(status.in(200, 304)))
    .pause(500.milliseconds)
    .exec(http("GET /jobs/:id").get("/api/v1/jobs/#{jobId}").check(status.in(200, 404)))

  val viewProfile = scenario("Profile")
    .exec(http("GET /profile").get("/api/v1/profile").check(status.in(200, 401)))
    .pause(300.milliseconds)
    .exec(http("GET /notifications").get("/api/v1/notifications").check(status.in(200, 401)))

  val skillsKanban = scenario("Skills + kanban")
    .feed(jobIdFeeder)
    .exec(http("GET /skills").get("/api/v1/skills").check(status.in(200, 401)))
    .pause(200.milliseconds)
    .exec(
      http("POST /kanban/:id").post("/api/v1/kanban/#{jobId}")
        .body(StringBody("""{ \"kanbanColumn\": \"Applied\" }"""))
        .check(status.in(200, 201, 404))
    )

  val aiRun = scenario("AI skills run")
    .exec(
      http("POST /skills/run").post("/api/v1/skills/run")
        .body(StringBody("""{ \"cvText\": \"React TypeScript Node.js\" }"""))
        .check(status.in(200, 201, 202))
    )
    .pause(2.seconds)

  val health = scenario("Health probe")
    .exec(http("GET /health").get("/health").check(status.is(200)))
    .pause(1.second)

  setUp(
    browseJobs.inject(rampUsersPerSec(1) to 20 during 30.seconds, constantUsersPerSec(20) during 60.seconds),
    viewProfile.inject(rampUsersPerSec(1) to 12 during 30.seconds, constantUsersPerSec(12) during 60.seconds),
    skillsKanban.inject(rampUsersPerSec(1) to 10 during 30.seconds, constantUsersPerSec(10) during 60.seconds),
    aiRun.inject(rampUsersPerSec(0.2) to 5 during 30.seconds, constantUsersPerSec(5) during 60.seconds),
    health.inject(rampUsersPerSec(0.1) to 3 during 30.seconds, constantUsersPerSec(3) during 60.seconds)
  ).protocols(httpProtocol)
    .assertions(
      global.responseTime.percentile(95).lt(1000),
      global.failedRequests.percent.lt(1.0)
    )
}
