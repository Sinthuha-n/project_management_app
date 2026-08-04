# Stage 1: Build the application. The image-provided Maven is the wrapper fallback.
FROM maven:3.9.12-eclipse-temurin-21-alpine AS build
WORKDIR /app

# Copy Maven wrapper, resilient launcher, and pom.xml
COPY .mvn/ .mvn
COPY mvnw pom.xml ./
COPY scripts/run-maven.sh scripts/run-maven.sh

# Fix line endings and permissions
RUN sed -i 's/\r$//' mvnw
RUN sed -i 's/\r$//' scripts/run-maven.sh
RUN chmod +x mvnw scripts/run-maven.sh

# Download dependencies
RUN ./scripts/run-maven.sh -B dependency:go-offline

# Copy source and build
COPY src ./src
RUN ./scripts/run-maven.sh -B clean package -DskipTests

# Stage 2: Run the application
FROM eclipse-temurin:21-jre-noble
WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system planora \
    && useradd --system --gid planora --create-home planora

# Copy the built jar
COPY --from=build --chown=planora:planora /app/target/*.jar app.jar

USER planora

ENV JAVA_OPTS=""

# Expose port
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/actuator/health/readiness || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Djava.net.preferIPv4Stack=true -jar app.jar"]
