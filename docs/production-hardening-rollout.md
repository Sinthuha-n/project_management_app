# Production hardening rollout

This repository now enforces the application-side controls needed for the
hardening release: contract freshness, explicit public-route tests, transport
aware refresh, secure throttling, S3 finalization checks, bounded async work,
scheduled-job database leases, audit/request IDs, and mandatory CI integration
test execution.

The following controls require the production owners of AWS, Supabase, Netlify,
and GitHub to apply them before enabling the corresponding release flags. They
cannot be safely applied by application code alone.

## Required production configuration

- Use an EC2 task/instance IAM role. Grant only the private S3 bucket prefixes
  used by the application, block all public access, enable bucket encryption
  (KMS where available), and configure lifecycle deletion for abandoned upload
  prefixes.
- Do not provide long-lived AWS keys in production. Static credentials remain
  limited to local/test environments.
- At the TLS edge, enable HSTS and enforce the canonical HTTPS host. Set the
  load balancer so only its private address range can forward headers; keep
  `app.security.trusted-proxies` aligned with that range.
- Keep actuator and OpenAPI disabled publicly. Permit `/actuator/health` only
  from the load balancer/diagnostic network.
- Set `RATE_LIMIT_FAIL_OPEN=false`, configure Redis with monitoring, and alert
  on limiter fallback, Redis errors, DB-pool saturation, scheduler failures,
  malware-scan failures, and GitHub API errors.
- Configure ClamAV for production (`DMS_CLAMAV_ENABLED=true`) and use isolated
  staging buckets, SMTP sink, GitHub sandbox credentials, PostgreSQL, and Redis
  before promotion.
- Pin GitHub Actions by immutable commit SHA as part of the next CI maintenance
  change and retain image/dependency scanning in the release workflow.

## Rollout and rollback

Deploy forward-only migrations first. Enable each wave for a small traffic
slice, compare p95 and error rates to the pre-release baseline for 24 hours,
then promote. Roll back only application/configuration; never roll back an
applied Flyway migration.

Stop promotion for authentication failures over baseline by 1%, authorization
403s over baseline by 25%, p95 latency over baseline by 10%, sustained
Redis/DB-pool saturation, upload finalization failures over baseline by 2%, or
any confirmed tenant-isolation incident.
