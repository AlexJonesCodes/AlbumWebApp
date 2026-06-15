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
