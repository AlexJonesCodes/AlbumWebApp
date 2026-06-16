export type SearchMode = 'artist' | 'album' | 'multi';

export interface DeezerAlbum {
  id: number;
  title: string;
  coverUrl: string;
  trackCount: number | null;
  recordType: string;
  artistName: string;
  explicit: boolean;
}

export interface SearchResult {
  albums: DeezerAlbum[];
  matchedArtist: string | null;
}

interface RawAlbum {
  id: number;
  title: string;
  cover_big: string;
  nb_tracks?: number;
  record_type?: string;
  explicit_lyrics?: boolean;
  artist?: { id: number; name: string };
}

interface RawArtist {
  id: number;
  name: string;
}

export async function searchAlbums(
  query: string,
  mode: SearchMode,
): Promise<SearchResult> {
  return mode === 'artist'
    ? searchByArtist(query)
    : searchByAlbumName(query);
}

async function searchByArtist(query: string): Promise<SearchResult> {
  const artistRes = await fetch(
    `/api/deezer/search/artist?q=${encodeURIComponent(query)}&limit=1`,
  );
  if (!artistRes.ok) throw new Error('Search failed');
  const artistData = await artistRes.json();

  if (!artistData.data?.length) {
    return { albums: [], matchedArtist: null };
  }

  const artist = artistData.data[0] as RawArtist;

  const albumsRes = await fetch(
    `/api/deezer/artist/${artist.id}/albums?limit=100`,
  );
  if (!albumsRes.ok) throw new Error('Failed to load albums');
  const albumsData = await albumsRes.json();

  const albums = deduplicatePreferExplicit(
    ((albumsData.data || []) as RawAlbum[]).map((a) => toAlbum(a, artist.name)),
  );

  return { albums, matchedArtist: artist.name };
}

async function searchByAlbumName(query: string): Promise<SearchResult> {
  const res = await fetch(
    `/api/deezer/search/album?q=${encodeURIComponent(query)}&limit=50`,
  );
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();

  const albums = deduplicatePreferExplicit(
    ((data.data || []) as RawAlbum[]).map((a) =>
      toAlbum(a, a.artist?.name ?? ''),
    ),
  );

  return { albums, matchedArtist: null };
}

function toAlbum(raw: RawAlbum, artistName: string): DeezerAlbum {
  return {
    id: raw.id,
    title: raw.title,
    coverUrl: raw.cover_big || '',
    trackCount:
      typeof raw.nb_tracks === 'number' && raw.nb_tracks > 0
        ? raw.nb_tracks
        : null,
    recordType: raw.record_type || '',
    artistName,
    explicit: raw.explicit_lyrics ?? false,
  };
}

function deduplicatePreferExplicit(albums: DeezerAlbum[]): DeezerAlbum[] {
  const seen = new Map<string, DeezerAlbum>();

  for (const album of albums) {
    const key = album.title.toLowerCase().trim();
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, album);
      continue;
    }

    const preferred = pickPreferredAlbum(existing, album);
    const alternate = preferred === existing ? album : existing;
    seen.set(key, mergeAlbum(preferred, alternate));
  }

  return [...seen.values()];
}

function pickPreferredAlbum(a: DeezerAlbum, b: DeezerAlbum): DeezerAlbum {
  const aIsLongForm = isLongFormRelease(a.recordType);
  const bIsLongForm = isLongFormRelease(b.recordType);

  if (aIsLongForm !== bIsLongForm) {
    return aIsLongForm ? a : b;
  }

  if (a.explicit !== b.explicit) {
    return a.explicit ? a : b;
  }

  const aTrackCount = a.trackCount ?? 0;
  const bTrackCount = b.trackCount ?? 0;
  if (aTrackCount !== bTrackCount) {
    return aTrackCount > bTrackCount ? a : b;
  }

  return a;
}

function mergeAlbum(preferred: DeezerAlbum, alternate: DeezerAlbum): DeezerAlbum {
  return {
    ...preferred,
    coverUrl: preferred.coverUrl || alternate.coverUrl,
    trackCount: Math.max(preferred.trackCount ?? 0, alternate.trackCount ?? 0) || null,
    recordType: preferred.recordType || alternate.recordType,
    artistName: preferred.artistName || alternate.artistName,
    explicit: preferred.explicit || alternate.explicit,
  };
}

function isLongFormRelease(recordType: string): boolean {
  const normalized = recordType.toLowerCase();
  return normalized !== 'single' && normalized !== 'ep';
}

export interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  trackPosition: number;
  diskNumber: number;
  artistName: string;
}

export interface DeezerAlbumDetail {
  id: number;
  title: string;
  coverXl: string;
  artistName: string;
  tracks: DeezerTrack[];
}

interface RawTrack {
  id: number;
  title: string;
  preview: string;
  track_position: number;
  disk_number: number;
  artist: { name: string };
}

interface RawAlbumDetail {
  id: number;
  title: string;
  cover_xl: string;
  artist: { name: string };
  tracks: { data: RawTrack[] };
}

export async function getDeezerAlbum(
  albumId: number,
): Promise<DeezerAlbumDetail> {
  const res = await fetch(`/api/deezer/album/${albumId}`);
  if (!res.ok) throw new Error('Failed to load album');
  const raw = (await res.json()) as RawAlbumDetail;

  return {
    id: raw.id,
    title: raw.title,
    coverXl: raw.cover_xl || '',
    artistName: raw.artist.name,
    tracks: raw.tracks.data
      .map((t) => ({
        id: t.id,
        title: t.title,
        preview: t.preview,
        trackPosition: t.track_position,
        diskNumber: t.disk_number,
        artistName: t.artist.name,
      }))
      .sort((a, b) =>
        a.diskNumber !== b.diskNumber
          ? a.diskNumber - b.diskNumber
          : a.trackPosition - b.trackPosition,
      ),
  };
}
