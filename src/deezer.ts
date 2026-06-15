export type SearchMode = 'artist' | 'album';

export interface DeezerAlbum {
  id: number;
  title: string;
  coverUrl: string;
  trackCount: number;
  recordType: string;
  artistName: string;
}

export interface SearchResult {
  albums: DeezerAlbum[];
  matchedArtist: string | null;
}

interface RawAlbum {
  id: number;
  title: string;
  cover_big: string;
  nb_tracks: number;
  record_type: string;
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

  const albums = ((albumsData.data || []) as RawAlbum[]).map((a) =>
    toAlbum(a, artist.name),
  );

  return { albums, matchedArtist: artist.name };
}

async function searchByAlbumName(query: string): Promise<SearchResult> {
  const res = await fetch(
    `/api/deezer/search/album?q=${encodeURIComponent(query)}&limit=50`,
  );
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();

  const albums = ((data.data || []) as RawAlbum[]).map((a) =>
    toAlbum(a, a.artist?.name ?? ''),
  );

  return { albums, matchedArtist: null };
}

function toAlbum(raw: RawAlbum, artistName: string): DeezerAlbum {
  return {
    id: raw.id,
    title: raw.title,
    coverUrl: raw.cover_big || '',
    trackCount: raw.nb_tracks,
    recordType: raw.record_type,
    artistName,
  };
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
