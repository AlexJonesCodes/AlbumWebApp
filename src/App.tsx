import { useState } from 'react';
import type { Session } from './types';
import { loadSessions, saveSession, deleteSession } from './storage';
import { Library } from './Library';
import { AlbumSearch } from './AlbumSearch';
import { SessionView } from './SessionView';
import type { SearchMode } from './deezer';

type View =
  | { page: 'library' }
  | { page: 'search'; baseSessionId?: string; initialMode?: SearchMode }
  | { page: 'session'; sessionId: string };

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

  const active =
    view.page === 'session'
      ? sessions.find((s) => s.id === view.sessionId) ?? null
      : null;

  const baseSession =
    view.page === 'search' && view.baseSessionId
      ? sessions.find((s) => s.id === view.baseSessionId) ?? null
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
      {view.page === 'session' && active && (
        <SessionView
          session={active}
          onUpdate={handleUpdate}
          onBack={() => setView({ page: 'library' })}
          onAddAlbum={() => handleExtendComparison(active.id)}
        />
      )}
    </div>
  );
}

export default App;
