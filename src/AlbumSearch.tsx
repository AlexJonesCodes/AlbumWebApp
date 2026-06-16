import { useState } from 'react';
import type { Session, Song } from './types';
import {
  searchAlbums,
  getDeezerAlbum,
  type DeezerAlbum,
  type DeezerAlbumDetail,
  type SearchMode,
} from './deezer';
import { createSong } from './engine';

function buildSession(albums: DeezerAlbumDetail[], songs: Song[]): Session {
  const now = Date.now();
  const primaryAlbum = albums[0];
  const albumNames = albums.map((album) => album.title);
  const albumIds = albums.map((album) => album.id);

  return {
    id: crypto.randomUUID(),
    albumName:
      albums.length === 1
        ? primaryAlbum.title
        : `${primaryAlbum.artistName} Mix`,
    artistName: primaryAlbum.artistName,
    artworkUrl: primaryAlbum.coverXl,
    albumId: primaryAlbum.id,
    albumIds,
    albumNames,
    songs,
    matchups: [],
    createdAt: now,
    updatedAt: now,
  };
}

function buildSongsFromAlbums(albums: DeezerAlbumDetail[]): Song[] {
  const songs = new Map<number, Song>();

  for (const album of albums) {
    for (const track of album.tracks) {
      if (songs.has(track.id)) continue;

      songs.set(
        track.id,
        createSong(
          track.id,
          track.title,
          track.artistName,
          album.title,
          album.coverXl,
          track.preview || null,
        ),
      );
    }
  }

  return [...songs.values()];
}

function hasEnoughTracksForAlbumFilter(album: DeezerAlbum): boolean {
  if (typeof album.trackCount === 'number' && album.trackCount > 0) {
    return album.trackCount >= 5;
  }

  const recordType = album.recordType.toLowerCase();
  return recordType !== 'single' && recordType !== 'ep';
}

function formatAlbumMeta(album: DeezerAlbum): string {
  if (typeof album.trackCount === 'number' && album.trackCount > 0) {
    return `${album.trackCount} tracks`;
  }

  const recordType = album.recordType.toLowerCase();
  if (recordType === 'single') return 'Single';
  if (recordType === 'ep') return 'EP';
  if (recordType === 'compile') return 'Compilation';
  return 'Album';
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
  const [creatingMultiAlbum, setCreatingMultiAlbum] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [hideSingles, setHideSingles] = useState(true);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<number[]>([]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setError(null);
    setHasSearched(true);
    setMatchedArtist(null);
    setSelectedAlbumIds([]);

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
      const detail = await getDeezerAlbum(album.id);
      if (detail.tracks.length < 2) {
        setError('This album needs at least 2 tracks to rank.');
        setLoadingId(null);
        return;
      }

      const songs = detail.tracks.map((track) =>
        createSong(
          track.id,
          track.title,
          track.artistName,
          detail.title,
          detail.coverXl,
          track.preview || null,
        ),
      );

      onCreateSession(buildSession([detail], songs));
    } catch {
      setError('Failed to load tracks. Try again.');
      setLoadingId(null);
    }
  }

  async function handleCreateMultiAlbumSession() {
    if (selectedAlbumIds.length === 0) return;

    const selectedAlbums = results.filter((album) =>
      selectedAlbumIds.includes(album.id),
    );
    if (selectedAlbums.length === 0) return;

    setCreatingMultiAlbum(true);
    setError(null);

    try {
      const albums = await Promise.all(
        selectedAlbums.map((album) => getDeezerAlbum(album.id)),
      );
      const songs = buildSongsFromAlbums(albums);

      if (songs.length < 2) {
        setError('You need at least 2 unique tracks across those albums.');
        return;
      }

      onCreateSession(buildSession(albums, songs));
    } catch {
      setError('Failed to load the selected albums. Try again.');
    } finally {
      setCreatingMultiAlbum(false);
    }
  }

  function toggleAlbumSelection(albumId: number) {
    setSelectedAlbumIds((current) =>
      current.includes(albumId)
        ? current.filter((id) => id !== albumId)
        : [...current, albumId],
    );
  }

  function switchMode(nextMode: SearchMode) {
    setMode(nextMode);
    setError(null);
    setSelectedAlbumIds([]);
  }

  const filtered = results.filter(
    (album) => !hideSingles || hasEnoughTracksForAlbumFilter(album),
  );
  const isBusy = searching || creatingMultiAlbum || loadingId !== null;

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

      <div className="flex gap-1 mb-4 bg-zinc-900 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => switchMode('artist')}
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
          onClick={() => switchMode('album')}
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
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={hideSingles}
                onChange={(e) => setHideSingles(e.target.checked)}
                className="accent-amber-500"
              />
              Hide singles &amp; EPs (fewer than 5 tracks)
            </label>
            {mode === 'artist' && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">
                  {selectedAlbumIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleCreateMultiAlbumSession}
                  disabled={selectedAlbumIds.length === 0 || isBusy}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  {creatingMultiAlbum
                    ? 'Building ranking...'
                    : 'Rank selected albums'}
                </button>
              </div>
            )}
          </div>

          {mode === 'artist' && (
            <p className="text-xs text-zinc-500 mb-4">
              Select multiple albums to build one combined ranking.
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((album) => {
              const isLoading = loadingId === album.id;
              const isSelected = selectedAlbumIds.includes(album.id);
              const isArtistMode = mode === 'artist';

              return (
                <button
                  key={album.id}
                  onClick={() =>
                    isArtistMode
                      ? toggleAlbumSelection(album.id)
                      : handleSelect(album)
                  }
                  disabled={isBusy && !isArtistMode}
                  className={`group text-left bg-zinc-900 rounded-xl p-3 transition-colors disabled:opacity-60 ${
                    isSelected
                      ? 'ring-2 ring-amber-500 bg-zinc-800'
                      : 'hover:bg-zinc-800'
                  }`}
                  aria-pressed={isArtistMode ? isSelected : undefined}
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
                    {isArtistMode && (
                      <div className="absolute top-2 right-2">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${
                            isSelected
                              ? 'bg-amber-500 text-zinc-900 border-amber-400'
                              : 'bg-black/60 text-zinc-200 border-zinc-600'
                          }`}
                        >
                          {isSelected ? '✓' : '+'}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-zinc-100 truncate">
                    {album.title}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {album.artistName}
                  </p>
                  <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                    {formatAlbumMeta(album)}
                    {album.explicit && (
                      <span className="inline-flex items-center justify-center w-4 h-4 bg-zinc-600 text-zinc-200 text-[9px] font-bold rounded-sm leading-none">
                        E
                      </span>
                    )}
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
