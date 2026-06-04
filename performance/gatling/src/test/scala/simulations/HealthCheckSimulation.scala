package simulations

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

/**
 * Batch 6 — /health p95 SLO: ≤ 200 ms under 100 VUs.
 *
 * This is the fastest, cheapest smoke test. If /health misses 200 ms p95
 * something systemic is wrong (GC pause, container OOM, DB pool exhausted).
 */
class HealthCheckSimulation extends NewCareersBaseSimulation {

  val scn = scenario("Health probe")
    .exec(
      http("GET /health")
        .get("/health")
        .check(status.is(200))
        .check(jsonPath("$.ok").is("true"))
    )
    .pause(100.milliseconds)

  rampAndHold(scn, peak = 100, rampDuration = 20.seconds, holdDuration = 60.seconds)
    .assertions(
      global.responseTime.percentile(95).lt(200),
      global.successfulRequests.percent.gte(99.9)
    )
}
