import type { Session } from './types';

const KEY = 'album-ranker-sessions';

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: Session): void {
  const all = loadSessions();
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) all[idx] = session;
  else all.push(session);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteSession(id: string): void {
  const all = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}
