# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: production-fixes.spec.ts >> sprint velocity renders tightly grouped plan and actual bars in light and dark modes
- Location: tests\e2e\production-fixes.spec.ts:254:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('show-sprint-velocity')
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for getByTestId('show-sprint-velocity')

```

# Test source

```ts
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
  181 |   await expect(page.getByTestId('issue-count')).toHaveText(/^1\s+issue$/i, { timeout: 30_000 });
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
> 265 |   await expect(velocityBtn).toBeVisible({ timeout: 30_000 });
      |                             ^ Error: expect(locator).toBeVisible() failed
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
  282 |   expect(pairGap).toBeLessThanOrEqual(12);
  283 |   expect(groupGap).toBeGreaterThan(pairGap);
  284 | 
  285 |   await page.screenshot({ path: testInfo.outputPath('velocity-light.png'), fullPage: true });
  286 |   await page.evaluate(() => {
  287 |     localStorage.setItem('planora-theme', 'dark');
  288 |     document.documentElement.classList.add('dark');
  289 |   });
  290 |   await expect(chart).toBeVisible();
  291 |   await page.screenshot({ path: testInfo.outputPath('velocity-dark.png'), fullPage: true });
  292 | });
  293 | 
```