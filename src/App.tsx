import { useState } from 'react';
import type { Session } from './types';
import { loadSessions, saveSession, deleteSession } from './storage';
import { Library } from './Library';
import { AlbumSearch } from './AlbumSearch';
import { SessionView } from './SessionView';

type View =
  | { page: 'library' }
  | { page: 'search' }
  | { page: 'session'; sessionId: string };

function App() {
  const [view, setView] = useState<View>({ page: 'library' });
  const [sessions, setSessions] = useState(() => loadSessions());

  function refresh() {
    setSessions(loadSessions());
  }

  function handleCreate(session: Session) {
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

  const active =
    view.page === 'session'
      ? sessions.find((s) => s.id === view.sessionId) ?? null
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
          onCreateSession={handleCreate}
          onBack={() => setView({ page: 'library' })}
        />
      )}
      {view.page === 'session' && active && (
        <SessionView
          session={active}
          onUpdate={handleUpdate}
          onBack={() => setView({ page: 'library' })}
        />
      )}
    </div>
  );
}

export default App;
