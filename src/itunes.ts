export interface ITunesAlbum {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  trackCount: number;
  releaseDate: string;
  collectionType: string;
}

export interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl?: string;
  trackNumber: number;
  discNumber: number;
  wrapperType: string;
}

export type SearchMode = 'artist' | 'album';

async function fetchAlbums(
  query: string,
  attribute?: string,
): Promise<ITunesAlbum[]> {
  const params = new URLSearchParams({
    term: query,
    entity: 'album',
    limit: '200',
  });
  if (attribute) params.set('attribute', attribute);
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.results as ITunesAlbum[];
}

function dedupe(lists: ITunesAlbum[][]): ITunesAlbum[] {
  const seen = new Set<number>();
  const merged: ITunesAlbum[] = [];
  for (const list of lists) {
    for (const album of list) {
      if (!seen.has(album.collectionId)) {
        seen.add(album.collectionId);
        merged.push(album);
      }
    }
  }
  return merged;
}

export async function searchAlbums(
  query: string,
  mode: SearchMode,
): Promise<ITunesAlbum[]> {
  const [primary, general] = await Promise.all([
    fetchAlbums(query, mode === 'artist' ? 'artistTerm' : 'albumTerm'),
    fetchAlbums(query),
  ]);

  const popularityRank = new Map<number, number>();
  general.forEach((album, i) => popularityRank.set(album.collectionId, i));

  const merged = dedupe([general, primary]);
  const q = query.toLowerCase();
  return merged.sort(
    (a, b) =>
      relevance(b, q, mode, popularityRank) -
      relevance(a, q, mode, popularityRank),
  );
}

function relevance(
  album: ITunesAlbum,
  query: string,
  mode: SearchMode,
  popularityRank: Map<number, number>,
): number {
  const artist = album.artistName.toLowerCase();
  const name = album.collectionName.toLowerCase();
  let score = 0;

  const artistWeight = mode === 'artist' ? 2 : 1;
  const albumWeight = mode === 'album' ? 2 : 1;

  if (artist === query) score += 100 * artistWeight;
  else if (artist.startsWith(query)) score += 80 * artistWeight;
  else if (artist.includes(query)) score += 60 * artistWeight;

  if (name === query) score += 50 * albumWeight;
  else if (name.startsWith(query)) score += 40 * albumWeight;
  else if (name.includes(query)) score += 20 * albumWeight;

  const words = query.split(/\s+/);
  if (words.length > 1) {
    const matched = words.filter(
      (w) => artist.includes(w) || name.includes(w),
    );
    score += (matched.length / words.length) * 30;
  }

  score += Math.min(album.trackCount, 25) * 0.5;

  const rank = popularityRank.get(album.collectionId);
  if (rank !== undefined) {
    score += Math.max(0, 60 - rank * 0.3);
  }

  return score;
}

export async function getAlbumTracks(
  collectionId: number,
): Promise<ITunesTrack[]> {
  const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Lookup failed');
  const data = await res.json();
  return (data.results as ITunesTrack[])
    .filter((r) => r.wrapperType === 'track')
    .sort((a, b) =>
      a.discNumber !== b.discNumber
        ? a.discNumber - b.discNumber
        : a.trackNumber - b.trackNumber,
    );
}

export function highResArtwork(url: string, size = 600): string {
  return url.replace('100x100bb', `${size}x${size}bb`);
}
