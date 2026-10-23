export interface CastDossierItem {
  archetype: string;
  characterDescription: string;
  actorInitials: string;
}

export interface MinimalistArt {
  primaryBg: string; // Tailwind or Hex
  accentColor: string;
  themeSymbol: string; // SVG icon or symbol key
  description: string;
}

export interface Movie {
  id: string;
  title: string;
  year: number;
  decade: string; // e.g. "1990s"
  director: string;
  genres: string[];
  difficulty: 'Novice' | 'Cinephile' | 'Director';

  // Progressive Clues
  emojiCryptogram: string; // Clue 1: Emojis & Decade/Genre
  tagline: {
    prompt: string; // e.g. "In space, no one can hear you ______"
    blank: string;  // e.g. "scream"
    full: string;   // e.g. "In space, no one can hear you scream."
  }; // Clue 2: Tagline fill-in / decode
  quote: {
    dialogue: string;
    speakerRole: string; // e.g. "The Morpheus figure" or character title
    context: string;
  }; // Clue 3: Dialogue audio soundbite
  minimalistArt: MinimalistArt; // Clue 4: Visual silhouette & color palette
  castDossier: CastDossierItem[]; // Clue 5: Archetypes
  boxOfficeTrivia: {
    oscars: string;
    budgetOrGross: string;
    secretTrivia: string;
  }; // Clue 6: Deep trivia & box office
  screenshots?: string[]; // 5 distinct scene screenshots (Frame 1 to Frame 5)
  posterUrl?: string | null;
  backdropUrl?: string | null;
  country?: string; // e.g. "US", "GB", "JP", "IN", "FR", "KR"
}

export interface MovieFilters {
  countries: string[]; // empty array means "All Countries"
  decades: string[];   // empty array means "All Decades"
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export interface DecadeOption {
  id: string;
  label: string;
  sublabel: string;
  startYear: number;
  endYear: number;
}

export interface GuessRecord {
  title: string;
  year: number;
  genres: string[];
  isCorrect: boolean;
  yearRelation: 'exact' | 'earlier' | 'later';
  decadeMatch: boolean;
  genreMatches: string[];
  guessNumber: number;
}

export type GameMode = 'campaign' | 'daily' | 'speedrun' | 'ai-custom';

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  bestStreak: number;
  totalScore: number;
  clueDistribution: {
    clue1: number;
    clue2: number;
    clue3: number;
    clue4: number;
    clue5: number;
    clue6: number;
  };
  solvedMovies: string[];
}
