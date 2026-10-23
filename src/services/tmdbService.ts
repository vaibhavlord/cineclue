import { Movie, MovieFilters } from '../types/movie';
import { MOVIE_DATABASE } from '../data/movies';
import { DEFAULT_FILTERS } from '../data/filterOptions';
import { matchesMovieFilters, normalizeTitle, selectNonRepeatingMovie } from '../game/rules';

const SEEN_MOVIES_STORAGE_KEY = 'cineclue_seen_tmdb_ids_v1';
const SEEN_TITLES_STORAGE_KEY = 'cineclue_seen_titles_v1';

// In-memory seen tracking ensures non-repetition even on devices/webviews where localStorage is restricted
const inMemorySeenIds = new Set<string>();
const inMemorySeenTitles = new Set<string>();

function normalizeMovieId(id: string): string {
  return id.trim().replace(/^tmdb-/, '');
}

export function getSeenMovieIds(): string[] {
  const ordered: string[] = [];
  const pushUnique = (rawItem: string) => {
    const trimmed = rawItem.trim();
    if (!trimmed) return;
    const norm = normalizeMovieId(trimmed);
    const existingIdx = ordered.findIndex(
      (x) => x === trimmed || normalizeMovieId(x) === norm
    );
    if (existingIdx !== -1) {
      ordered.splice(existingIdx, 1);
    }
    ordered.push(trimmed);
  };

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SEEN_MOVIES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string' && item.trim()) {
              pushUnique(item);
            }
          }
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }

  for (const memId of inMemorySeenIds) {
    pushUnique(memId);
  }

  // Sync inMemorySeenIds in chronological order
  inMemorySeenIds.clear();
  for (const item of ordered) {
    inMemorySeenIds.add(item);
  }

  return ordered;
}

export function getSeenMovieTitles(): string[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SEEN_TITLES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string' && item.trim()) {
              const nt = normalizeTitle(item);
              if (nt) inMemorySeenTitles.add(nt);
            }
          }
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }
  return Array.from(inMemorySeenTitles);
}

export function markMovieAsSeen(id: string, title?: string): void {
  if (!id) return;
  const trimmedId = id.trim();
  const normId = normalizeMovieId(trimmedId);

  // Move to end of inMemorySeenIds (most recently seen last)
  for (const existing of Array.from(inMemorySeenIds)) {
    if (existing === trimmedId || normalizeMovieId(existing) === normId) {
      inMemorySeenIds.delete(existing);
    }
  }
  inMemorySeenIds.add(trimmedId);

  // Resolve title from parameter or MOVIE_DATABASE if available
  const resolvedTitle =
    title ||
    MOVIE_DATABASE.find(
      (m) => m.id === trimmedId || normalizeMovieId(m.id) === normId
    )?.title;
  if (resolvedTitle) {
    const normTitle = normalizeTitle(resolvedTitle);
    if (normTitle) {
      inMemorySeenTitles.delete(normTitle);
      inMemorySeenTitles.add(normTitle);
    }
  }

  if (typeof window === 'undefined') return;
  try {
    const seen = getSeenMovieIds().filter(
      (x) => x !== trimmedId && normalizeMovieId(x) !== normId
    );
    seen.push(trimmedId);
    while (seen.length > 500) {
      seen.shift();
    }
    localStorage.setItem(SEEN_MOVIES_STORAGE_KEY, JSON.stringify(seen));
    localStorage.setItem(
      SEEN_TITLES_STORAGE_KEY,
      JSON.stringify(Array.from(inMemorySeenTitles).slice(-500))
    );
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function clearSeenMoviePool(poolIdsToClear: string[], keepIds: string[] = []): void {
  const keepSet = new Set(keepIds.flatMap((id) => [id.trim(), normalizeMovieId(id)]));
  const clearSet = new Set(poolIdsToClear.flatMap((id) => [id.trim(), normalizeMovieId(id)]));

  const keepTitles = new Set<string>();
  const clearTitles = new Set<string>();
  for (const m of MOVIE_DATABASE) {
    const rawId = m.id.trim();
    const norm = normalizeMovieId(rawId);
    const nt = normalizeTitle(m.title);
    if (!nt) continue;
    if (keepSet.has(rawId) || keepSet.has(norm)) {
      keepTitles.add(nt);
    } else if (clearSet.has(rawId) || clearSet.has(norm)) {
      clearTitles.add(nt);
    }
  }

  for (const t of Array.from(inMemorySeenTitles)) {
    if (clearTitles.has(t) && !keepTitles.has(t)) {
      inMemorySeenTitles.delete(t);
    }
  }

  for (const id of Array.from(inMemorySeenIds)) {
    const norm = normalizeMovieId(id);
    if ((clearSet.has(id) || clearSet.has(norm)) && !keepSet.has(id) && !keepSet.has(norm)) {
      inMemorySeenIds.delete(id);
    }
  }

  if (typeof window === 'undefined') return;
  try {
    const current = getSeenMovieIds().filter((id) => {
      const norm = normalizeMovieId(id);
      return (!clearSet.has(id) && !clearSet.has(norm)) || keepSet.has(id) || keepSet.has(norm);
    });
    localStorage.setItem(SEEN_MOVIES_STORAGE_KEY, JSON.stringify(current));
    localStorage.setItem(
      SEEN_TITLES_STORAGE_KEY,
      JSON.stringify(Array.from(inMemorySeenTitles))
    );
  } catch {
    // Ignore storage errors
  }
}

export function resetSeenMovies(): void {
  inMemorySeenIds.clear();
  inMemorySeenTitles.clear();
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SEEN_MOVIES_STORAGE_KEY);
    localStorage.removeItem(SEEN_TITLES_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

let cachedNextMovie: Movie | null = null;
let cachedFiltersKey = '';
let prefetchGeneration = 0;

function buildFilterKey(filters?: MovieFilters): string {
  if (!filters) return '|';
  const countries = [...(filters.countries || [])]
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(',');
  const decades = [...(filters.decades || [])]
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',');
  return `${countries}|${decades}`;
}

export function clearMoviePrefetchCache(): void {
  cachedNextMovie = null;
  cachedFiltersKey = '';
  prefetchGeneration += 1;
}

function buildOrderedExclusionList(seen: string[], customExcludeIds: string[]): string[] {
  const ordered: string[] = [];
  const pushItem = (raw: string) => {
    if (!raw || !raw.trim()) return;
    const trimmed = raw.trim();
    const norm = normalizeMovieId(trimmed);
    const idx = ordered.findIndex((x) => x === trimmed || normalizeMovieId(x) === norm);
    if (idx !== -1) ordered.splice(idx, 1);
    ordered.push(trimmed);
  };
  for (const id of seen) pushItem(id);
  for (const id of customExcludeIds) pushItem(id);
  return ordered;
}

function isMovieAlreadyExcluded(
  movie: Movie,
  excludedIds: Iterable<string>,
  excludedTitles: Iterable<string> = []
): boolean {
  const rawId = movie.id.trim();
  const cleanId = normalizeMovieId(rawId);
  const normTitle = normalizeTitle(movie.title);

  for (const ex of excludedIds) {
    if (!ex) continue;
    const exTrim = ex.trim();
    const exClean = normalizeMovieId(exTrim);
    if (exTrim === rawId || exClean === cleanId || `tmdb-${exClean}` === rawId) {
      return true;
    }
  }

  const titleSet = new Set(inMemorySeenTitles);
  for (const t of excludedTitles) {
    const nt = normalizeTitle(t);
    if (nt) titleSet.add(nt);
  }

  if (normTitle && titleSet.has(normTitle)) {
    return true;
  }

  return false;
}

/**
 * Fetches a fresh, random, unrepeated movie from the TMDB backend endpoint or verified multi-country archive.
 * Returns null if no eligible unused movie matches the active filters.
 */
export async function fetchRandomTmdbMovie(
  customExcludeIds: string[] = [],
  filters: MovieFilters = DEFAULT_FILTERS,
  customExcludeTitles: string[] = []
): Promise<Movie | null> {
  const activeFilters: MovieFilters = {
    countries: [...(filters?.countries || [])],
    decades: [...(filters?.decades || [])],
  };
  const currentKey = buildFilterKey(activeFilters);
  const seen = getSeenMovieIds();
  const allExcluded = buildOrderedExclusionList(seen, customExcludeIds);
  const seenTitles = getSeenMovieTitles();
  const allExcludedTitles = Array.from(
    new Set([...seenTitles, ...customExcludeTitles.map(normalizeTitle).filter(Boolean)])
  );

  // 1. If we already have a pre-fetched movie matching the active filters and not excluded, use it and mark it seen!
  if (
    cachedNextMovie &&
    cachedFiltersKey === currentKey &&
    !isMovieAlreadyExcluded(cachedNextMovie, allExcluded, allExcludedTitles) &&
    matchesMovieFilters(cachedNextMovie, activeFilters)
  ) {
    const movieToReturn = cachedNextMovie;
    cachedNextMovie = null;
    markMovieAsSeen(movieToReturn.id, movieToReturn.title);
    prefetchNextTmdbMovie(
      [...allExcluded, movieToReturn.id],
      activeFilters,
      [...allExcludedTitles, movieToReturn.title]
    );
    return movieToReturn;
  }

  // Cancel any in-flight prefetch so it cannot collide with this active request
  cachedNextMovie = null;
  prefetchGeneration += 1;

  const excludeParam = allExcluded.slice(-140).join(',');
  const excludeTitlesParam = allExcludedTitles.slice(-50).join(',');
  const queryParams = new URLSearchParams();
  if (excludeParam) queryParams.set('exclude', excludeParam);
  if (excludeTitlesParam) queryParams.set('excludeTitles', excludeTitlesParam);
  if (activeFilters.countries.length > 0) {
    queryParams.set('countries', activeFilters.countries.join(','));
  }
  if (activeFilters.decades.length > 0) {
    queryParams.set('decades', activeFilters.decades.join(','));
  }
  // Cache-busting timestamp prevents intermediate proxies/browsers from caching GET responses across rounds
  queryParams.set('_t', `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  try {
    const res = await fetch(`/api/tmdb/random-movie?${queryParams.toString()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (
        data?.movie &&
        matchesMovieFilters(data.movie, activeFilters) &&
        !isMovieAlreadyExcluded(data.movie, allExcluded, allExcludedTitles)
      ) {
        markMovieAsSeen(data.movie.id, data.movie.title);
        const updatedSeen = getSeenMovieIds();
        prefetchNextTmdbMovie(
          buildOrderedExclusionList(updatedSeen, [...customExcludeIds, data.movie.id]),
          activeFilters,
          [...allExcludedTitles, data.movie.title]
        );
        return data.movie;
      }
      // When live TMDB reports exhausted or no unused movie matches active filters, return null
      return null;
    }
  } catch (err) {
    console.warn('Live TMDB lookup error:', err);
  }

  // 2. Fallback to curated & global multi-country archive strictly respecting active filters and exclusions
  const immediateExcludes = allExcluded.slice(-8);
  const selection = selectNonRepeatingMovie(
    MOVIE_DATABASE,
    activeFilters,
    allExcluded,
    immediateExcludes,
    Math.random,
    allExcludedTitles
  );

  if (selection.movie) {
    markMovieAsSeen(selection.movie.id, selection.movie.title);
    const updatedSeen = getSeenMovieIds();
    prefetchNextTmdbMovie(
      buildOrderedExclusionList(updatedSeen, [...customExcludeIds, selection.movie.id]),
      activeFilters,
      [...allExcludedTitles, selection.movie.title]
    );
    return selection.movie;
  }

  return null;
}

/**
 * Pre-fetches the next movie in the background to ensure instantaneous transitions
 */
export async function prefetchNextTmdbMovie(
  excludedIds: string[] = [],
  filters: MovieFilters = DEFAULT_FILTERS,
  excludedTitles: string[] = []
): Promise<void> {
  const activeFilters: MovieFilters = {
    countries: [...(filters?.countries || [])],
    decades: [...(filters?.decades || [])],
  };
  const targetKey = buildFilterKey(activeFilters);
  const myGeneration = ++prefetchGeneration;

  try {
    const seen = getSeenMovieIds();
    const allExcluded = buildOrderedExclusionList(seen, excludedIds);
    const seenTitles = getSeenMovieTitles();
    const allExcludedTitles = Array.from(
      new Set([...seenTitles, ...excludedTitles.map(normalizeTitle).filter(Boolean)])
    );

    const excludeParam = allExcluded.slice(-140).join(',');
    const excludeTitlesParam = allExcludedTitles.slice(-50).join(',');

    const queryParams = new URLSearchParams();
    if (excludeParam) queryParams.set('exclude', excludeParam);
    if (excludeTitlesParam) queryParams.set('excludeTitles', excludeTitlesParam);
    if (activeFilters.countries.length > 0) {
      queryParams.set('countries', activeFilters.countries.join(','));
    }
    if (activeFilters.decades.length > 0) {
      queryParams.set('decades', activeFilters.decades.join(','));
    }
    queryParams.set('_t', `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    const res = await fetch(`/api/tmdb/random-movie?${queryParams.toString()}`, {
      cache: 'no-store',
    });
    if (myGeneration !== prefetchGeneration) return;

    if (res.ok) {
      const data = await res.json();
      if (
        myGeneration === prefetchGeneration &&
        data?.movie &&
        matchesMovieFilters(data.movie, activeFilters)
      ) {
        const refreshedExcluded = buildOrderedExclusionList(getSeenMovieIds(), excludedIds.slice(-6));
        const refreshedTitles = getSeenMovieTitles();
        if (!isMovieAlreadyExcluded(data.movie, refreshedExcluded, refreshedTitles)) {
          cachedNextMovie = data.movie;
          cachedFiltersKey = targetKey;
        }
      }
    }
  } catch {
    // Ignore prefetch errors
  }
}

// ============================================================================
// COMPLETE RANDOM MOVIE CLUE API CLIENT
// ============================================================================

export interface PublicRoundData {
  roundId: string;
  totalClues: number;
  revealedClues: number;
  maxGuesses: number;
  remainingGuesses: number;
  imageUrls: string[]; // 5 w780 URLs
  decade?: string;
  country?: string;
  genres?: string[];
}

export interface GuessResult {
  isCorrect: boolean;
  isGameOver: boolean;
  roundStatus?: 'won' | 'lost' | 'playing';
  pointsEarned?: number;
  revealedClues?: number;
  remainingGuesses?: number;
  message?: string;
  guessRecord?: any;
  movie?: Movie;
  error?: string;
}

export interface RevealClueResult {
  revealedClues: number;
  totalClues: number;
  remainingClues: number;
  isFinished?: boolean;
}

export interface SkipResult {
  skipped: boolean;
  isGameOver: boolean;
  roundStatus: 'lost';
  pointsEarned: number;
  revealedClues: number;
  message: string;
  movie: Movie;
}

/**
 * Preloads image clues in the background without displaying them early.
 */
export function preloadClueImages(urls: string[]): void {
  if (!urls || !Array.isArray(urls) || typeof window === 'undefined') return;
  urls.forEach((url) => {
    if (url && typeof url === 'string') {
      const img = new Image();
      img.src = url;
    }
  });
}

/**
 * Starts a new random movie round via server endpoint.
 * Secret movie title, ID, and answer metadata are never exposed in the response.
 */
export async function startNewGameRound(
  filters: MovieFilters = DEFAULT_FILTERS,
  customExcludeIds: string[] = [],
  customExcludeTitles: string[] = []
): Promise<PublicRoundData> {
  const seen = getSeenMovieIds();
  const allExcluded = buildOrderedExclusionList(seen, customExcludeIds);
  const seenTitles = getSeenMovieTitles();
  const allExcludedTitles = Array.from(
    new Set([...seenTitles, ...customExcludeTitles.map(normalizeTitle).filter(Boolean)])
  );

  const res = await fetch('/api/game/round/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      excludeIds: allExcluded.slice(-140),
      excludeTitles: allExcludedTitles.slice(-50),
      countries: filters.countries || [],
      decades: filters.decades || [],
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to start game round: ${res.statusText}`);
  }

  const data: PublicRoundData = await res.json();

  // Preload all 5 backdrop clues in background without displaying them early
  if (Array.isArray(data.imageUrls)) {
    preloadClueImages(data.imageUrls);
  }

  return data;
}

/**
 * Unlocks the next clue image (clues 2 through 5)
 */
export async function revealNextRoundClue(roundId: string): Promise<RevealClueResult> {
  const res = await fetch('/api/game/round/reveal-clue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to reveal next clue: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Submits player guess to server for case-insensitive normalized validation.
 * Answer is only returned when round ends (won or out of guesses).
 */
export async function submitRoundGuess(roundId: string, guess: string): Promise<GuessResult> {
  const res = await fetch('/api/game/round/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId, guess }),
  });

  const data: GuessResult = await res.json();

  if (data.isGameOver && data.movie) {
    markMovieAsSeen(data.movie.id, data.movie.title);
  }

  return data;
}

/**
 * Skips the current round, forfeits score, and reveals the answer.
 */
export async function skipGameRound(roundId: string): Promise<SkipResult> {
  const res = await fetch('/api/game/round/skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to skip round: ${res.statusText}`);
  }

  const data: SkipResult = await res.json();
  if (data.movie) {
    markMovieAsSeen(data.movie.id, data.movie.title);
  }

  return data;
}



