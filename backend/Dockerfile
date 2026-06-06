# ── Build stage ──────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

# ── Runtime stage (Java + Python ingest) ───────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-ingest.txt /app/backend/requirements-ingest.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /app/backend/requirements-ingest.txt

COPY --from=build /build/target/careerops-backend-*.jar /app/app.jar
COPY ingest_permit_stats.py /app/backend/ingest_permit_stats.py

ENV PERMIT_INGEST_SCRIPT=/app/backend/ingest_permit_stats.py
ENV PERMIT_XLSX_CACHE=/tmp/permits
ENV TMPDIR=/tmp/permits

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
