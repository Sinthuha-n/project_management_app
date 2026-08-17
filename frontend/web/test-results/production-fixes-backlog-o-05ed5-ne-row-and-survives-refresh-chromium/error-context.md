# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: production-fixes.spec.ts >> backlog optimistic creation reconciles to one row and survives refresh
- Location: tests/e2e/production-fixes.spec.ts:147:5

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: getByTestId('issue-count')
Expected pattern: /^1\s+issue$/i
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" with timeout 30000ms
  - waiting for getByTestId('issue-count')

```

```yaml
- button "Sidebar":
  - img: P
  - text: planora
- button "Collapse sidebar":
  - img
- button "For You":
  - img
  - text: For You
- button "Portfolios":
  - img
  - text: Portfolios
- button "Favourites":
  - img
  - text: Favourites
  - img
- button "Recent Spaces":
  - img
  - text: Recent Spaces
  - img
- button "Inbox":
  - img
  - text: Inbox
  - img
- button "Notifications":
  - img
  - text: Notifications
  - img
- button "Profile":
  - img
  - text: Profile
- link "Q qa-user qa.user@example.com":
  - /url: /profile
- button "Switch to dark mode"
- button "Logout":
  - img
- img
- text: Project /
- heading "Quality Project" [level=1]
- button "Switch project":
  - img
- button:
  - img
- button "GitHub"
- button "Figma"
- button "Project Settings"
- img
- textbox "Search projects, tasks, docs..."
- button "New Task"
- button "Notifications"
- text: Q
- link "Summary":
  - /url: /summary/3
- link "Timeline":
  - /url: /timeline/3
- link "Backlog":
  - /url: /backlog?projectId=3
- link "Board":
  - /url: /kanban?projectId=3
- link "Calendar":
  - /url: /calendar?projectId=3
- link "Chats":
  - /url: /project/3/chat
- link "Milestones":
  - /url: /milestones?projectId=3
- link "Members":
  - /url: /members/3
- button "DMS":
  - text: DMS
  - img
- link "List":
  - /url: /list?projectId=3
- link "Report":
  - /url: /report/3
- main:
  - alert:
    - heading "Unable to load backlog" [level=2]
    - paragraph: The backlog data failed to load. Retry to fetch the latest tasks again.
    - button "Try again"
- alert
```

# Test source

```ts
  69  |     if (path === '/api/tasks' && method === 'POST') {
  70  |       const payload = request.postDataJSON() as Record<string, unknown>;
  71  |       const created = {
  72  |         id: 2,
  73  |         projectId: 3,
  74  |         title: payload.title,
  75  |         status: 'TODO',
  76  |         priority: payload.priority ?? 'MEDIUM',
  77  |         storyPoint: 0,
  78  |         sprintId: null,
  79  |         archived: false,
  80  |         labels: [],
  81  |         clientMutationId: payload.clientMutationId,
  82  |         createdAt: '2026-07-25T06:00:00Z',
  83  |         updatedAt: '2026-07-25T06:00:00Z',
  84  |       };
  85  |       fixture.tasks = [...fixture.tasks, created];
  86  |       return json(route, created);
  87  |     }
  88  |     if (path.endsWith('/chat/attachments/upload-capabilities')) {
  89  |       return json(route, {
  90  |         maxFileSizeBytes: 25 * 1024 * 1024,
  91  |         allowedExtensions: ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp'],
  92  |         mimeTypesByExtension: { pdf: ['application/pdf', 'application/octet-stream'] },
  93  |         directUploadEnabled: true,
  94  |       });
  95  |     }
  96  |     if (path.endsWith('/chat/attachments/upload/init')) {
  97  |       return json(route, {
  98  |         uploadUrl: 'https://storage.example/direct-put',
  99  |         objectKey: 'project-3/user-9/test-Release_Plan.pdf',
  100 |         contentType: 'application/pdf',
  101 |         expiresInSeconds: 600,
  102 |       });
  103 |     }
  104 |     if (path.endsWith('/chat/attachments/upload/finalize')) {
  105 |       return json(route, { downloadUrl: 'https://storage.example/download/Release_Plan.pdf' });
  106 |     }
  107 |     if (path === '/api/projects/3/chat/messages' && method === 'POST') {
  108 |       const payload = request.postDataJSON() as { content?: string };
  109 |       fixture.sentChatMessages.push(payload.content ?? '');
  110 |       return json(route, {
  111 |         id: 70,
  112 |         projectId: 3,
  113 |         sender: 'qa-user',
  114 |         content: payload.content,
  115 |         type: 'CHAT',
  116 |         timestamp: '2026-07-25T06:00:00Z',
  117 |       });
  118 |     }
  119 |     if (path === '/api/user/me') {
  120 |       return json(route, { username: 'qa-user', email: 'qa.user@example.com', aliases: [] });
  121 |     }
  122 |     if (path.endsWith('/chat/features')) {
  123 |       return json(route, { phaseDEnabled: true, phaseEEnabled: true, webhooksEnabled: true, telemetryEnabled: true });
  124 |     }
  125 |     if (path.endsWith('/chat/presence')) return json(route, { onlineUsers: [], onlineCount: 0 });
  126 |     if (path.endsWith('/chat/unread-badge')) {
  127 |       return json(route, { teamUnread: 0, roomsUnread: 0, directsUnread: 0, totalUnread: 0 });
  128 |     }
  129 |     if (path.endsWith('/chat/summaries')) {
  130 |       return json(route, { directSummaries: [], roomSummaries: [], teamSummary: null });
  131 |     }
  132 |     if (path.endsWith('/chat/messages') || path.endsWith('/chat/rooms') || path.endsWith('/chat/members')) {
  133 |       return json(route, []);
  134 |     }
  135 |     if (path === '/api/auth/refresh') {
  136 |       return json(route, { token: futureJwt, accessToken: futureJwt });
  137 |     }
  138 |     if (path.includes('/notifications')) return json(route, []);
  139 |     if (path.includes('/inbox')) {
  140 |       return json(route, { projects: [], recentActivities: [], totalUnread: 0 });
  141 |     }
  142 | 
  143 |     return json(route, []);
  144 |   });
  145 | }
  146 | 
  147 | test('backlog optimistic creation reconciles to one row and survives refresh', async ({ page }) => {
  148 |   const fixture: ApiFixture = {
  149 |     projectType: 'KANBAN',
  150 |     tasks: [{
  151 |       id: 1,
  152 |       projectId: 3,
  153 |       title: 'Existing task',
  154 |       status: 'TODO',
  155 |       priority: 'MEDIUM',
  156 |       storyPoint: 0,
  157 |       sprintId: null,
  158 |       archived: false,
  159 |       labels: [],
  160 |       createdAt: '2026-07-25T05:00:00Z',
  161 |       updatedAt: '2026-07-25T05:00:00Z',
  162 |     }],
  163 |     sentChatMessages: [],
  164 |   };
  165 |   await authenticate(page, 'KANBAN');
  166 |   await mockPlanoraApi(page, fixture);
  167 | 
  168 |   await page.goto('/backlog?projectId=3');
> 169 |   await expect(page.getByTestId('issue-count')).toHaveText(/^1\s+issue$/i, { timeout: 30_000 });
      |                                                 ^ Error: expect(locator).toHaveText(expected) failed
  170 | 
  171 |   await page.getByRole('button', { name: 'Add task' }).click();
  172 |   await page.getByPlaceholder('Task title…').fill('One correlated task');
  173 |   await Promise.all([
  174 |     page.waitForResponse(response => {
  175 |       const url = new URL(response.url());
  176 |       return url.pathname === '/api/tasks' && [200, 201].includes(response.status());
  177 |     }, { timeout: 30_000 }),
  178 |     page.getByPlaceholder('Task title…').press('Enter'),
  179 |   ]);
  180 | 
  181 |   await expect(page.getByTestId('issue-count')).toHaveText(/^2\s+issues$/i, { timeout: 30_000 });
  182 |   await expect(page.getByText('One correlated task', { exact: true })).toHaveCount(1);
  183 | 
  184 |   await page.reload();
  185 |   await expect(page.getByTestId('issue-count')).toHaveText(/^2\s+issues$/i, { timeout: 30_000 });
  186 |   await expect(page.getByText('One correlated task', { exact: true })).toHaveCount(1);
  187 | });
  188 | 
  189 | test('chat uses capability, direct PUT, finalize, and sends the returned URL', async ({ page }) => {
  190 |   const fixture: ApiFixture = { tasks: [], sentChatMessages: [] };
  191 |   await authenticate(page);
  192 |   await mockPlanoraApi(page, fixture);
  193 | 
  194 |   await page.goto('/project/3/chat');
  195 |   const fileInput = page.getByLabel('Attach a file');
  196 |   await expect(fileInput).toBeAttached();
  197 |   await fileInput.setInputFiles({
  198 |     name: 'Release Plan.pdf',
  199 |     mimeType: 'application/pdf',
  200 |     buffer: Buffer.from('%PDF-1.4 test attachment'),
  201 |   });
  202 | 
  203 |   await expect.poll(() => fixture.sentChatMessages)
  204 |     .toContain('https://storage.example/download/Release_Plan.pdf');
  205 | });
  206 | 
  207 | test('text fields use the neutral focus token in light and dark modes', async ({ page }) => {
  208 |   await page.goto('/login');
  209 |   const email = page.getByLabel('Email Address');
  210 |   await email.focus();
  211 |   await page.waitForTimeout(200);
  212 | 
  213 |   const lightFocus = await email.evaluate((element) => {
  214 |     const input = getComputedStyle(element);
  215 |     const probe = document.createElement('span');
  216 |     probe.style.color = 'var(--cu-focus-border)';
  217 |     document.body.appendChild(probe);
  218 |     const tokenColor = getComputedStyle(probe).color;
  219 |     probe.remove();
  220 |     return { borderColor: input.borderTopColor, boxShadow: input.boxShadow, tokenColor };
  221 |   });
  222 |   expect(lightFocus.borderColor).toBe(lightFocus.tokenColor);
  223 |   expect(lightFocus.boxShadow).not.toBe('none');
  224 | 
  225 |   await page.evaluate(() => document.documentElement.classList.add('dark'));
  226 |   const password = page.locator('input[type="password"]');
  227 |   await password.focus();
  228 |   await page.waitForTimeout(200);
  229 |   const darkFocus = await password.evaluate((element) => {
  230 |     const input = getComputedStyle(element);
  231 |     const probe = document.createElement('span');
  232 |     probe.style.color = 'var(--cu-focus-border)';
  233 |     document.body.appendChild(probe);
  234 |     const tokenColor = getComputedStyle(probe).color;
  235 |     probe.remove();
  236 |     return { borderColor: input.borderTopColor, boxShadow: input.boxShadow, tokenColor };
  237 |   });
  238 |   expect(darkFocus.borderColor).toBe(darkFocus.tokenColor);
  239 |   expect(darkFocus.boxShadow).not.toBe('none');
  240 | });
  241 | 
  242 | test('sprint velocity renders tightly grouped plan and actual bars in light and dark modes', async ({ page }, testInfo) => {
  243 |   const fixture: ApiFixture = { projectType: 'AGILE', tasks: [], sentChatMessages: [] };
  244 |   await authenticate(page, 'AGILE');
  245 |   await page.addInitScript(() => {
  246 |     localStorage.setItem('currentProjectType', 'AGILE');
  247 |     localStorage.setItem('planora-theme', 'light');
  248 |   });
  249 |   await mockPlanoraApi(page, fixture);
  250 | 
  251 |   await page.goto('/sprint-backlog?projectId=3');
  252 |   const velocityBtn = page.getByTestId('show-sprint-velocity');
  253 |   await expect(velocityBtn).toBeVisible({ timeout: 30_000 });
  254 |   await velocityBtn.click();
  255 |   const chart = page.getByRole('img', { name: /Sprint velocity chart for/i });
  256 |   await expect(chart).toBeVisible({ timeout: 30_000 });
  257 |   await expect(page.getByText('Committed (plan)')).toBeVisible();
  258 |   await expect(page.getByText('Delivered (actual)')).toBeVisible();
  259 | 
  260 |   const bars = chart.locator('.recharts-bar-rectangle path');
  261 |   await expect(bars).toHaveCount(12);
  262 |   await page.waitForTimeout(800);
  263 |   const boxes = await bars.evaluateAll((elements) => elements.map((element) => {
  264 |     const rect = element.getBoundingClientRect();
  265 |     return { x: rect.x, width: rect.width };
  266 |   }));
  267 |   const sprintCount = 6;
  268 |   const pairGap = boxes[sprintCount].x - (boxes[0].x + boxes[0].width);
  269 |   const groupGap = boxes[1].x - (boxes[sprintCount].x + boxes[sprintCount].width);
```