import { expect, test, type Page, type Route } from '@playwright/test';

type ApiFixture = {
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

async function authenticate(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('planora:access_token', token);
    localStorage.setItem('currentProjectId', '3');
    localStorage.setItem('currentProjectType', 'KANBAN');
  }, futureJwt);
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
      return json(route, { id: 3, name: 'Quality Project', projectKey: 'QA', type: 'KANBAN', teamId: 1 });
    }
    if (path === '/api/tasks/project/3/all' && method === 'GET') {
      return json(route, url.searchParams.get('archived') === 'true' ? [] : fixture.tasks);
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
      return json(route, { accessToken: futureJwt });
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
  await authenticate(page);
  await mockPlanoraApi(page, fixture);

  await page.goto('/backlog?projectId=3');
  await expect(page.getByText('1 issue', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByPlaceholder('Task title…').fill('One correlated task');
  await page.getByPlaceholder('Task title…').press('Enter');

  await expect(page.getByText('2 issues', { exact: true })).toBeVisible();
  await expect(page.getByText('One correlated task', { exact: true })).toHaveCount(1);

  await page.reload();
  await expect(page.getByText('2 issues', { exact: true })).toBeVisible();
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
  const password = page.getByLabel('Password');
  await password.focus();
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
