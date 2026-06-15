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

async function fetchAlbums(query: string): Promise<ITunesAlbum[]> {
  const params = new URLSearchParams({
    term: query,
    entity: 'album',
    limit: '200',
  });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.results as ITunesAlbum[];
}

function strip(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function findItunesAlbum(
  artistName: string,
  albumTitle: string,
): Promise<ITunesAlbum | null> {
  const results = await fetchAlbums(`${artistName} ${albumTitle}`);
  if (results.length === 0) return null;

  const targetArtist = strip(artistName);
  const targetAlbum = strip(albumTitle);

  let bestMatch: ITunesAlbum | null = null;
  let bestScore = -1;

  for (const r of results) {
    const a = strip(r.artistName);
    const n = strip(r.collectionName);
    let score = 0;

    if (a === targetArtist) score += 50;
    else if (a.includes(targetArtist) || targetArtist.includes(a)) score += 30;

    if (n === targetAlbum) score += 50;
    else if (n.includes(targetAlbum) || targetAlbum.includes(n)) score += 30;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = r;
    }
  }

  return bestMatch;
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
