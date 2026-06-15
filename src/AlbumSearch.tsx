import { useState } from 'react';
import type { Session, Song } from './types';
import {
  findItunesAlbum,
  getAlbumTracks,
  highResArtwork,
  type ITunesAlbum,
} from './itunes';
import { searchAlbums, type DeezerAlbum, type SearchMode } from './deezer';
import { createSong } from './engine';

function buildSession(album: ITunesAlbum, songs: Song[]): Session {
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
  const [mode, setMode] = useState<SearchMode>('artist');
  const [results, setResults] = useState<DeezerAlbum[]>([]);
  const [matchedArtist, setMatchedArtist] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [hideSingles, setHideSingles] = useState(true);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setError(null);
    setHasSearched(true);
    setMatchedArtist(null);

    try {
      const result = await searchAlbums(q, mode);
      setResults(result.albums);
      setMatchedArtist(result.matchedArtist);
      if (result.albums.length === 0) {
        setError('No albums found. Try a different search.');
      }
    } catch {
      setError('Search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSelect(album: DeezerAlbum) {
    setLoadingId(album.id);
    setError(null);

    try {
      const itunesAlbum = await findItunesAlbum(album.artistName, album.title);
      if (!itunesAlbum) {
        setError(
          `"${album.title}" isn't available on iTunes. Try another album.`,
        );
        setLoadingId(null);
        return;
      }

      const tracks = await getAlbumTracks(itunesAlbum.collectionId);
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

      onCreateSession(buildSession(itunesAlbum, songs));
    } catch {
      setError('Failed to load tracks. Try again.');
      setLoadingId(null);
    }
  }

  const filtered = results.filter(
    (a) => !hideSingles || a.trackCount >= 5,
  );

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

      {/* Search mode toggle */}
      <div className="flex gap-1 mb-4 bg-zinc-900 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('artist')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'artist'
              ? 'bg-amber-500 text-zinc-900'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          By Artist
        </button>
        <button
          type="button"
          onClick={() => setMode('album')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'album'
              ? 'bg-amber-500 text-zinc-900'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          By Album
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === 'artist' ? 'Artist name...' : 'Album name...'
          }
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

      {error && <p className="text-rose-400 text-sm mb-6">{error}</p>}

      {matchedArtist && (
        <p className="text-sm text-zinc-400 mb-4">
          Showing albums by{' '}
          <span className="text-zinc-200 font-medium">{matchedArtist}</span>
        </p>
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
            {filtered.map((album) => {
              const isLoading = loadingId === album.id;
              return (
                <button
                  key={album.id}
                  onClick={() => handleSelect(album)}
                  disabled={loadingId !== null}
                  className="group text-left bg-zinc-900 rounded-xl p-3 hover:bg-zinc-800 transition-colors disabled:opacity-60"
                >
                  <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-zinc-800">
                    {album.coverUrl && (
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    {isLoading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-zinc-100 truncate">
                    {album.title}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {album.artistName}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {album.trackCount} tracks
                  </p>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-zinc-500 text-center py-8">
              All results hidden by filter. Uncheck to see singles &amp; EPs.
            </p>
          )}
        </div>
      )}

      {hasSearched && !searching && results.length === 0 && !error && (
        <p className="text-zinc-500 text-center py-12">No results</p>
      )}
    </div>
  );
}
