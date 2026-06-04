package simulations

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

/**
 * Batch 6 — Profile + Notifications p95 SLO: ≤ 500 ms under 40 VUs.
 */
class ProfileSimulation extends NewCareersBaseSimulation {

  val scn = scenario("Profile and notifications")
    .exec(
      http("GET /profile")
        .get("/api/v1/profile")
        .check(status.in(200, 401))
    )
    .pause(300.milliseconds)
    .exec(
      http("GET /notifications")
        .get("/api/v1/notifications")
        .check(status.in(200, 401))
    )
    .pause(200.milliseconds)
    .exec(
      http("GET /analytics")
        .get("/api/v1/analytics")
        .check(status.in(200, 401))
    )

  rampAndHold(scn, peak = 40)
    .assertions(
      global.responseTime.percentile(95).lt(500),
      global.failedRequests.percent.lt(1.0)
    )
}
