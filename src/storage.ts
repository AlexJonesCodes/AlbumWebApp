import type { Session } from './types';

const KEY = 'album-ranker-sessions';

function normalizeSession(session: Session): Session {
  return {
    ...session,
    albumIds:
      session.albumIds && session.albumIds.length > 0
        ? session.albumIds
        : [session.albumId],
    albumNames:
      session.albumNames && session.albumNames.length > 0
        ? session.albumNames
        : [session.albumName],
    songs: session.songs.map((song) => ({
      ...song,
      albumTitle: song.albumTitle || session.albumName,
    })),
  };
}

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(KEY);
    const sessions = raw ? (JSON.parse(raw) as Session[]) : [];
    return sessions.map(normalizeSession);
  } catch {
    return [];
  }
}

export function saveSession(session: Session): void {
  const normalized = normalizeSession(session);
  const all = loadSessions();
  const idx = all.findIndex((s) => s.id === normalized.id);
  if (idx >= 0) all[idx] = normalized;
  else all.push(normalized);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteSession(id: string): void {
  const all = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}
