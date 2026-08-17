import { expect, test, type Page, type Route } from '@playwright/test';

type ApiFixture = {
  projectType?: 'KANBAN' | 'AGILE';
  tasks: Array<Record<string, unknown>>;
  sentChatMessages: string[];
};

const futureJwt = [
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0',
  Buffer.from(JSON.stringify({
    sub: 'qa.user@example.com',
    username: 'qa-user',
    userId: 9,
    exp: 4_102_444_800,
  })).toString('base64url'),
  'test-signature',
].join('.');

async function authenticate(page: Page, defaultProjectType: 'KANBAN' | 'AGILE' = 'KANBAN') {
  await page.addInitScript(({ token, projectType }) => {
    localStorage.setItem('planora:access_token', token);
    localStorage.setItem('planora:has_refresh_token', 'true');
    localStorage.setItem('currentProjectId', '3');
    localStorage.setItem('currentProjectType', projectType);
  }, { token: futureJwt, projectType: defaultProjectType });
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockPlanoraApi(page: Page, fixture: ApiFixture) {
  await page.route('https://storage.example/**', async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/projects/3' && method === 'GET') {
      return json(route, { id: 3, name: 'Quality Project', projectKey: 'QA', type: fixture.projectType ?? 'KANBAN', teamId: 1 });
    }
    if (path === '/api/tasks/project/3/all' && method === 'GET') {
      return json(route, url.searchParams.get('archived') === 'true' ? [] : fixture.tasks);
    }
    if (path === '/api/sprints/project/3' && method === 'GET') {
      return json(route, []);
    }
    if (path === '/api/burndown/project/3/velocity' && method === 'GET') {
      return json(route, Array.from({ length: 6 }, (_, index) => ({
        sprintId: index + 1,
        sprintName: `Sprint ${index + 1}`,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        completedAt: '2026-07-14T12:00:00',
        committedPoints: 18 + index,
        completedPoints: 16 + index,
        commitmentCaptured: true,
      })));
    }
    if (path === '/api/tasks' && method === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      const created = {
        id: 2,
        projectId: 3,
        title: payload.title,
        status: 'TODO',
        priority: payload.priority ?? 'MEDIUM',
        storyPoint: 0,
        sprintId: null,
        archived: false,
        labels: [],
        clientMutationId: payload.clientMutationId,
        createdAt: '2026-07-25T06:00:00Z',
        updatedAt: '2026-07-25T06:00:00Z',
      };
      fixture.tasks = [...fixture.tasks, created];
      return json(route, created);
    }
    if (path.endsWith('/chat/attachments/upload-capabilities')) {
      return json(route, {
        maxFileSizeBytes: 25 * 1024 * 1024,
        allowedExtensions: ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp'],
        mimeTypesByExtension: { pdf: ['application/pdf', 'application/octet-stream'] },
        directUploadEnabled: true,
      });
    }
    if (path.endsWith('/chat/attachments/upload/init')) {
      return json(route, {
        uploadUrl: 'https://storage.example/direct-put',
        objectKey: 'project-3/user-9/test-Release_Plan.pdf',
        contentType: 'application/pdf',
        expiresInSeconds: 600,
      });
    }
    if (path.endsWith('/chat/attachments/upload/finalize')) {
      return json(route, { downloadUrl: 'https://storage.example/download/Release_Plan.pdf' });
    }
    if (path === '/api/projects/3/chat/messages' && method === 'POST') {
      const payload = request.postDataJSON() as { content?: string };
      fixture.sentChatMessages.push(payload.content ?? '');
      return json(route, {
        id: 70,
        projectId: 3,
        sender: 'qa-user',
        content: payload.content,
        type: 'CHAT',
        timestamp: '2026-07-25T06:00:00Z',
      });
    }
    if (path === '/api/user/me') {
      return json(route, { username: 'qa-user', email: 'qa.user@example.com', aliases: [] });
    }
    if (path.endsWith('/chat/features')) {
      return json(route, { phaseDEnabled: true, phaseEEnabled: true, webhooksEnabled: true, telemetryEnabled: true });
    }
    if (path.endsWith('/chat/presence')) return json(route, { onlineUsers: [], onlineCount: 0 });
    if (path.endsWith('/chat/unread-badge')) {
      return json(route, { teamUnread: 0, roomsUnread: 0, directsUnread: 0, totalUnread: 0 });
    }
    if (path.endsWith('/chat/summaries')) {
      return json(route, { directSummaries: [], roomSummaries: [], teamSummary: null });
    }
    if (path.endsWith('/chat/messages') || path.endsWith('/chat/rooms') || path.endsWith('/chat/members')) {
      return json(route, []);
    }
    if (path === '/api/auth/refresh') {
      return json(route, { token: futureJwt, accessToken: futureJwt });
    }
    if (path.includes('/notifications')) return json(route, []);
    if (path.includes('/inbox')) {
      return json(route, { projects: [], recentActivities: [], totalUnread: 0 });
    }

    return json(route, []);
  });
}

test('backlog optimistic creation reconciles to one row and survives refresh', async ({ page }) => {
  const fixture: ApiFixture = {
    projectType: 'KANBAN',
    tasks: [{
      id: 1,
      projectId: 3,
      title: 'Existing task',
      status: 'TODO',
      priority: 'MEDIUM',
      storyPoint: 0,
      sprintId: null,
      archived: false,
      labels: [],
      createdAt: '2026-07-25T05:00:00Z',
      updatedAt: '2026-07-25T05:00:00Z',
    }],
    sentChatMessages: [],
  };
  await authenticate(page, 'KANBAN');
  await mockPlanoraApi(page, fixture);

  await page.goto('/backlog?projectId=3');
  await expect(page.getByTestId('issue-count')).toHaveText(/^1\s+issue$/i, { timeout: 30_000 });

  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByPlaceholder('Task title…').fill('One correlated task');
  await Promise.all([
    page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/tasks' && [200, 201].includes(response.status());
    }, { timeout: 30_000 }),
    page.getByPlaceholder('Task title…').press('Enter'),
  ]);

  await expect(page.getByTestId('issue-count')).toHaveText(/^2\s+issues$/i, { timeout: 30_000 });
  await expect(page.getByText('One correlated task', { exact: true })).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId('issue-count')).toHaveText(/^2\s+issues$/i, { timeout: 30_000 });
  await expect(page.getByText('One correlated task', { exact: true })).toHaveCount(1);
});

test('chat uses capability, direct PUT, finalize, and sends the returned URL', async ({ page }) => {
  const fixture: ApiFixture = { tasks: [], sentChatMessages: [] };
  await authenticate(page);
  await mockPlanoraApi(page, fixture);

  await page.goto('/project/3/chat');
  const fileInput = page.getByLabel('Attach a file');
  await expect(fileInput).toBeAttached();
  await fileInput.setInputFiles({
    name: 'Release Plan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test attachment'),
  });

  await expect.poll(() => fixture.sentChatMessages)
    .toContain('https://storage.example/download/Release_Plan.pdf');
});

test('text fields use the neutral focus token in light and dark modes', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel('Email Address');
  await email.focus();
  await page.waitForTimeout(200);

  const lightFocus = await email.evaluate((element) => {
    const input = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.style.color = 'var(--cu-focus-border)';
    document.body.appendChild(probe);
    const tokenColor = getComputedStyle(probe).color;
    probe.remove();
    return { borderColor: input.borderTopColor, boxShadow: input.boxShadow, tokenColor };
  });
  expect(lightFocus.borderColor).toBe(lightFocus.tokenColor);
  expect(lightFocus.boxShadow).not.toBe('none');

  await page.evaluate(() => document.documentElement.classList.add('dark'));
  const password = page.locator('input[type="password"]');
  await password.focus();
  await page.waitForTimeout(200);
  const darkFocus = await password.evaluate((element) => {
    const input = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.style.color = 'var(--cu-focus-border)';
    document.body.appendChild(probe);
    const tokenColor = getComputedStyle(probe).color;
    probe.remove();
    return { borderColor: input.borderTopColor, boxShadow: input.boxShadow, tokenColor };
  });
  expect(darkFocus.borderColor).toBe(darkFocus.tokenColor);
  expect(darkFocus.boxShadow).not.toBe('none');
});

test('sprint velocity renders tightly grouped plan and actual bars in light and dark modes', async ({ page }, testInfo) => {
  const fixture: ApiFixture = { projectType: 'AGILE', tasks: [], sentChatMessages: [] };
  await authenticate(page, 'AGILE');
  await page.addInitScript(() => {
    localStorage.setItem('currentProjectType', 'AGILE');
    localStorage.setItem('planora-theme', 'light');
  });
  await mockPlanoraApi(page, fixture);

  await page.goto('/sprint-backlog?projectId=3');
  const velocityBtn = page.getByTestId('show-sprint-velocity');
  await expect(velocityBtn).toBeVisible({ timeout: 30_000 });
  await velocityBtn.click();
  const chart = page.getByRole('img', { name: /Sprint velocity chart for/i });
  await expect(chart).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Committed (plan)')).toBeVisible();
  await expect(page.getByText('Delivered (actual)')).toBeVisible();

  const bars = chart.locator('.recharts-bar-rectangle path');
  await expect(bars).toHaveCount(12);
  await page.waitForTimeout(800);
  const boxes = await bars.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, width: rect.width };
  }));
  const sprintCount = 6;
  const pairGap = boxes[sprintCount].x - (boxes[0].x + boxes[0].width);
  const groupGap = boxes[1].x - (boxes[sprintCount].x + boxes[sprintCount].width);
  expect(pairGap).toBeLessThanOrEqual(12);
  expect(groupGap).toBeGreaterThan(pairGap);

  await page.screenshot({ path: testInfo.outputPath('velocity-light.png'), fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem('planora-theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await expect(chart).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('velocity-dark.png'), fullPage: true });
});
