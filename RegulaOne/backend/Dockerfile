# =============================================================================
# RegulaOne backend — production image.
#
#   docker build -t regulaone-backend .          (run from RegulaOne/backend)
#
# Self-contained: it compiles from source inside the image, so it works on a clean
# clone with no Maven installed and no jar built beforehand.
#
# THE IMAGE CONTAINS NO CONFIGURATION AND NO SECRET. Every setting comes from the
# environment at run time — see RegulaOne/docs/backend-configuration.md. In
# particular the container MUST be started with SPRING_PROFILES_ACTIVE=prod, or it
# falls back to the dev profile, whose properties file is deliberately absent here.
# =============================================================================

# ── Stage 1: build ───────────────────────────────────────────────────────────
# The Maven image is used rather than ./mvnw because the wrapper jar is git-ignored
# and would have to be downloaded on every build.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# Dependencies are resolved from the pom alone and cached as their own layer, so a
# source-only change does not re-download the world on every build.
COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src ./src

# Tests are not run here. They belong in the pipeline, where a failure stops the
# deployment and the report is visible; a test failing inside a docker build gives
# a far worse message. Run ./mvnw test as a separate CI step.
RUN mvn -B clean package -DskipTests

# ── Stage 2: run ─────────────────────────────────────────────────────────────
# A JRE, not a JDK: the compiler and build tools have no business in production, and
# leaving them out removes them as attack surface. Matches java.version=17 in pom.xml.
FROM eclipse-temurin:17-jre AS runtime

# Run as a normal account. A container process running as root that is broken into
# is root inside the container, which is a much better starting point for an attacker.
RUN groupadd --system regulaone && useradd --system --gid regulaone regulaone
USER regulaone

WORKDIR /app
COPY --from=build --chown=regulaone:regulaone /build/target/*.jar app.jar

EXPOSE 8080

# MaxRAMPercentage lets the JVM size its heap from the CONTAINER's memory limit
# instead of the host's, which is what stops it being killed by the OOM killer on a
# small instance.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
