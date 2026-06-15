export type MatchResult =
  | 'strong-left'
  | 'lean-left'
  | 'tie'
  | 'lean-right'
  | 'strong-right';

export interface Song {
  id: string;
  itunesTrackId: number;
  name: string;
  artist: string;
  artworkUrl: string;
  previewUrl: string | null;
  rating: number;
  comparisons: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface MatchupRecord {
  songAId: string;
  songBId: string;
  result: MatchResult;
  timestamp: number;
}

export interface Session {
  id: string;
  albumName: string;
  artistName: string;
  artworkUrl: string;
  collectionId: number;
  songs: Song[];
  matchups: MatchupRecord[];
  createdAt: number;
  updatedAt: number;
}
