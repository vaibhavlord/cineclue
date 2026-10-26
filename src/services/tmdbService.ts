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

export function getSeenMovieTitles(): string[] {
  const combined = new Set<string>(inMemorySeenTitles);
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SEEN_TITLES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string' && item.trim()) {
              const norm = normalizeTitle(item);
              if (norm) {
                combined.add(norm);
                inMemorySeenTitles.add(norm);
              }
            }
          }
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }
  return Array.from(combined);
}

export function getSeenMovieIds(): string[] {
  const combined = new Set<string>(inMemorySeenIds);
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SEEN_MOVIES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string' && item.trim()) {
              const id = item.trim();
              combined.add(id);
              inMemorySeenIds.add(id);
            }
          }
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }
  return Array.from(combined);
}

export function markMovieAsSeen(id: string, title?: string): void {
  if (!id) return;
  const trimmedId = id.trim();
  inMemorySeenIds.add(trimmedId);

  let normTitle = '';
  if (title) {
    normTitle = normalizeTitle(title);
    if (normTitle) inMemorySeenTitles.add(normTitle);
  }

  if (typeof window === 'undefined') return;
  try {
    const norm = normalizeMovieId(trimmedId);
    const seen = getSeenMovieIds().filter((s) => s !== trimmedId && s !== norm);
    seen.push(trimmedId);
    while (seen.length > 500) {
      seen.shift();
    }
    localStorage.setItem(SEEN_MOVIES_STORAGE_KEY, JSON.stringify(seen));

    if (normTitle) {
      const seenTitles = getSeenMovieTitles().filter((t) => t !== normTitle);
      seenTitles.push(normTitle);
      while (seenTitles.length > 500) {
        seenTitles.shift();
      }
      localStorage.setItem(SEEN_TITLES_STORAGE_KEY, JSON.stringify(seenTitles));
    }
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function clearSeenMoviePool(poolIdsToClear: string[], keepIds: string[] = []): void {
  const keepSet = new Set(keepIds.flatMap((id) => [id.trim(), normalizeMovieId(id)]));
  const clearSet = new Set(poolIdsToClear.flatMap((id) => [id.trim(), normalizeMovieId(id)]));

  for (const id of Array.from(inMemorySeenIds)) {
    const norm = normalizeMovieId(id);
    if ((clearSet.has(id) || clearSet.has(norm)) && !keepSet.has(id) && !keepSet.has(norm)) {
      inMemorySeenIds.delete(id);
    }
  }

  for (const m of MOVIE_DATABASE) {
    const norm = normalizeMovieId(m.id);
    if ((clearSet.has(m.id) || clearSet.has(norm)) && !keepSet.has(m.id) && !keepSet.has(norm)) {
      const normTitle = normalizeTitle(m.title);
      if (normTitle) inMemorySeenTitles.delete(normTitle);
    }
  }

  if (typeof window === 'undefined') return;
  try {
    const current = getSeenMovieIds().filter((id) => {
      const norm = normalizeMovieId(id);
      return (!clearSet.has(id) && !clearSet.has(norm)) || keepSet.has(id) || keepSet.has(norm);
    });
    localStorage.setItem(SEEN_MOVIES_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage errors
  }
}

export function resetSeenMovies(): void {
  inMemorySeenIds.clear();
  inMemorySeenTitles.clear();
  clearMoviePrefetchCache();
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

function isMovieAlreadyExcluded(movie: Movie, excludedIds: Iterable<string>): boolean {
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

  if (normTitle && inMemorySeenTitles.has(normTitle)) {
    return true;
  }

  return false;
}

/**
 * Fetches a fresh, random, unrepeated movie from TMDB matching active filters.
 */
export async function fetchRandomTmdbMovie(
  customExcludeIds: string[] = [],
  filters: MovieFilters = DEFAULT_FILTERS
): Promise<Movie> {
  const activeFilters: MovieFilters = {
    countries: filters?.countries || [],
    decades: filters?.decades || [],
  };
  const currentKey = buildFilterKey(activeFilters);
  const seenIds = getSeenMovieIds();
  const seenTitles = getSeenMovieTitles();
  const allExcluded = Array.from(new Set([...seenIds, ...customExcludeIds]));

  // 1. If we already have a pre-fetched movie matching active filters and not excluded, use it and mark it seen!
  if (
    cachedNextMovie &&
    cachedFiltersKey === currentKey &&
    !isMovieAlreadyExcluded(cachedNextMovie, allExcluded) &&
    !customExcludeIds.includes(cachedNextMovie.id) &&
    !customExcludeIds.map(normalizeMovieId).includes(normalizeMovieId(cachedNextMovie.id)) &&
    matchesMovieFilters(cachedNextMovie, activeFilters)
  ) {
    const movieToReturn = cachedNextMovie;
    cachedNextMovie = null;
    markMovieAsSeen(movieToReturn.id, movieToReturn.title);
    prefetchNextTmdbMovie([...allExcluded, movieToReturn.id], activeFilters);
    return movieToReturn;
  }

  // Clear any stale cached movie that did not match current filters or exclusions
  cachedNextMovie = null;

  const excludeParam = allExcluded.slice(-150).join(',');
  const excludeTitlesParam = seenTitles.slice(-100).map((t) => encodeURIComponent(t)).join('|');

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
  queryParams.set('_t', String(Date.now()));

  const res = await fetch(`/api/tmdb/random-movie?${queryParams.toString()}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    let errData: any = {};
    try {
      errData = await res.json();
    } catch {
      // ignore
    }
    const error: any = new Error(errData?.error || `TMDB service returned HTTP ${res.status}`);
    error.code = errData?.code || (res.status === 409 ? 'EXHAUSTED_POOL' : `HTTP_${res.status}`);
    error.status = res.status;
    error.exhausted = Boolean(errData?.exhausted || res.status === 409);
    throw error;
  }

  const data = await res.json();
  if (data?.movie && matchesMovieFilters(data.movie, activeFilters)) {
    markMovieAsSeen(data.movie.id, data.movie.title);
    prefetchNextTmdbMovie([...allExcluded, data.movie.id], activeFilters);
    return data.movie;
  }

  // If payload movie is missing or does not match active filters
  const fallbackError: any = new Error('No matching movie returned from TMDB for the active filters.');
  fallbackError.code = 'EXHAUSTED_POOL';
  fallbackError.status = 409;
  fallbackError.exhausted = true;
  throw fallbackError;
}

/**
 * Pre-fetches the next movie in the background to ensure instantaneous round transitions
 */
export async function prefetchNextTmdbMovie(
  excludedIds: string[] = [],
  filters: MovieFilters = DEFAULT_FILTERS
): Promise<void> {
  const activeFilters: MovieFilters = {
    countries: filters?.countries || [],
    decades: filters?.decades || [],
  };
  const targetKey = buildFilterKey(activeFilters);
  const myGeneration = ++prefetchGeneration;

  try {
    const seenIds = getSeenMovieIds();
    const seenTitles = getSeenMovieTitles();
    const allExcluded = Array.from(new Set([...seenIds, ...excludedIds]));
    const excludeParam = allExcluded.slice(-150).join(',');
    const excludeTitlesParam = seenTitles.slice(-100).map((t) => encodeURIComponent(t)).join('|');

    const queryParams = new URLSearchParams();
    if (excludeParam) queryParams.set('exclude', excludeParam);
    if (excludeTitlesParam) queryParams.set('excludeTitles', excludeTitlesParam);
    if (activeFilters.countries.length > 0) {
      queryParams.set('countries', activeFilters.countries.join(','));
    }
    if (activeFilters.decades.length > 0) {
      queryParams.set('decades', activeFilters.decades.join(','));
    }
    queryParams.set('_t', String(Date.now() + 1));

    const res = await fetch(`/api/tmdb/random-movie?${queryParams.toString()}`, {
      cache: 'no-store',
    });
    if (myGeneration !== prefetchGeneration) return;

    if (res.ok) {
      const data = await res.json();
      if (
        myGeneration === prefetchGeneration &&
        data?.movie &&
        !isMovieAlreadyExcluded(data.movie, allExcluded) &&
        matchesMovieFilters(data.movie, activeFilters)
      ) {
        cachedNextMovie = data.movie;
        cachedFiltersKey = targetKey;
      }
    }
  } catch {
    // Ignore prefetch background errors
  }
}

