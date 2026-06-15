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

export async function searchAlbums(query: string): Promise<ITunesAlbum[]> {
  const [general, byAlbum, byArtist] = await Promise.all([
    fetchAlbums(query),
    fetchAlbums(query, 'albumTerm'),
    fetchAlbums(query, 'artistTerm'),
  ]);

  const seen = new Set<number>();
  const merged: ITunesAlbum[] = [];
  for (const album of [...general, ...byAlbum, ...byArtist]) {
    if (!seen.has(album.collectionId)) {
      seen.add(album.collectionId);
      merged.push(album);
    }
  }
  const q = query.toLowerCase();
  return merged.sort((a, b) => relevance(b, q) - relevance(a, q));
}

function relevance(album: ITunesAlbum, query: string): number {
  const artist = album.artistName.toLowerCase();
  const name = album.collectionName.toLowerCase();
  let score = 0;

  if (artist === query) score += 100;
  else if (artist.startsWith(query)) score += 80;
  else if (artist.includes(query)) score += 60;

  if (name === query) score += 50;
  else if (name.startsWith(query)) score += 40;
  else if (name.includes(query)) score += 20;

  const words = query.split(/\s+/);
  if (words.length > 1) {
    const matched = words.filter((w) => artist.includes(w) || name.includes(w));
    score += (matched.length / words.length) * 30;
  }

  score += Math.min(album.trackCount, 25) * 0.5;

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
