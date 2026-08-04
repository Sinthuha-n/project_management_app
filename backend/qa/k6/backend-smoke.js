import http from 'k6/http';
import { check, group } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:8080';
const token = __ENV.AUTH_TOKEN;
const projectId = __ENV.PROJECT_ID;
const taskId = __ENV.TASK_ID;

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{operation:read}': ['p(95)<750'],
    'http_req_duration{operation:write}': ['p(95)<1500'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  if (!token || !projectId || !taskId) {
    throw new Error('AUTH_TOKEN, PROJECT_ID, and TASK_ID are required');
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

export default function (data) {
  group('project and task reads', () => {
    const projects = http.get(`${baseUrl}/api/projects`, {
      headers: data.headers,
      tags: { operation: 'read' },
    });
    check(projects, { 'project list succeeds': (response) => response.status === 200 });

    const tasks = http.get(`${baseUrl}/api/tasks/project/${projectId}?page=0&size=20`, {
      headers: data.headers,
      tags: { operation: 'read' },
    });
    check(tasks, { 'task list succeeds': (response) => response.status === 200 });
  });

  group('search and feeds', () => {
    const search = http.get(`${baseUrl}/api/search?q=task&projectId=${projectId}`, {
      headers: data.headers,
      tags: { operation: 'read' },
    });
    check(search, { 'search succeeds': (response) => response.status === 200 });

    const notifications = http.get(`${baseUrl}/api/notifications`, {
      headers: data.headers,
      tags: { operation: 'read' },
    });
    check(notifications, { 'notification feed succeeds': (response) => response.status === 200 });

    const chat = http.get(`${baseUrl}/api/projects/${projectId}/chat/messages`, {
      headers: data.headers,
      tags: { operation: 'read' },
    });
    check(chat, { 'chat history succeeds': (response) => response.status === 200 });
  });

  group('task mutation', () => {
    const mutation = http.patch(
      `${baseUrl}/api/tasks/${taskId}/status`,
      JSON.stringify({ status: 'TODO' }),
      { headers: data.headers, tags: { operation: 'write' } },
    );
    check(mutation, { 'task status mutation succeeds': (response) => response.status === 200 });
  });
}
