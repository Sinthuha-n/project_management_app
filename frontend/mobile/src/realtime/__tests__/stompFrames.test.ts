import { buildStompConnect, buildStompSubscribe, parseStompFrame } from '../stompFrames';

describe('STOMP frame helpers', () => {
  it('builds authenticated connect and subscribe frames', () => {
    expect(buildStompConnect('jwt-token')).toContain('Authorization:Bearer jwt-token');
    expect(buildStompSubscribe('github-prs', '/topic/projects/2/github/prs')).toContain('destination:/topic/projects/2/github/prs');
  });

  it('parses message headers and JSON bodies', () => {
    const frame = parseStompFrame('MESSAGE\ndestination:/topic/projects/2/github/ci\n\n{"status":"success"}\0');
    expect(frame.command).toBe('MESSAGE');
    expect(frame.headers.destination).toBe('/topic/projects/2/github/ci');
    expect(JSON.parse(frame.body)).toEqual({ status: 'success' });
  });
});
