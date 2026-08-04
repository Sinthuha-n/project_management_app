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

## Mutation quality policy

The scheduled PIT job mutates the six service and utility classes declared in
the `mutation` Maven profile and runs the complete backend test selection. Its
current whole-service ratchet is 40% mutation coverage and 65% test strength.
These values match the measured baseline: either threshold may increase, but a
decrease requires an explicit quality-policy change.

The improvement sequence is:

1. Cover the uncovered `TaskService` paths.
2. Kill surviving `NotificationService` behavior mutations.
3. Exercise `TeamMemberService` permission paths.
4. Strengthen `UserService` authentication and profile behavior tests.

Raise the gates only after the repository sustains each milestone: 45/70, then
55/75, and finally the long-term 70/85 target. The ArcMutate Spring plugin
message is informational; the commercial plugin is not required by this policy.
