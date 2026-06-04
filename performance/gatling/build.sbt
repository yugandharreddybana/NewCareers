// Batch 6 — Gatling performance test project
name := "newcareers-perf"
version := "1.0.0"
scalaVersion := "2.13.12"

enablePlugins(GatlingPlugin)

libraryDependencies ++= Seq(
  "io.gatling.highcharts" % "gatling-charts-highcharts" % "3.10.5" % "test",
  "io.gatling"            % "gatling-test-framework"    % "3.10.5" % "test"
)
