# Staging acceptance environment

Provision isolated PostgreSQL, Redis, private S3-compatible buckets, ClamAV,
SMTP sink, and GitHub sandbox credentials. Set `DMS_CLAMAV_ENABLED=true` and
`RATE_LIMIT_FAIL_OPEN=false`. Deploy migrations before application code.

Promotion requires browser and mobile auth/upload/WebSocket smoke tests, an
authenticated ZAP scan, no failed integration tests, and 24 hours inside the
documented p95/error/security rollback thresholds. Apply the IAM policy in
`../aws/planora-backend-s3-policy.json` to the EC2 workload role after replacing
the bucket placeholders; do not use static production AWS credentials.
