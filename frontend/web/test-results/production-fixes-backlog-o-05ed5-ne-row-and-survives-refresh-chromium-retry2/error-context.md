# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: production-fixes.spec.ts >> backlog optimistic creation reconciles to one row and survives refresh
- Location: tests\e2e\production-fixes.spec.ts:159:5

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

# Test source

```ts
  81  |     if (path === '/api/tasks' && method === 'POST') {
  82  |       const payload = request.postDataJSON() as Record<string, unknown>;
  83  |       const created = {
  84  |         id: 2,
  85  |         projectId: 3,
  86  |         title: payload.title,
  87  |         status: 'TODO',
  88  |         priority: payload.priority ?? 'MEDIUM',
  89  |         storyPoint: 0,
  90  |         sprintId: null,
  91  |         archived: false,
  92  |         labels: [],
  93  |         clientMutationId: payload.clientMutationId,
  94  |         createdAt: '2026-07-25T06:00:00Z',
  95  |         updatedAt: '2026-07-25T06:00:00Z',
  96  |       };
  97  |       fixture.tasks = [...fixture.tasks, created];
  98  |       return json(route, created);
  99  |     }
  100 |     if (path.endsWith('/chat/attachments/upload-capabilities')) {
  101 |       return json(route, {
  102 |         maxFileSizeBytes: 25 * 1024 * 1024,
  103 |         allowedExtensions: ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp'],
  104 |         mimeTypesByExtension: { pdf: ['application/pdf', 'application/octet-stream'] },
  105 |         directUploadEnabled: true,
  106 |       });
  107 |     }
  108 |     if (path.endsWith('/chat/attachments/upload/init')) {
  109 |       return json(route, {
  110 |         uploadUrl: 'https://storage.example/direct-put',
  111 |         objectKey: 'project-3/user-9/test-Release_Plan.pdf',
  112 |         contentType: 'application/pdf',
  113 |         expiresInSeconds: 600,
  114 |       });
  115 |     }
  116 |     if (path.endsWith('/chat/attachments/upload/finalize')) {
  117 |       return json(route, { downloadUrl: 'https://storage.example/download/Release_Plan.pdf' });
  118 |     }
  119 |     if (path === '/api/projects/3/chat/messages' && method === 'POST') {
  120 |       const payload = request.postDataJSON() as { content?: string };
  121 |       fixture.sentChatMessages.push(payload.content ?? '');
  122 |       return json(route, {
  123 |         id: 70,
  124 |         projectId: 3,
  125 |         sender: 'qa-user',
  126 |         content: payload.content,
  127 |         type: 'CHAT',
  128 |         timestamp: '2026-07-25T06:00:00Z',
  129 |       });
  130 |     }
  131 |     if (path === '/api/user/me') {
  132 |       return json(route, { username: 'qa-user', email: 'qa.user@example.com', aliases: [] });
  133 |     }
  134 |     if (path.endsWith('/chat/features')) {
  135 |       return json(route, { phaseDEnabled: true, phaseEEnabled: true, webhooksEnabled: true, telemetryEnabled: true });
  136 |     }
  137 |     if (path.endsWith('/chat/presence')) return json(route, { onlineUsers: [], onlineCount: 0 });
  138 |     if (path.endsWith('/chat/unread-badge')) {
  139 |       return json(route, { teamUnread: 0, roomsUnread: 0, directsUnread: 0, totalUnread: 0 });
  140 |     }
  141 |     if (path.endsWith('/chat/summaries')) {
  142 |       return json(route, { directSummaries: [], roomSummaries: [], teamSummary: null });
  143 |     }
  144 |     if (path.endsWith('/chat/messages') || path.endsWith('/chat/rooms') || path.endsWith('/chat/members')) {
  145 |       return json(route, []);
  146 |     }
  147 |     if (path === '/api/auth/refresh') {
  148 |       return json(route, { token: futureJwt, accessToken: futureJwt });
  149 |     }
  150 |     if (path.includes('/notifications')) return json(route, []);
  151 |     if (path.includes('/inbox')) {
  152 |       return json(route, { projects: [], recentActivities: [], totalUnread: 0 });
  153 |     }
  154 | 
  155 |     return json(route, []);
  156 |   });
  157 | }
  158 | 
  159 | test('backlog optimistic creation reconciles to one row and survives refresh', async ({ page }) => {
  160 |   const fixture: ApiFixture = {
  161 |     projectType: 'KANBAN',
  162 |     tasks: [{
  163 |       id: 1,
  164 |       projectId: 3,
  165 |       title: 'Existing task',
  166 |       status: 'TODO',
  167 |       priority: 'MEDIUM',
  168 |       storyPoint: 0,
  169 |       sprintId: null,
  170 |       archived: false,
  171 |       labels: [],
  172 |       createdAt: '2026-07-25T05:00:00Z',
  173 |       updatedAt: '2026-07-25T05:00:00Z',
  174 |     }],
  175 |     sentChatMessages: [],
  176 |   };
  177 |   await authenticate(page, 'KANBAN');
  178 |   await mockPlanoraApi(page, fixture);
  179 | 
  180 |   await page.goto('/backlog?projectId=3');
> 181 |   await expect(page.getByTestId('issue-count')).toHaveText(/^1\s+issue$/i, { timeout: 30_000 });
      |                                                 ^ Error: expect(locator).toHaveText(expected) failed
  182 | 
  183 |   await page.getByRole('button', { name: 'Add task' }).click();
  184 |   await page.getByPlaceholder('Task title…').fill('One correlated task');
  185 |   await Promise.all([
  186 |     page.waitForResponse(response => {
  187 |       const url = new URL(response.url());
  188 |       return url.pathname === '/api/tasks' && [200, 201].includes(response.status());
  189 |     }, { timeout: 30_000 }),
  190 |     page.getByPlaceholder('Task title…').press('Enter'),
  191 |   ]);
  192 | 
  193 |   await expect(page.getByTestId('issue-count')).toHaveText(/^2\s+issues$/i, { timeout: 30_000 });
  194 |   await expect(page.getByText('One correlated task', { exact: true })).toHaveCount(1);
  195 | 
  196 |   await page.reload();
  197 |   await expect(page.getByTestId('issue-count')).toHaveText(/^2\s+issues$/i, { timeout: 30_000 });
  198 |   await expect(page.getByText('One correlated task', { exact: true })).toHaveCount(1);
  199 | });
  200 | 
  201 | test('chat uses capability, direct PUT, finalize, and sends the returned URL', async ({ page }) => {
  202 |   const fixture: ApiFixture = { tasks: [], sentChatMessages: [] };
  203 |   await authenticate(page);
  204 |   await mockPlanoraApi(page, fixture);
  205 | 
  206 |   await page.goto('/project/3/chat');
  207 |   const fileInput = page.getByLabel('Attach a file');
  208 |   await expect(fileInput).toBeAttached();
  209 |   await fileInput.setInputFiles({
  210 |     name: 'Release Plan.pdf',
  211 |     mimeType: 'application/pdf',
  212 |     buffer: Buffer.from('%PDF-1.4 test attachment'),
  213 |   });
  214 | 
  215 |   await expect.poll(() => fixture.sentChatMessages)
  216 |     .toContain('https://storage.example/download/Release_Plan.pdf');
  217 | });
  218 | 
  219 | test('text fields use the neutral focus token in light and dark modes', async ({ page }) => {
  220 |   await page.goto('/login');
  221 |   const email = page.getByLabel('Email Address');
  222 |   await email.focus();
  223 |   await page.waitForTimeout(200);
  224 | 
  225 |   const lightFocus = await email.evaluate((element) => {
  226 |     const input = getComputedStyle(element);
  227 |     const probe = document.createElement('span');
  228 |     probe.style.color = 'var(--cu-focus-border)';
  229 |     document.body.appendChild(probe);
  230 |     const tokenColor = getComputedStyle(probe).color;
  231 |     probe.remove();
  232 |     return { borderColor: input.borderTopColor, boxShadow: input.boxShadow, tokenColor };
  233 |   });
  234 |   expect(lightFocus.borderColor).toBe(lightFocus.tokenColor);
  235 |   expect(lightFocus.boxShadow).not.toBe('none');
  236 | 
  237 |   await page.evaluate(() => document.documentElement.classList.add('dark'));
  238 |   const password = page.locator('input[type="password"]');
  239 |   await password.focus();
  240 |   await page.waitForTimeout(200);
  241 |   const darkFocus = await password.evaluate((element) => {
  242 |     const input = getComputedStyle(element);
  243 |     const probe = document.createElement('span');
  244 |     probe.style.color = 'var(--cu-focus-border)';
  245 |     document.body.appendChild(probe);
  246 |     const tokenColor = getComputedStyle(probe).color;
  247 |     probe.remove();
  248 |     return { borderColor: input.borderTopColor, boxShadow: input.boxShadow, tokenColor };
  249 |   });
  250 |   expect(darkFocus.borderColor).toBe(darkFocus.tokenColor);
  251 |   expect(darkFocus.boxShadow).not.toBe('none');
  252 | });
  253 | 
  254 | test('sprint velocity renders tightly grouped plan and actual bars in light and dark modes', async ({ page }, testInfo) => {
  255 |   const fixture: ApiFixture = { projectType: 'AGILE', tasks: [], sentChatMessages: [] };
  256 |   await authenticate(page, 'AGILE');
  257 |   await page.addInitScript(() => {
  258 |     localStorage.setItem('currentProjectType', 'AGILE');
  259 |     localStorage.setItem('planora-theme', 'light');
  260 |   });
  261 |   await mockPlanoraApi(page, fixture);
  262 | 
  263 |   await page.goto('/sprint-backlog?projectId=3');
  264 |   const velocityBtn = page.getByTestId('show-sprint-velocity');
  265 |   await expect(velocityBtn).toBeVisible({ timeout: 30_000 });
  266 |   await velocityBtn.click();
  267 |   const chart = page.getByRole('img', { name: /Sprint velocity chart for/i });
  268 |   await expect(chart).toBeVisible({ timeout: 30_000 });
  269 |   await expect(page.getByText('Committed (plan)')).toBeVisible();
  270 |   await expect(page.getByText('Delivered (actual)')).toBeVisible();
  271 | 
  272 |   const bars = chart.locator('.recharts-bar-rectangle path');
  273 |   await expect(bars).toHaveCount(12);
  274 |   await page.waitForTimeout(800);
  275 |   const boxes = await bars.evaluateAll((elements) => elements.map((element) => {
  276 |     const rect = element.getBoundingClientRect();
  277 |     return { x: rect.x, width: rect.width };
  278 |   }));
  279 |   const sprintCount = 6;
  280 |   const pairGap = boxes[sprintCount].x - (boxes[0].x + boxes[0].width);
  281 |   const groupGap = boxes[1].x - (boxes[sprintCount].x + boxes[sprintCount].width);
```