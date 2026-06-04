package simulations

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

/**
 * Batch 6 — Base trait shared across all NewCareers performance simulations.
 *
 * Reads target host and auth token from system properties so the same
 * binary can be aimed at staging or production without recompilation:
 *
 *   sbt -DBASE_URL=https://staging.newcareers.io \
 *       -DAUTH_TOKEN=eyJ... \
 *       gatling:test
 *
 * p95 SLO targets (hard assertions in each simulation):
 *   /health              ≤ 200 ms
 *   /api/v1/jobs         ≤ 800 ms
 *   /api/v1/skills/run   ≤ 2 000 ms (AI path — slower by design)
 *   /api/v1/profile      ≤ 500 ms
 *   /api/v1/kanban       ≤ 600 ms
 */
trait NewCareersBaseSimulation extends Simulation {

  val baseUrl: String =
    System.getProperty("BASE_URL", "http://localhost:4000")

  val authToken: String =
    System.getProperty("AUTH_TOKEN", "test-token-replace-me")

  val httpProtocol = http
    .baseUrl(baseUrl)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")
    .header("Authorization", s"Bearer $authToken")
    .header("X-Requested-With", "XMLHttpRequest")
    .disableFollowRedirect
    .shareConnections

  /** Ramp from 1 to `peak` VUs over `rampDuration`, hold for `holdDuration`. */
  def rampAndHold(
    scn: io.gatling.core.structure.ScenarioBuilder,
    peak: Int = 50,
    rampDuration: FiniteDuration = 30.seconds,
    holdDuration: FiniteDuration = 60.seconds
  ) = setUp(
    scn.inject(
      rampUsersPerSec(1) to peak during rampDuration,
      constantUsersPerSec(peak) during holdDuration
    )
  ).protocols(httpProtocol)
}
