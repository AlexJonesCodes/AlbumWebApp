import type { Song, MatchResult, MatchupRecord } from './types';

const BASE_RATING = 1200;
const BASE_K = 32;

export function createSong(
  trackId: number,
  name: string,
  artist: string,
  albumTitle: string,
  artworkUrl: string,
  previewUrl: string | null,
): Song {
  return {
    id: `song-${trackId}`,
    trackId,
    name,
    artist,
    albumTitle,
    artworkUrl,
    previewUrl,
    rating: BASE_RATING,
    comparisons: 0,
    wins: 0,
    losses: 0,
    ties: 0,
  };
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

function kFactor(comparisons: number): number {
  return Math.max(16, BASE_K * 0.95 ** comparisons);
}

function resultScores(result: MatchResult): [number, number] {
  switch (result) {
    case 'strong-left':
      return [1.0, 0.0];
    case 'lean-left':
      return [0.75, 0.25];
    case 'tie':
      return [0.5, 0.5];
    case 'lean-right':
      return [0.25, 0.75];
    case 'strong-right':
      return [0.0, 1.0];
  }
}

export function applyMatchup(
  songs: Song[],
  songAId: string,
  songBId: string,
  result: MatchResult,
): Song[] {
  const songA = songs.find((s) => s.id === songAId);
  const songB = songs.find((s) => s.id === songBId);
  if (!songA || !songB) return songs;

  const [sA, sB] = resultScores(result);
  const eA = expectedScore(songA.rating, songB.rating);
  const eB = 1 - eA;
  const kA = kFactor(songA.comparisons);
  const kB = kFactor(songB.comparisons);

  return songs.map((song) => {
    if (song.id === songAId) {
      return {
        ...song,
        rating: song.rating + kA * (sA - eA),
        comparisons: song.comparisons + 1,
        wins: song.wins + (sA > 0.5 ? 1 : 0),
        losses: song.losses + (sA < 0.5 ? 1 : 0),
        ties: song.ties + (sA === 0.5 ? 1 : 0),
      };
    }
    if (song.id === songBId) {
      return {
        ...song,
        rating: song.rating + kB * (sB - eB),
        comparisons: song.comparisons + 1,
        wins: song.wins + (sB > 0.5 ? 1 : 0),
        losses: song.losses + (sB < 0.5 ? 1 : 0),
        ties: song.ties + (sB === 0.5 ? 1 : 0),
      };
    }
    return song;
  });
}

export function pickPair(
  songs: Song[],
  matchups: MatchupRecord[],
): [string, string] | null {
  if (songs.length < 2) return null;

  const minComparisons = Math.min(...songs.map((s) => s.comparisons));
  const underCompared = songs.filter(
    (s) => s.comparisons <= minComparisons + 1,
  );
  const pool = underCompared.length >= 2 ? underCompared : songs;

  const recentWindow = Math.max(1, Math.floor(songs.length / 2));
  const recentPairs = new Set(
    matchups.slice(-recentWindow).map((m) => {
      const ids = [m.songAId, m.songBId].sort();
      return `${ids[0]}|${ids[1]}`;
    }),
  );

  const candidates: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      const pairKey = [a.id, b.id].sort().join('|');
      const ratingDiff = Math.abs(a.rating - b.rating);
      const recentPenalty = recentPairs.has(pairKey) ? 1000 : 0;
      const compBonus = (a.comparisons + b.comparisons) * 5;
      candidates.push({ a: a.id, b: b.id, score: ratingDiff + recentPenalty + compBonus });
    }
  }

  if (candidates.length === 0) {
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    return [shuffled[0].id, shuffled[1].id];
  }

  candidates.sort((a, b) => a.score - b.score);
  const topN = Math.min(3, candidates.length);
  const pick = candidates[Math.floor(Math.random() * topN)];
  return Math.random() < 0.5 ? [pick.a, pick.b] : [pick.b, pick.a];
}

export function confidence(songs: Song[]): number {
  if (songs.length < 2) return 100;
  const target = Math.max(3, Math.ceil(Math.log2(songs.length)) + 1);
  const total = songs.reduce(
    (sum, s) => sum + Math.min(s.comparisons / target, 1),
    0,
  );
  return Math.round((total / songs.length) * 100);
}

export function undoLastMatchup(
  songs: Song[],
  matchups: MatchupRecord[],
): { songs: Song[]; matchups: MatchupRecord[] } | null {
  if (matchups.length === 0) return null;

  const remaining = matchups.slice(0, -1);
  let rebuilt = songs.map((s) => ({
    ...s,
    rating: BASE_RATING,
    comparisons: 0,
    wins: 0,
    losses: 0,
    ties: 0,
  }));
  for (const m of remaining) {
    rebuilt = applyMatchup(rebuilt, m.songAId, m.songBId, m.result);
  }
  return { songs: rebuilt, matchups: remaining };
}
