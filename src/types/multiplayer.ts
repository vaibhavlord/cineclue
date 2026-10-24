import { MovieFilters, MinimalistArt, CastDossierItem } from './movie';

export interface MultiplayerPlayer {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  joinedAt: number;
}

export interface MultiplayerMovieSafe {
  id: string;
  year: number;
  decade: string;
  country?: string;
  director: string;
  genres: string[];
  difficulty: 'Novice' | 'Cinephile' | 'Director';
  emojiCryptogram: string;
  tagline: {
    prompt: string;
    blank: string;
    full: string;
  };
  quote: {
    dialogue: string;
    speakerRole: string;
    context: string;
  };
  minimalistArt: MinimalistArt;
  castDossier: CastDossierItem[];
  boxOfficeTrivia: {
    oscars: string;
    budgetOrGross: string;
    secretTrivia: string;
  };
  screenshots?: string[];
  posterUrl?: string | null;
  backdropUrl?: string | null;
}

export interface SolvedMovieRecord {
  movieIndex: number;
  title: string;
  year: number;
  solvedByPlayerId: string;
  solvedByPlayerName: string;
  timestamp: number;
}

export interface RoomState {
  code: string; // 6-character room code (e.g. "CLUE42")
  createdAt: number;
  status: 'lobby' | 'playing' | 'ended' | 'abandoned';
  hostId: string;
  players: Record<string, MultiplayerPlayer>;
  filters: MovieFilters;
  matchDurationSeconds: number; // 60 seconds
  matchStartTime: number | null;
  matchEndTime: number | null;
  currentMovieIndex: number;
  currentMovieSolvedBy: string | null;
  currentMovieSolvedTitle: string | null;
  solvedHistory: SolvedMovieRecord[];
  movieList: MultiplayerMovieSafe[];
  winnerId: string | null;
  isTie: boolean;
  abandonedReason?: string;
  recentEvent?: {
    type: 'solve' | 'join' | 'leave' | 'start' | 'timeout';
    message: string;
    playerId?: string;
    timestamp: number;
  };
}
