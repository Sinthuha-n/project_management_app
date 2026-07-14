# Backend non-functional checks

Run the API load smoke test against a non-production environment:

```bash
k6 run \
  -e BASE_URL=https://test-api.example.com \
  -e AUTH_TOKEN='<test JWT>' \
  -e PROJECT_ID='<seeded project id>' \
  -e TASK_ID='<seeded mutable task id>' \
  qa/k6/backend-smoke.js
```

The scenario ramps to 50 virtual users and enforces less than 1% request failures,
99% successful checks, and the agreed p95 read/write latency budgets. Use only
dedicated test users and seeded non-production data.
