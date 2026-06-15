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
  return merged.sort((a, b) => b.trackCount - a.trackCount);
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
