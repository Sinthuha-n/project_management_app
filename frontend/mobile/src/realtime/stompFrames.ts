import { Platform } from 'react-native';

export interface StompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
}

export function buildStompConnect(token: string): string {
  return `CONNECT\naccept-version:1.2\nheart-beat:0,0\nAuthorization:Bearer ${token}\n\n`;
}

export function buildStompSubscribe(id: string, destination: string): string {
  return `SUBSCRIBE\nid:${id}\ndestination:${destination}\n\n`;
}

export function buildStompSend(destination: string, body: string): string {
  return `SEND\ndestination:${destination}\ncontent-type:application/json\n\n${body}`;
}

export function sendStompFrame(socket: WebSocket, frame: string): void {
  if (Platform.OS === 'web') {
    socket.send(`${frame}\0`);
    return;
  }
  socket.send(new TextEncoder().encode(`${frame}\0`) as unknown as string);
}

export function parseStompFrame(raw: string): StompFrame {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.trim() || normalized === '\n') return { command: 'HEARTBEAT', headers: {}, body: '' };
  const divider = normalized.indexOf('\n\n');
  if (divider === -1) return { command: normalized.trim(), headers: {}, body: '' };
  const lines = normalized.slice(0, divider).split('\n');
  const headers: Record<string, string> = {};
  lines.slice(1).forEach(line => {
    const colon = line.indexOf(':');
    if (colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  });
  return {
    command: lines[0].trim(),
    headers,
    body: normalized.slice(divider + 2).replace(/\0$/, ''),
  };
}

export async function readWebSocketPayload(payload: unknown): Promise<string> {
  if (typeof payload === 'string') return payload;
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(payload as Blob);
  });
}
