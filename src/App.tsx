import { useState } from 'react';
import type { Session, Song, MatchupRecord } from './types';
import { loadSessions, saveSession, deleteSession } from './storage';
import { Library } from './Library';
import { AlbumSearch } from './AlbumSearch';
import { SessionView } from './SessionView';
import { MergeSessionPicker } from './MergeSessionPicker';
import type { SearchMode } from './deezer';

type View =
  | { page: 'library' }
  | { page: 'search'; baseSessionId?: string; initialMode?: SearchMode }
  | { page: 'session'; sessionId: string }
  | { page: 'merge'; targetSessionId: string };

function forkComparisonSession(session: Session): Session {
  const now = Date.now();
  return {
    ...session,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
}

function mergeSongLists(targetSongs: Song[], sourceSongs: Song[]): Song[] {
  const merged = new Map<number, Song>();

  for (const song of targetSongs) {
    merged.set(song.trackId, song);
  }

  for (const song of sourceSongs) {
    const existing = merged.get(song.trackId);
    if (!existing) {
      merged.set(song.trackId, song);
      continue;
    }

    if (song.comparisons > existing.comparisons) {
      merged.set(song.trackId, song);
    }
  }

  return [...merged.values()];
}

function mergeMatchups(
  targetMatchups: MatchupRecord[],
  sourceMatchups: MatchupRecord[],
  validSongIds: Set<string>,
): MatchupRecord[] {
  const combined = [...targetMatchups];
  const seen = new Set(
    targetMatchups.map((matchup) =>
      `${matchup.songAId}|${matchup.songBId}|${matchup.result}|${matchup.timestamp}`,
    ),
  );

  for (const matchup of sourceMatchups) {
    if (!validSongIds.has(matchup.songAId) || !validSongIds.has(matchup.songBId)) {
      continue;
    }

    const key = `${matchup.songAId}|${matchup.songBId}|${matchup.result}|${matchup.timestamp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(matchup);
  }

  return combined;
}

function mergeSessions(target: Session, source: Session): Session {
  const targetAlbumIds = target.albumIds?.length ? target.albumIds : [target.albumId];
  const sourceAlbumIds = source.albumIds?.length ? source.albumIds : [source.albumId];
  const targetAlbumNames = target.albumNames?.length
    ? target.albumNames
    : [target.albumName];
  const sourceAlbumNames = source.albumNames?.length
    ? source.albumNames
    : [source.albumName];

  const albumIds = [...targetAlbumIds];
  const albumNames = [...targetAlbumNames];

  sourceAlbumIds.forEach((albumId, index) => {
    if (!albumIds.includes(albumId)) {
      albumIds.push(albumId);
      albumNames.push(sourceAlbumNames[index] ?? source.albumName);
    }
  });

  const songs = mergeSongLists(target.songs, source.songs);
  const songIds = new Set(songs.map((song) => song.id));
  const matchups = mergeMatchups(target.matchups, source.matchups, songIds);
  const artistNames = new Set<string>();

  if (target.artistName !== 'Various Artists') {
    artistNames.add(target.artistName);
  }
  if (source.artistName !== 'Various Artists') {
    artistNames.add(source.artistName);
  }
  for (const song of songs) {
    artistNames.add(song.artist);
  }

  const isMultiArtist = artistNames.size > 1 || target.artistName === 'Various Artists' || source.artistName === 'Various Artists';
  const artistName = isMultiArtist
    ? 'Various Artists'
    : [...artistNames][0] ?? target.artistName;
  const albumName =
    albumIds.length === 1
      ? albumNames[0]
      : isMultiArtist
        ? 'Multi Album Comparison'
        : `${artistName} Mix`;

  return {
    ...target,
    albumName,
    artistName,
    artworkUrl: target.artworkUrl,
    albumId: target.albumId,
    albumIds,
    albumNames,
    songs,
    matchups,
    updatedAt: Date.now(),
  };
}

function App() {
  const [view, setView] = useState<View>({ page: 'library' });
  const [sessions, setSessions] = useState(() => loadSessions());

  function refresh() {
    setSessions(loadSessions());
  }

  function handleSaveSession(session: Session) {
    saveSession(session);
    refresh();
    setView({ page: 'session', sessionId: session.id });
  }

  function handleUpdate(session: Session) {
    saveSession(session);
    refresh();
  }

  function handleDelete(id: string) {
    deleteSession(id);
    refresh();
  }

  function handleExtendComparison(sessionId: string) {
    setView({ page: 'search', baseSessionId: sessionId, initialMode: 'multi' });
  }

  function handleOpenMergePicker(sessionId: string) {
    setView({ page: 'merge', targetSessionId: sessionId });
  }

  function handleMergeSession(targetSessionId: string, sourceSessionId: string) {
    const target = sessions.find((session) => session.id === targetSessionId);
    const source = sessions.find((session) => session.id === sourceSessionId);
    if (!target || !source) return;

    let merged = mergeSessions(target, source);
    const targetAlbumCount = target.albumIds?.length ? target.albumIds.length : 1;
    const mergedAlbumCount = merged.albumIds?.length ? merged.albumIds.length : 1;
    if (targetAlbumCount === 1 && mergedAlbumCount > 1) {
      merged = forkComparisonSession(merged);
    }

    saveSession(merged);
    refresh();
    setView({ page: 'session', sessionId: merged.id });
  }

  const active =
    view.page === 'session'
      ? sessions.find((s) => s.id === view.sessionId) ?? null
      : null;

  const baseSession =
    view.page === 'search' && view.baseSessionId
      ? sessions.find((s) => s.id === view.baseSessionId) ?? null
      : null;

  const mergeTarget =
    view.page === 'merge'
      ? sessions.find((s) => s.id === view.targetSessionId) ?? null
      : null;

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      {view.page === 'library' && (
        <Library
          sessions={sessions}
          onNewRanking={() => setView({ page: 'search' })}
          onOpenSession={(id) => setView({ page: 'session', sessionId: id })}
          onDeleteSession={handleDelete}
        />
      )}
      {view.page === 'search' && (
        <AlbumSearch
          existingSession={baseSession}
          initialMode={view.initialMode}
          onSaveSession={handleSaveSession}
          onBack={() =>
            baseSession
              ? setView({ page: 'session', sessionId: baseSession.id })
              : setView({ page: 'library' })
          }
        />
      )}
      {view.page === 'merge' && mergeTarget && (
        <MergeSessionPicker
          targetSession={mergeTarget}
          sessions={sessions}
          onMerge={(sourceSessionId) =>
            handleMergeSession(mergeTarget.id, sourceSessionId)
          }
          onBack={() => setView({ page: 'session', sessionId: mergeTarget.id })}
        />
      )}
      {view.page === 'session' && active && (
        <SessionView
          session={active}
          onUpdate={handleUpdate}
          onBack={() => setView({ page: 'library' })}
          onAddAlbum={() => handleExtendComparison(active.id)}
          onImportComparison={() => handleOpenMergePicker(active.id)}
        />
      )}
    </div>
  );
}

export default App;
