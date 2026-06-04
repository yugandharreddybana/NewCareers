package simulations

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

/**
 * Batch 6 — Skills AI endpoint p95 SLO: ≤ 2 000 ms under 20 concurrent VUs.
 *
 * The AI skills-run endpoint calls an external LLM; 2 s p95 is intentionally
 * generous. Alert if p95 creeps above 3 000 ms.
 *
 * Feeder rotates through realistic CV text payloads.
 */
class SkillsAiSimulation extends NewCareersBaseSimulation {

  val cvPayloads = List(
    """{ "cvText": "5 years Java Spring Boot, PostgreSQL, AWS, Docker, Kubernetes" }""",
    """{ "cvText": "React TypeScript Node.js GraphQL MongoDB Redis" }""",
    """{ "cvText": "Python FastAPI scikit-learn pandas TensorFlow MLOps" }""",
    """{ "cvText": "Go microservices gRPC Kafka Elasticsearch Prometheus" }""",
    """{ "cvText": "Vue.js Nuxt Tailwind CSS Cypress Playwright" }"""
  )
  val payloadFeeder = Iterator.continually(cvPayloads.map(p => Map("payload" -> p))).flatten

  val runSkillsAi = scenario("Skills AI extraction")
    .feed(payloadFeeder)
    .exec(
      http("POST /skills/run")
        .post("/api/v1/skills/run")
        .body(StringBody("#{payload}"))
        .check(status.in(200, 201, 202))
    )
    .pause(1.second, 3.seconds) // AI calls — realistic think time

  rampAndHold(runSkillsAi, peak = 20, rampDuration = 20.seconds, holdDuration = 90.seconds)
    .assertions(
      global.responseTime.percentile(95).lt(2000),
      global.failedRequests.percent.lt(2.0)
    )
}
