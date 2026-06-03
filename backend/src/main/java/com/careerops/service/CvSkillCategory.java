package com.careerops.service;

import java.util.Locale;

/**
 * Classifies any skill string into a broad category so that {@link CvResumeCoachTips}
 * can produce category-specific coaching without relying on a hardcoded skill list.
 *
 * <p>Classification is purely string-based (no DB, no AI call) and intentionally
 * broad: the goal is \"good enough to pick the right tip template\", not perfect taxonomy.
 */
public enum CvSkillCategory {

    LANGUAGE,       // programming languages
    FRAMEWORK,      // web / app frameworks
    DATABASE,       // relational, NoSQL, search, cache
    CLOUD,          // cloud platforms and managed services
    DEVOPS,         // containers, orchestration, IaC, CI/CD
    DATA,           // data engineering, ML, analytics
    TESTING,        // test frameworks and practices
    ARCHITECTURE,   // patterns, principles, methodologies
    SOFT_SKILL,     // leadership, communication, etc.
    OTHER;          // anything not classified above

    // -----------------------------------------------------------------------

    public static CvSkillCategory of(String skill) {
        if (skill == null || skill.isBlank()) return OTHER;
        String s = skill.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9#+.]", " ").trim();

        // Languages
        if (matchesAny(s, "java", "kotlin", "scala", "groovy",
                          "python", "ruby", "perl", "lua",
                          "javascript", "js", "typescript", "ts",
                          "go", "golang", "rust", "c#", "csharp", "c++", "cpp", "c ",
                          "swift", "objective c", "dart", "flutter",
                          "r ", "matlab", "elixir", "erlang", "haskell", "f#", "clojure",
                          "php", "bash", "shell", "powershell", "solidity"))
            return LANGUAGE;

        // Frameworks / libraries
        if (matchesAny(s, "react", "nextjs", "next js", "angular", "vue", "svelte",
                          "node", "express", "nestjs", "fastify",
                          "spring", "spring boot", "quarkus", "micronaut", "dropwizard",
                          "django", "flask", "fastapi", "rails", "laravel", "symfony",
                          "asp.net", ".net", "dotnet", "blazor",
                          "graphql", "grpc", "rest", "soap",
                          "redux", "zustand", "mobx", "rxjs",
                          "tailwind", "bootstrap", "material ui", "chakra",
                          "hibernate", "jpa", "prisma", "sqlalchemy"))
            return FRAMEWORK;

        // Databases
        if (matchesAny(s, "postgresql", "postgres", "mysql", "sql server", "mssql", "oracle",
                          "mariadb", "sqlite", "sql",
                          "mongodb", "dynamodb", "cassandra", "couchdb", "firestore",
                          "redis", "memcached", "elasticsearch", "opensearch", "solr",
                          "snowflake", "bigquery", "redshift", "clickhouse",
                          "neo4j", "influxdb", "timescaledb", "supabase"))
            return DATABASE;

        // Cloud platforms
        if (matchesAny(s, "aws", "amazon web services", "ec2", "s3", "lambda", "ecs", "eks",
                          "rds", "aurora", "cloudwatch", "iam", "cloudfront", "sqs", "sns",
                          "gcp", "google cloud", "bigquery", "dataflow", "cloud run", "gke", "pub sub",
                          "azure", "aks", "service bus", "azure functions", "cosmos",
                          "firebase", "netlify", "vercel", "heroku", "fly.io"))
            return CLOUD;

        // DevOps / infra
        if (matchesAny(s, "docker", "kubernetes", "k8s", "helm", "istio", "linkerd",
                          "terraform", "pulumi", "ansible", "chef", "puppet",
                          "ci cd", "cicd", "github actions", "gitlab ci", "jenkins", "circleci",
                          "argocd", "spinnaker", "fluxcd",
                          "nginx", "traefik", "vault", "consul",
                          "prometheus", "grafana", "datadog", "sentry", "new relic",
                          "linux", "unix", "bash"))
            return DEVOPS;

        // Data / ML
        if (matchesAny(s, "kafka", "rabbitmq", "activemq", "nats", "pulsar",
                          "spark", "flink", "hadoop", "hive", "airflow", "dbt", "prefect",
                          "pandas", "numpy", "scipy",
                          "pytorch", "tensorflow", "keras", "scikit", "xgboost", "lightgbm",
                          "machine learning", "deep learning", "nlp", "llm", "rag", "vector",
                          "data engineering", "etl", "elt", "data pipeline",
                          "tableau", "power bi", "looker", "metabase", "dbt"))
            return DATA;

        // Testing
        if (matchesAny(s, "jest", "vitest", "cypress", "playwright", "selenium",
                          "junit", "testng", "mockito", "spock",
                          "pytest", "unittest", "rspec",
                          "tdd", "bdd", "integration test", "unit test",
                          "sonarqube", "jacoco", "coverage", "mutation testing"))
            return TESTING;

        // Architecture / methodology
        if (matchesAny(s, "microservices", "event driven", "domain driven", "ddd", "cqrs", "event sourcing",
                          "solid", "oop", "functional", "design pattern",
                          "agile", "scrum", "kanban", "sprint", "sdlc", "devops",
                          "system design", "distributed system", "high availability", "fault tolerance",
                          "api design", "rest api", "openapi", "swagger"))
            return ARCHITECTURE;

        // Soft skills
        if (matchesAny(s, "leadership", "mentoring", "coaching", "stakeholder",
                          "communication", "collaboration", "presentation",
                          "product management", "roadmap", "strategy"))
            return SOFT_SKILL;

        return OTHER;
    }

    private static boolean matchesAny(String haystack, String... needles) {
        for (String n : needles) {
            if (haystack.contains(n)) return true;
        }
        return false;
    }
}
