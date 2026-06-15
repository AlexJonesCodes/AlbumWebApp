import { useState, useRef } from 'react';
import type { Session, Song } from './types';
import {
  searchAlbums,
  getAlbumTracks,
  highResArtwork,
  type ITunesAlbum,
} from './itunes';
import { createSong } from './engine';

function buildSession(
  album: ITunesAlbum,
  songs: Song[],
): Session {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    albumName: album.collectionName,
    artistName: album.artistName,
    artworkUrl: highResArtwork(album.artworkUrl100),
    collectionId: album.collectionId,
    songs,
    matchups: [],
    createdAt: now,
    updatedAt: now,
  };
}

interface Props {
  onCreateSession: (session: Session) => void;
  onBack: () => void;
}

export function AlbumSearch({ onCreateSession, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ITunesAlbum[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [hideSingles, setHideSingles] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const albums = await searchAlbums(q);
      setResults(albums);
      if (albums.length === 0) {
        setError('No albums found. Try a different search.');
      }
    } catch {
      setError('Search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSelect(album: ITunesAlbum) {
    setLoadingId(album.collectionId);
    setError(null);

    try {
      const tracks = await getAlbumTracks(album.collectionId);
      if (tracks.length < 2) {
        setError('This album needs at least 2 tracks to rank.');
        setLoadingId(null);
        return;
      }

      const songs = tracks.map((t) =>
        createSong(
          t.trackId,
          t.trackName,
          t.artistName,
          highResArtwork(t.artworkUrl100),
          t.previewUrl ?? null,
        ),
      );

      onCreateSession(buildSession(album, songs));
    } catch {
      setError('Failed to load tracks. Try again.');
      setLoadingId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <button
        onClick={onBack}
        className="text-zinc-400 hover:text-zinc-100 transition-colors text-sm mb-8 block"
      >
        &larr; Back
      </button>

      <h1 className="text-2xl font-bold text-zinc-100 mb-6 tracking-tight">
        Find an Album
      </h1>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Album or artist name..."
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          autoFocus
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <p className="text-rose-400 text-sm mb-6">{error}</p>
      )}

      {results.length > 0 && (
        <div>
          <label className="flex items-center gap-2 mb-4 text-sm text-zinc-400 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={hideSingles}
              onChange={(e) => setHideSingles(e.target.checked)}
              className="accent-amber-500"
            />
            Hide singles &amp; EPs (fewer than 5 tracks)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {results.filter((a) => !hideSingles || a.trackCount >= 5).map((album) => {
            const isLoading = loadingId === album.collectionId;
            const year = new Date(album.releaseDate).getFullYear();
            return (
              <button
                key={album.collectionId}
                onClick={() => handleSelect(album)}
                disabled={loadingId !== null}
                className="group text-left bg-zinc-900 rounded-xl p-3 hover:bg-zinc-800 transition-colors disabled:opacity-60"
              >
                <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-zinc-800">
                  <img
                    src={highResArtwork(album.artworkUrl100, 300)}
                    alt={album.collectionName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-zinc-100 truncate">
                  {album.collectionName}
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  {album.artistName}
                </p>
                <p className="text-xs text-zinc-600">
                  {year} &middot; {album.trackCount} tracks
                </p>
              </button>
            );
          })}
          </div>
        </div>
      )}

      {hasSearched && !searching && results.length === 0 && !error && (
        <p className="text-zinc-500 text-center py-12">No results</p>
      )}
    </div>
  );
}
