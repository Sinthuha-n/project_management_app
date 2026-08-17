# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: production-fixes.spec.ts >> sprint velocity renders tightly grouped plan and actual bars in light and dark modes
- Location: tests/e2e/production-fixes.spec.ts:242:5

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

```yaml
- img
- heading "This page couldn’t load" [level=1]
- paragraph: Reload to try again, or go back.
- button "Reload"
- button "Back"
```

# Test source

```ts
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
  169 |   await expect(page.getByTestId('issue-count')).toHaveText(/^1\s+issue$/i, { timeout: 30_000 });
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
> 253 |   await expect(velocityBtn).toBeVisible({ timeout: 30_000 });
      |                             ^ Error: expect(locator).toBeVisible() failed
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
  270 |   expect(pairGap).toBeLessThanOrEqual(12);
  271 |   expect(groupGap).toBeGreaterThan(pairGap);
  272 | 
  273 |   await page.screenshot({ path: testInfo.outputPath('velocity-light.png'), fullPage: true });
  274 |   await page.evaluate(() => {
  275 |     localStorage.setItem('planora-theme', 'dark');
  276 |     document.documentElement.classList.add('dark');
  277 |   });
  278 |   await expect(chart).toBeVisible();
  279 |   await page.screenshot({ path: testInfo.outputPath('velocity-dark.png'), fullPage: true });
  280 | });
  281 | 
```