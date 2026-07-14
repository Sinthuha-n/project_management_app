import { normalizeRouteLink, resolveMobileRoute, resolveNotificationRoute, routes } from '../routes';

describe('mobile routes', () => {
  it('normalizes absolute links to app paths', () => {
    expect(normalizeRouteLink('https://planora.app/project/42/chat?roomId=7')).toBe('/project/42/chat?roomId=7');
    expect(normalizeRouteLink('summary/4')).toBe('/summary/4');
    expect(normalizeRouteLink('planora://github-callback?result=success')).toBe('/github-callback?result=success');
    expect(normalizeRouteLink('mobile://github-callback?result=success')).toBe('/github-callback?result=success');
  });

  it('resolves branded and legacy GitHub callbacks without losing parameters', () => {
    expect(resolveMobileRoute('planora://github-callback?result=success&destination=profile'))
      .toBe('/github-callback?result=success&destination=profile');
    expect(resolveMobileRoute('mobile://github-callback?result=expired_state'))
      .toBe('/github-callback?result=expired_state');
  });

  it('maps web project routes into the mobile project shell', () => {
    expect(resolveMobileRoute('/project/42/chat')).toBe(routes.project('42', 'chat'));
    expect(resolveMobileRoute('/calendar?projectId=42')).toBe(routes.project('42', 'summary', 'calendar'));
    expect(resolveMobileRoute('/kanban/42')).toBe(routes.project('42', 'board'));
  });

  it('maps invite links to the mobile accept invite route', () => {
    expect(resolveMobileRoute('/accept-invite?token=abc123')).toBe(routes.acceptInvite('abc123'));
  });

  it('maps notifications to the correct mobile surface', () => {
    expect(resolveNotificationRoute({ projectId: 9, eventType: 'CHAT_ACTIVITY' })).toBe(routes.project(9, 'chat'));
    expect(resolveNotificationRoute({ projectId: 9, message: 'A report is ready' })).toBe(routes.project(9, 'summary', 'report'));
    expect(resolveNotificationRoute({ projectId: 9, message: 'Task changed' })).toBe(routes.project(9, 'board'));
  });
});
