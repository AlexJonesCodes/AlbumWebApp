import { useState, useEffect, useRef } from 'react';
import type { Session, MatchResult, MatchupRecord, Song } from './types';
import { applyMatchup, pickPair, confidence, undoLastMatchup } from './engine';

interface Props {
  session: Session;
  onUpdate: (session: Session) => void;
  onBack: () => void;
  onAddAlbum: () => void;
  onImportComparison: () => void;
}

function makeTimestamp(): number {
  return Date.now();
}

function albumSummary(session: Session): string | null {
  const names = session.albumNames;
  if (!names || names.length <= 1) return null;
  if (names.length <= 3) return names.join(' · ');
  return `${names.slice(0, 3).join(' · ')} +${names.length - 3} more`;
}

export function SessionView({
  session,
  onUpdate,
  onBack,
  onAddAlbum,
  onImportComparison,
}: Props) {
  const [songs, setSongs] = useState(session.songs);
  const [matchups, setMatchups] = useState(session.matchups);
  const [currentPair, setCurrentPair] = useState<[string, string] | null>(
    () => pickPair(session.songs, session.matchups),
  );
  const [playingSide, setPlayingSide] = useState<'left' | 'right' | null>(
    null,
  );
  const [audioProgress, setAudioProgress] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlersRef = useRef<{
    verdict: (r: MatchResult) => void;
    skip: () => void;
    undo: () => void;
  }>({ verdict: () => {}, skip: () => {}, undo: () => {} });

  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.5;
    audioRef.current = audio;

    function onTime() {
      if (audio.duration) setAudioProgress(audio.currentTime / audio.duration);
    }
    function onEnded() {
      setPlayingSide(null);
      setAudioProgress(0);
    }
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
    };
  }, []);

  const songA = currentPair
    ? songs.find((s) => s.id === currentPair[0]) ?? null
    : null;
  const songB = currentPair
    ? songs.find((s) => s.id === currentPair[1]) ?? null
    : null;

  function stopAudio() {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setPlayingSide(null);
    setAudioProgress(0);
  }

  function changeVolume(v: number) {
    setVolume(v);
    const audio = audioRef.current;
    if (audio) audio.volume = v;
  }

  function togglePlay(side: 'left' | 'right') {
    const audio = audioRef.current;
    if (!audio) return;
    const song = side === 'left' ? songA : songB;
    if (!song?.previewUrl) return;
    if (playingSide === side) {
      audio.pause();
      setPlayingSide(null);
      return;
    }
    audio.src = song.previewUrl;
    audio.play().catch(() => {});
    setPlayingSide(side);
    setAudioProgress(0);
  }

  function handleVerdict(result: MatchResult) {
    if (!currentPair) return;
    const [aId, bId] = currentPair;
    const newSongs = applyMatchup(songs, aId, bId, result);
    const record: MatchupRecord = {
      songAId: aId,
      songBId: bId,
      result,
      timestamp: makeTimestamp(),
    };
    const newMatchups = [...matchups, record];

    setSongs(newSongs);
    setMatchups(newMatchups);
    stopAudio();
    setCurrentPair(pickPair(newSongs, newMatchups));
    onUpdate({
      ...session,
      songs: newSongs,
      matchups: newMatchups,
      updatedAt: makeTimestamp(),
    });
  }

  function handleSkip() {
    stopAudio();
    setCurrentPair(pickPair(songs, matchups));
  }

  function handleUndo() {
    const result = undoLastMatchup(songs, matchups);
    if (!result) return;
    stopAudio();
    setSongs(result.songs);
    setMatchups(result.matchups);
    setCurrentPair(pickPair(result.songs, result.matchups));
    onUpdate({
      ...session,
      songs: result.songs,
      matchups: result.matchups,
      updatedAt: makeTimestamp(),
    });
  }

  useEffect(() => {
    handlersRef.current = {
      verdict: handleVerdict,
      skip: handleSkip,
      undo: handleUndo,
    };
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const h = handlersRef.current;
      switch (e.key) {
        case '1':
          h.verdict('strong-left');
          break;
        case '2':
          h.verdict('lean-left');
          break;
        case '3':
          h.verdict('tie');
          break;
        case '4':
          h.verdict('lean-right');
          break;
        case '5':
          h.verdict('strong-right');
          break;
        case 's':
        case 'S':
          h.skip();
          break;
        case 'z':
        case 'Z':
          h.undo();
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sorted = [...songs].sort((a, b) => b.rating - a.rating);
  const ratings = sorted.map((s) => s.rating);
  const maxR = ratings.length > 0 ? Math.max(...ratings) : BASE;
  const minR = ratings.length > 0 ? Math.min(...ratings) : BASE;
  const range = maxR - minR || 1;
  const conf = confidence(songs);
  const selectedAlbums = albumSummary(session);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          className="text-zinc-400 hover:text-zinc-100 transition-colors text-sm flex-shrink-0"
        >
          &larr; Back
        </button>
        <img
          src={session.artworkUrl}
          alt=""
          className="w-9 h-9 rounded shadow flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate leading-tight">
            {session.albumName}
          </p>
          <p className="text-xs text-zinc-400 truncate">{session.artistName}</p>
          {selectedAlbums && (
            <p className="text-[10px] text-zinc-500 truncate mt-0.5">
              {selectedAlbums}
            </p>
          )}
        </div>
        <button
          onClick={onAddAlbum}
          className="text-zinc-500 hover:text-zinc-200 text-xs transition-colors flex-shrink-0"
        >
          Add another album
        </button>
        <button
          onClick={onImportComparison}
          className="text-zinc-500 hover:text-zinc-200 text-xs transition-colors flex-shrink-0"
        >
          Import comparison
        </button>
        {matchups.length > 0 && (
          <button
            onClick={handleUndo}
            className="text-zinc-500 hover:text-zinc-200 text-xs transition-colors flex-shrink-0"
          >
            Undo (Z)
          </button>
        )}
      </div>

      {currentPair && songA && songB ? (
        <div className="mb-10">
          <div className="flex items-start justify-center gap-4 sm:gap-8 md:gap-12 mb-6">
            <SongCard
              song={songA}
              playing={playingSide === 'left'}
              progress={playingSide === 'left' ? audioProgress : 0}
              onToggle={() => togglePlay('left')}
            />
            <span className="text-zinc-700 font-bold text-lg mt-16 sm:mt-20 select-none flex-shrink-0">
              vs
            </span>
            <SongCard
              song={songB}
              playing={playingSide === 'right'}
              progress={playingSide === 'right' ? audioProgress : 0}
              onToggle={() => togglePlay('right')}
            />
          </div>

          <div className="flex items-center justify-center gap-2 mb-4">
            <VolumeIcon muted={volume === 0} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-28 h-1 accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap justify-center gap-2">
              <VerdictBtn
                label="Strong"
                hint="1"
                dir="left"
                variant="strong"
                onClick={() => handleVerdict('strong-left')}
              />
              <VerdictBtn
                label="Lean"
                hint="2"
                dir="left"
                variant="lean"
                onClick={() => handleVerdict('lean-left')}
              />
              <VerdictBtn
                label="Tie"
                hint="3"
                variant="tie"
                onClick={() => handleVerdict('tie')}
              />
              <VerdictBtn
                label="Lean"
                hint="4"
                dir="right"
                variant="lean"
                onClick={() => handleVerdict('lean-right')}
              />
              <VerdictBtn
                label="Strong"
                hint="5"
                dir="right"
                variant="strong"
                onClick={() => handleVerdict('strong-right')}
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleSkip}
                className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
              >
                Skip (S)
              </button>
              {matchups.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
                >
                  Undo (Z)
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-zinc-500 py-10">
          Need at least 2 songs to compare.
        </p>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
          <span>{matchups.length} matchups</span>
          <span>Confidence: {conf}%</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500/80 rounded-full transition-all duration-300"
            style={{ width: `${conf}%` }}
          />
        </div>
      </div>

      <h2 className="text-base font-semibold text-zinc-200 mb-3">Rankings</h2>
      <div className="space-y-1.5">
        {sorted.map((song, i) => (
          <div
            key={song.id}
            className="flex items-center gap-3 bg-zinc-900 rounded-lg px-3 py-2.5"
          >
            <span className="text-zinc-600 font-mono text-xs w-5 text-right flex-shrink-0">
              {i + 1}
            </span>
            <img
              src={song.artworkUrl}
              alt=""
              className="w-7 h-7 rounded flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-100 truncate leading-tight">
                {song.name}
              </p>
              <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                {song.albumTitle}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500/50 rounded-full transition-all duration-500"
                    style={{
                      width: `${((song.rating - minR) / range) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-zinc-600 font-mono w-8 text-right flex-shrink-0">
                  {Math.round(song.rating)}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-zinc-600 whitespace-nowrap flex-shrink-0">
              {song.wins}W {song.losses}L {song.ties}T
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-700 text-center mt-8">
        Keys: 1-5 vote &middot; S skip &middot; Z undo
      </p>
    </div>
  );
}

const BASE = 1200;

function SongCard({
  song,
  playing,
  progress,
  onToggle,
}: {
  song: Song;
  playing: boolean;
  progress: number;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col items-center w-32 sm:w-40 md:w-48">
      <button
        onClick={onToggle}
        className="relative group w-full aspect-square rounded-xl overflow-hidden shadow-lg bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
        disabled={!song.previewUrl}
      >
        <img
          src={song.artworkUrl}
          alt={song.name}
          className="w-full h-full object-cover"
        />
        {song.previewUrl ? (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {playing ? <PauseIcon /> : <PlayIcon />}
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-zinc-400 text-[10px]">No preview</span>
          </div>
        )}
      </button>
      {song.previewUrl && (
        <div className="w-full h-0.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-xs sm:text-sm font-medium text-zinc-200 text-center line-clamp-2 leading-tight">
        {song.name}
      </p>
      <p className="mt-1 text-[10px] text-zinc-500 text-center line-clamp-2 leading-tight">
        {song.albumTitle}
      </p>
    </div>
  );
}

function VerdictBtn({
  label,
  hint,
  dir,
  variant,
  onClick,
}: {
  label: string;
  hint: string;
  dir?: 'left' | 'right';
  variant: 'strong' | 'lean' | 'tie';
  onClick: () => void;
}) {
  const arrows = dir === 'left' ? '« ' : dir === 'right' ? ' »' : '';
  const text =
    dir === 'left'
      ? `${arrows}${label}`
      : dir === 'right'
        ? `${label}${arrows}`
        : label;

  const base =
    'px-3 py-2 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50';
  const styles = {
    strong: 'bg-amber-500 hover:bg-amber-400 text-zinc-900',
    lean: 'border border-amber-500/40 text-amber-400 hover:bg-amber-500/10',
    tie: 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
  };

  return (
    <button onClick={onClick} className={`${base} ${styles[variant]}`}>
      {text}
      <span className="ml-1.5 opacity-40">{hint}</span>
    </button>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4 text-zinc-500 flex-shrink-0"
    >
      <path d="M3 9v6h4l5 5V4L7 9H3z" />
      {!muted && (
        <path
          d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-10 h-10 text-white drop-shadow"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-10 h-10 text-white drop-shadow"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}
