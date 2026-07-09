# Planora — Project Management App

[![CI](https://github.com/axzellinnovations/project_management_app/actions/workflows/ci.yml/badge.svg)](https://github.com/axzellinnovations/project_management_app/actions/workflows/ci.yml)
![Java](https://img.shields.io/badge/Java-21-blue?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5-brightgreen?logo=springboot)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-blue?logo=postgresql)

Planora is a full-stack project management and team collaboration platform. It supports agile workflows (sprints, kanban), real-time collaboration (chat, collaborative editing), document management, and advanced reporting — all in one place.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Environment Variables](#2-environment-variables)
  - [3. Run with Docker Compose](#3-run-with-docker-compose)
  - [4. Run Manually](#4-run-manually)
- [Running Tests](#running-tests)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Features

| Category | Capabilities |
|---|---|
| **Project Management** | Create projects, manage members, role-based access, invitations |
| **Task Management** | Tasks, subtasks, templates, custom fields, labels, file attachments |
| **Agile / Sprints** | Sprint planning, sprintboards, velocity tracking, burndown charts |
| **Kanban** | Drag-and-drop kanban boards with customisable columns |
| **Real-time Collaboration** | WebSocket-powered chat rooms, threads, reactions, and notifications |
| **Collaborative Editing** | CRDT-based (Yjs) rich text document editing with live cursors |
| **Document Management** | Project pages, folder hierarchy, document versioning |
| **Reporting** | Scheduled reports, Excel/PDF export, dashboard analytics |
| **Notifications** | In-app notifications, due-date reminders, email alerts |
| **Global Search** | Search across projects, tasks, and documents |

---

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS, Radix UI |
| State Management | Zustand |
| Real-time | STOMP over WebSocket (`@stomp/stompjs`, `sockjs-client`), Yjs |
| Rich Text | TipTap 3 with collaboration extensions |
| Drag & Drop | `@dnd-kit` |
| Data Fetching | Axios, SWR |
| Charts | Recharts |
| Animation | Framer Motion |
| Testing | Jest, React Testing Library |
| Deployment | Netlify |

### Backend

| Layer | Technology |
|---|---|
| Language | Java 21 |
| Framework | Spring Boot 3.5, Spring Security, Spring WebSocket |
| ORM | Spring Data JPA (Hibernate) |
| Database | PostgreSQL (Supabase in production) |
| Migrations | Flyway |
| Auth | JWT (`JJWT 0.12`) |
| Caching | Spring Cache + Redis + Caffeine |
| File Storage | AWS S3 (SDK v2) |
| Email | Spring Mail (SMTP) |
| Rate Limiting | Bucket4j |
| PDF / Excel | OpenPDF, Apache POI |
| API Docs | SpringDoc OpenAPI (Swagger UI) |
| Build | Maven |
| Testing | JUnit 5, JaCoCo, H2 (in-memory) |
| Containerisation | Docker (multi-stage build) |

---

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Next.js Frontend (Netlify) │◄──────►│  Spring Boot Backend (AWS)   │
│  Port: 3000                 │  REST  │  Port: 8080                  │
│                             │  WS    │                              │
└─────────────────────────────┘        └──────────┬───────────────────┘
                                                  │
                         ┌────────────────────────┼───────────────────┐
                         │                        │                   │
                  ┌──────▼──────┐        ┌────────▼──────┐   ┌───────▼──────┐
                  │  PostgreSQL  │        │    AWS S3     │   │  SMTP Mail   │
                  │  (Supabase) │        │ (4 buckets)   │   │   (Gmail)    │
                  └─────────────┘        └───────────────┘   └──────────────┘
```

The frontend proxies all `/api/*` calls to the backend (configured in `netlify.toml` and `next.config.ts`).

---

## Prerequisites

- **Docker & Docker Compose** — for the quickstart path
- **Java 21** (Temurin) — for running the backend manually
- **Node.js 22 / npm** — for running the frontend manually (configured via `.nvmrc` in `frontend/web`)
- **PostgreSQL** — local instance or a Supabase project
- **Redis** — required for multi-instance cache sharing, auth counters, rate limiting, and notification unread-count caching unless the relevant cache flags are disabled
- **AWS account** — S3 buckets for file storage (optional for local dev with stubs)
- **Gmail account** — for SMTP email sending (optional for local dev)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/axzellinnovations/project_management_app.git
cd project_management_app
```

### 2. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

For EC2 production Docker deployments, use the production template instead:

```bash
cp .env.production.example .env.production
```

| Variable | Description | Example |
|---|---|---|
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL. Use `db:5432` only inside Docker Compose. | `jdbc:postgresql://db:5432/planora_db` |
| `SPRING_DATASOURCE_USERNAME` | Database username | `planora` |
| `SPRING_DATASOURCE_PASSWORD` | Database password | `change_me_local_db_password` |
| `POSTGRES_DB` | Local Docker Postgres database name | `planora_db` |
| `POSTGRES_USER` | Local Docker Postgres user | `planora` |
| `POSTGRES_PASSWORD` | Local Docker Postgres password | `change_me_local_db_password` |
| `REDIS_HOST` | Redis host for Spring Cache, auth counters, rate limiting, and notification cache. Use `redis` only inside Docker Compose. | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `APP_CACHE_REDIS_ENABLED` | Enables Redis-backed Spring Cache for DTO/simple-value caches. Tests use Caffeine fallback. | `true` |
| `APP_CACHE_REDIS_FAIL_OPEN` | Treats Redis cache errors as non-fatal and serves from the source of truth. | `true` |
| `NOTIFICATIONS_CACHE_REDIS_ENABLED` | Enables Redis unread-count caching for notifications. Set to `false` to read notification counts directly from the database. | `true` |
| `REDIS_CONNECT_TIMEOUT` | Redis connection timeout for fast failure when Redis is unavailable. | `500ms` |
| `REDIS_TIMEOUT` | Redis command timeout for fast failure when Redis is unavailable. | `500ms` |
| `JWT_SECRET` | HS256 secret key (min 32 chars) | `change-me-in-production` |
| `MAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP port | `587` |
| `MAIL_USERNAME` | Sender email address | `you@example.com` |
| `MAIL_PASSWORD` | SMTP app password | `your-app-password` |
| `APP_FRONTEND_BASE_URL` | Public frontend origin used in invitation emails. Required for `prod`/`production` startup. | `https://planora-pma.netlify.app` |
| `AWS_ACCESS_KEY` | AWS IAM access key | `your_aws_access_key` |
| `AWS_SECRET_KEY` | AWS IAM secret key | `your_aws_secret_key` |
| `AWS_REGION` | S3 bucket region | `eu-north-1` |
| `AWS_PROFILE_PHOTOS_BUCKET` | Profile photo bucket name | `your-profile-photos-bucket` |
| `AWS_DMS_BUCKET` | Document management bucket name | `your-document-storage-bucket` |
| `AWS_CHAT_BUCKET` | Chat attachment bucket name | `your-chat-attachments-bucket` |
| `AWS_TASK_STORAGE_BUCKET` | Task attachment bucket name | `your-task-attachments-bucket` |
| `CORS_ALLOWED_ORIGINS` | Frontend origin(s) | `http://localhost:3000` |

Optional Spring Cache TTL overrides are available via `APP_CACHE_REDIS_TTL_PROJECT_MEMBERSHIP`, `APP_CACHE_REDIS_TTL_PROJECT_TEAM_ID`, `APP_CACHE_REDIS_TTL_GITHUB_ISSUES`, `APP_CACHE_REDIS_TTL_GITHUB_ISSUE_COMMENTS`, `APP_CACHE_REDIS_TTL_USER_PROFILE`, `APP_CACHE_REDIS_TTL_USER_PHOTO_URLS`, `APP_CACHE_REDIS_TTL_PROJECT_RECENT`, and `APP_CACHE_REDIS_TTL_PROJECT_FAVORITES`.

Additional optional variables are listed in `.env.example`.

#### Chosen Deployment Model: Same-Origin Proxy

The production environment is configured to use a **Same-Origin Proxy** architecture to eliminate cross-origin request issues, CORS errors, and `SameSite` cookie limitations in the browser. 

In this model:
- The frontend is deployed to Netlify and proxies all REST API requests (under `/api/*`) server-side to the backend using the `BACKEND_URL` environment variable.
- Because the browser communicates directly with the same origin, **`NEXT_PUBLIC_API_BASE_URL` is optional** in production and defaults to an empty string `''`. This ensures Axios uses relative URLs (e.g. `/api/auth/...`) instead of hardcoded backend URLs.
- However, since WebSockets cannot be routed through standard Next.js rewrite rules on Netlify, WebSockets must connect directly to the backend domain. Therefore, **`NEXT_PUBLIC_WS_BASE_URL` is required** in production (e.g. `wss://api.planora.com`) and will trigger a hard-fail runtime exception if missing.

For local Docker development, the values in `.env.example` are safe placeholders for configuration shape only. Replace the AWS credentials and bucket names if you need real file upload flows.

For manual local backend runs outside Docker, use host addresses instead of Docker service names. For example, set `SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/planora_db` and `REDIS_HOST=localhost`. If you do not have Redis running locally, set `APP_CACHE_REDIS_ENABLED=false` so Spring Cache uses local Caffeine, and set `NOTIFICATIONS_CACHE_REDIS_ENABLED=false` so notification unread counts go directly to the database. Auth/rate-limit Redis paths fail open when Redis is unavailable, but production should still point `REDIS_HOST` at a real Redis instance.

For AWS S3 storage, create separate private buckets for profile photos, DMS documents, chat attachments, and task attachments. Set the four bucket environment variables differently in staging and production; the backend reads the bucket names at startup, so no code changes are needed between environments.

Local MinIO is not currently wired into the backend because `S3Config` does not expose an S3 endpoint override or path-style access setting. Use AWS S3 for upload-flow testing until those options are added.

For staging and production, set all required variables in the hosting platform:

| Environment | Required values |
|---|---|
| Local Docker | `SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/planora_db`, matching `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET`, mail settings, AWS credentials, and the four storage bucket names if uploads are used. |
| Staging | External PostgreSQL JDBC URL with SSL if required by the provider, staging database credentials, staging JWT secret, staging SMTP credentials, staging AWS credentials, staging-only S3 buckets, and staging `CORS_ALLOWED_ORIGINS`. Do not use `db:5432` outside Docker Compose. |
| Production | Managed PostgreSQL JDBC URL with SSL, production database credentials, production Redis host (`REDIS_HOST`) pointing at a real instance for Spring Cache/auth counters/rate limiting, `APP_CACHE_REDIS_FAIL_OPEN=true` unless you intentionally want cache outages to fail requests, strong production JWT secret, production SMTP credentials, `APP_FRONTEND_BASE_URL` set to the public frontend origin, production AWS credentials, production-only S3 buckets, production `CORS_ALLOWED_ORIGINS`, `WEBSOCKET_ALLOWED_ORIGINS` if realtime clients differ from CORS origins, and any provider-specific Flyway settings. Missing production bucket variables fail startup. Do not reuse local or staging bucket names. |

### 3. Run with Docker Compose

The fastest way to get the backend running locally:

```bash
docker compose up --build
```

The backend API will be available at `http://localhost:8080`.

> **Note:** The frontend is deployed to Netlify and is not included in the Docker Compose setup. For local frontend development, follow the manual steps below.

### 4. Run Manually

#### Backend

Start PostgreSQL and Redis first. Docker Compose already includes Redis; for manual runs you can use a local Redis server with `REDIS_HOST=localhost`, or set `APP_CACHE_REDIS_ENABLED=false` and `NOTIFICATIONS_CACHE_REDIS_ENABLED=false` to run without Redis-backed caches locally.

```bash
cd backend
./mvnw spring-boot:run
```

The API starts on `http://localhost:8080`.  
Swagger UI: `http://localhost:8080/swagger-ui.html`

#### Frontend

```bash
cd frontend/web
npm install
npm run dev
```

The app starts on `http://localhost:3000`.

> The frontend's `next.config.ts` rewrites `/api/*` to `http://localhost:8080` in development, so no additional proxy setup is needed.

---

## Running Tests

### Backend

```bash
cd backend
./mvnw verify
```

This runs all unit and integration tests and generates a JaCoCo coverage report at `backend/target/site/jacoco/index.html`.

### Frontend

```bash
cd frontend/web
npm run test          # run all tests
npm run test -- --watch  # watch mode
```

---

## API Documentation

Swagger UI is automatically generated from the OpenAPI annotations in the backend controllers.

- **Local:** `http://localhost:8080/swagger-ui.html`

The backend exposes 33+ controller groups including:

`/api/auth` · `/api/users` · `/api/projects` · `/api/tasks` · `/api/sprints` · `/api/kanban` · `/api/chat` · `/api/documents` · `/api/notifications` · `/api/reports` · and more.

---

## Project Structure

```
project_management_app/
├── backend/                        # Spring Boot application
│   └── src/main/java/.../
│       ├── controller/             # REST API controllers (33+)
│       ├── service/                # Business logic (42+)
│       ├── repository/             # Spring Data JPA repositories
│       ├── model/                  # JPA entities (44+)
│       ├── dto/                    # Request / Response DTOs
│       ├── configuration/          # Spring beans & security config
│       └── exception/              # Global exception handling
│   └── src/main/resources/
│       ├── db/migration/           # Flyway versioned migrations (V1–V16+)
│       └── templates/              # Email templates (OTP, invitations)
│
├── frontend/web/                   # Next.js application
│   └── app/                        # App Router pages
│       ├── (auth)/                 # Login, register, OTP, reset password
│       └── (dashboard)/            # Protected app pages
│           ├── projects/           # Project views
│           ├── tasks/              # Task views
│           ├── kanban/             # Kanban board
│           ├── sprints/            # Sprint management
│           ├── calendar/           # Calendar view
│           ├── chat/               # Real-time chat
│           ├── documents/          # Document editor
│           └── reports/            # Reporting dashboard
│   ├── components/                 # Reusable UI components
│   ├── hooks/                      # Custom React hooks
│   ├── lib/                        # Auth, axios, report utilities
│   ├── services/                   # API service layer
│   └── stores/                     # Zustand state stores
│
├── .github/workflows/ci.yml        # GitHub Actions CI pipeline
├── docker-compose.yml              # Local backend orchestration
├── .env.example                    # Environment variable template
└── README.md
```

---

## Security

### Token Storage Strategy
To mitigate the risk of Cross-Site Scripting (XSS) attacks, the application implements a hardened token storage strategy:
- **Refresh Token**: Stored in a secure, `HttpOnly` cookie set by the backend, ensuring it is inaccessible to JavaScript.
- **Access Token**: Kept strictly in an in-memory module variable. It is lost on page reload and dynamically re-minted via the `HttpOnly` refresh token cookie during application boot or tab loading.
- **Session Indicators**: `localStorage` is used only for the non-sensitive `planora:has_refresh_token` flag to indicate to the frontend that an active session exists and it should attempt a silent refresh on startup.

### Content Security Policy (CSP)
A strict `Content-Security-Policy` header is configured in `next.config.mjs` to reduce XSS reach by limiting script, style, connection, and frame sources.

---

## Deployment

### Backend (AWS)

The backend is containerised using a multi-stage Docker build targeting Alpine JRE 21. The runtime image runs as a non-root user, supports `JAVA_OPTS`, and exposes a Docker health check at `/actuator/health/readiness`.

```bash
docker build -t planora-backend ./backend
docker run -p 8080:8080 --env-file .env planora-backend
```

Production uses a managed PostgreSQL provider such as Supabase or RDS. Flyway handles schema migrations automatically on startup.

#### EC2 production Docker

On the EC2 host, create a production env file and fill every placeholder with real values:

```bash
cp .env.production.example .env.production
```

Before starting or redeploying production, verify the required frontend origin values:

```bash
bash scripts/validate-production-env.sh .env.production
```

To repair those values automatically on the EC2 host, run:

```bash
bash scripts/repair-production-backend-env.sh .env.production
bash scripts/validate-production-env.sh .env.production
```

For the current production Netlify site, `.env.production` must include:

```env
SPRING_PROFILES_ACTIVE=prod
APP_FRONTEND_BASE_URL=https://planora-pma.netlify.app
CORS_ALLOWED_ORIGINS=https://planora-pma.netlify.app
WEBSOCKET_ALLOWED_ORIGINS=https://planora-pma.netlify.app
```

Start the backend and private Redis container:

```bash
docker compose -f docker-compose.ec2.yml --env-file .env.production up -d --build
```

For CI/CD image deploys, set `BACKEND_IMAGE` at runtime or in `.env.production` to the pushed image tag, for example:

```bash
BACKEND_IMAGE=ghcr.io/<github-owner>/planora-backend:<git-sha> \
  docker compose -f docker-compose.ec2.yml --env-file .env.production up -d --no-build backend redis
```

Check container health:

```bash
docker compose -f docker-compose.ec2.yml --env-file .env.production ps
curl -fsS http://127.0.0.1:8080/actuator/health
curl -fsS http://127.0.0.1:8080/actuator/health/readiness
```

If Netlify returns `502` for `/api/*` after a backend deploy, inspect backend startup logs first:

```bash
docker compose -f docker-compose.ec2.yml --env-file .env.production logs --tail=200 backend
```

If the logs mention `APP_FRONTEND_BASE_URL` or `FrontendBaseUrlStartupValidator`, fix `.env.production`, rerun `bash scripts/validate-production-env.sh .env.production`, and restart only the backend/Redis services:

```bash
bash scripts/repair-production-backend-env.sh .env.production
bash scripts/validate-production-env.sh .env.production
docker compose -f docker-compose.ec2.yml --env-file .env.production up -d --no-build backend redis
```

The EC2 compose file binds the backend to `127.0.0.1:${BACKEND_PORT:-8080}:8080` and does not publish Redis. Put Nginx or Caddy on the EC2 host in front of the container and proxy HTTPS traffic to `127.0.0.1:8080`.

Reverse proxy requirements:

- Preserve `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Real-IP`.
- Support WebSocket upgrades for `/ws`, `/ws-native`, and `/yjs/*`.
- Terminate TLS at the proxy and forward plain HTTP to the local backend port.

Minimal Nginx location example:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

EC2 security group:

- Allow public inbound `80` and `443`.
- Do not allow public inbound `8080` or `6379`.
- Allow outbound access to managed PostgreSQL, AWS S3, SMTP, GitHub, and package registries used during builds.

### Frontend (Netlify)

The frontend is deployed to Netlify via the `netlify.toml` configuration. Set the following environment variables in your Netlify project settings:

- `BACKEND_URL` — the backend's public URL (e.g., `https://api.yourapp.com`)
- `NEXT_PUBLIC_BACKEND_HOST` — the backend hostname for Next.js image patterns
- `NEXT_PUBLIC_WS_BASE_URL` — the backend's direct WebSocket absolute URL (e.g., `wss://api.yourapp.com`)

### Backend CI/CD

The `Backend Deploy` GitHub Actions workflow builds `./backend`, pushes the Docker image to GitHub Container Registry, then SSHes into EC2 and restarts the backend using `docker-compose.ec2.yml`.

Required GitHub repository secrets:

- `EC2_HOST` — EC2 public hostname or IP.
- `EC2_USER` — SSH user, for example `ubuntu` or `ec2-user`.
- `EC2_SSH_PRIVATE_KEY` — private key allowed to SSH into the EC2 host.
- `EC2_APP_DIR` — absolute path to this repository on EC2.
- `GHCR_READ_TOKEN` — GitHub token with permission to read the GHCR package from EC2.

The EC2 host must already have Docker, Docker Compose, this repository, and a real `.env.production` file. Netlify deploys the frontend separately from `frontend/web/netlify.toml`.

### CI/CD

GitHub Actions CI runs on every push and pull request to `main`, `master`, `test`, and `responsive-pages*` branches:

1. **Backend job:** `./mvnw verify` (build + test + coverage)
2. **Frontend job:** lint → test → build

---

## Contributing

1. Fork the repository and create a feature branch from `main`.
2. Follow the existing code style (Java: Lombok + layered architecture; TS: strict mode + ESLint).
3. Add tests for new functionality.
4. Ensure `./mvnw verify` and `npm run test` both pass before opening a PR.
5. Open a pull request against `main` with a clear description of the change.
