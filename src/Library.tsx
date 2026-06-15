import type { Session } from './types';
import { confidence } from './engine';

interface Props {
  sessions: Session[];
  onNewRanking: () => void;
  onOpenSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

export function Library({
  sessions,
  onNewRanking,
  onOpenSession,
  onDeleteSession,
}: Props) {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
          Album Ranker
        </h1>
        <button
          onClick={onNewRanking}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          New Ranking
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-6 text-zinc-600">///</p>
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">
            No rankings yet
          </h2>
          <p className="text-zinc-500 mb-8">
            Search for an album to start ranking its songs head-to-head
          </p>
          <button
            onClick={onNewRanking}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Search for an Album
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((session) => {
            const conf = confidence(session.songs);
            return (
              <button
                key={session.id}
                onClick={() => onOpenSession(session.id)}
                className="w-full flex items-center gap-4 bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors text-left"
              >
                <img
                  src={session.artworkUrl}
                  alt=""
                  className="w-14 h-14 rounded-lg shadow-md flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-100 truncate">
                    {session.albumName}
                  </p>
                  <p className="text-sm text-zinc-400 truncate">
                    {session.artistName}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {session.songs.length} songs &middot;{' '}
                    {session.matchups.length} matchups &middot; {conf}%
                    confidence
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }
                  }}
                  className="text-zinc-600 hover:text-rose-400 transition-colors p-2 text-lg flex-shrink-0"
                >
                  &times;
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
