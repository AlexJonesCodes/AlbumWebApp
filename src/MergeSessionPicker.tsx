import type { Session } from './types';
import { confidence } from './engine';

interface Props {
  targetSession: Session;
  sessions: Session[];
  onMerge: (sourceSessionId: string) => void;
  onBack: () => void;
}

function describeSession(session: Session): string {
  const albumCount = session.albumNames?.length ?? 1;
  if (albumCount <= 1) {
    return session.artistName;
  }

  return `${session.artistName} · ${albumCount} albums`;
}

export function MergeSessionPicker({
  targetSession,
  sessions,
  onMerge,
  onBack,
}: Props) {
  const candidates = sessions
    .filter((session) => session.id !== targetSession.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button
        onClick={onBack}
        className="text-zinc-400 hover:text-zinc-100 transition-colors text-sm mb-8 block"
      >
        &larr; Back
      </button>

      <h1 className="text-2xl font-bold text-zinc-100 mb-3 tracking-tight">
        Import Another Comparison
      </h1>
      <p className="text-sm text-zinc-400 mb-8">
        Merge another saved ranking into{' '}
        <span className="text-zinc-200 font-medium">{targetSession.albumName}</span>.
        Existing sessions stay saved separately.
      </p>

      {candidates.length === 0 ? (
        <p className="text-zinc-500">No other saved rankings available to import.</p>
      ) : (
        <div className="space-y-3">
          {candidates.map((session) => {
            const conf = confidence(session.songs);
            return (
              <div
                key={session.id}
                className="flex items-center gap-4 bg-zinc-900 rounded-xl p-4"
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
                    {describeSession(session)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {session.songs.length} songs &middot; {session.matchups.length}{' '}
                    matchups &middot; {conf}% confidence
                  </p>
                </div>
                <button
                  onClick={() => onMerge(session.id)}
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-4 py-2 rounded-lg transition-colors text-sm flex-shrink-0"
                >
                  Import
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
