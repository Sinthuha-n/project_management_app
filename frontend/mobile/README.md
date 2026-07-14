# Planora Mobile

Expo Router mobile app for Planora project management. The app targets iOS and Android with a mobile-first core workflow: auth, dashboard, spaces, project shell, board/backlog, task detail, chat, docs/pages, reports, members, GitHub, notifications, and profile/settings.

## Setup

```bash
npm install
cp .env.example .env
npm run start
```

Set `EXPO_PUBLIC_API_BASE_URL` in `.env` to the backend API:

- Local simulator: `http://localhost:8080`
- Android emulator: the app rewrites localhost to `10.0.2.2:8080`
- Physical device: the app rewrites localhost to the Expo LAN host when possible
- Preview/production: use a stable HTTPS API domain, for example `https://api.planora.app`

Do not ship builds with an IP/sslip backend URL. Configure preview/production values through EAS environment variables or secrets.

## Scripts

```bash
npm test -- --runInBand
npx tsc --noEmit
npm run lint
npm run security-audit
```

## Navigation And Links

The shared route registry is in `src/navigation/routes.ts`.

- Main tabs: `/(tabs)`, `/(tabs)/spaces`, `/(tabs)/inbox`, `/(tabs)/profile`
- Project shell: `/summary/[projectId]?tab=board|backlog|chat`
- More project views: `/summary/[projectId]?more=calendar|timeline|list|members|docs|pages|report|milestone|burndown`
- Invite acceptance: `/accept-invite?token=...`
- GitHub callback: `planora://github-callback`

The app registers both `planora` and legacy `mobile` schemes so existing OAuth callbacks continue to work while new links use the branded scheme.

## Release Configuration

`app.json` contains the production app identity:

- iOS bundle identifier: `com.planora.mobile`
- Android package: `com.planora.mobile`
- Universal/app link host: `planora.app`
- Push notification metadata and required plugins

Before release, confirm:

- DNS for `planora.app` and the API domain is live.
- iOS associated domains and Android asset links are configured server-side.
- GitHub OAuth redirect URI matches the app scheme configured by the backend.
- EAS production env has `EXPO_PUBLIC_API_BASE_URL` set to the stable HTTPS API.
- Push credentials and Expo project ID are configured in EAS.

## Production QA Checklist

- Cold start unauthenticated and authenticated users.
- Deep link to invite acceptance, project board, project chat, docs/pages, report, GitHub, and notifications.
- Notification tap routing from killed, backgrounded, and foregrounded states.
- Login token refresh and logout-all behavior.
- Offline launch with cached dashboard/board data.
- Offline task create/status/assignee/due-date queue, reconnect, conflict display, and sync refresh.
- Create project, invite teammate, accept invite, change member role, remove member.
- Open task detail from board, backlog, list, timeline, and calendar; edit core fields and add comments.
- Upload/download documents, create/save pages, chat send/retry, GitHub connect/link/sync, report download/schedule.

## Troubleshooting

- If API requests go to the wrong host, check `.env`, restart Expo, and clear Metro cache.
- If GitHub OAuth does not return to the app, confirm the GitHub OAuth app callback is the backend HTTPS `GITHUB_MOBILE_CALLBACK_URI`, the backend uses `APP_MOBILE_RETURN_URI=planora://github-callback`, and the installed native build registers the `planora` scheme. `mobile://github-callback` is accepted only for older releases.
- If notifications do not register, test on a physical development build; Expo Go intentionally skips native push registration.
- If Android links do not open the app, verify `https://planora.app/.well-known/assetlinks.json`.
- If iOS links do not open the app, verify Associated Domains and the apple-app-site-association file.
