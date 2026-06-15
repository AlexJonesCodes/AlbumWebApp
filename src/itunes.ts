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

export async function searchAlbums(query: string): Promise<ITunesAlbum[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return (data.results as ITunesAlbum[])
    .sort((a, b) => b.trackCount - a.trackCount);
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
