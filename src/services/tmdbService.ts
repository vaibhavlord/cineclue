import { Movie, MovieFilters } from '../types/movie';
import { MOVIE_DATABASE } from '../data/movies';
import { DEFAULT_FILTERS } from '../data/filterOptions';
import { matchesMovieFilters, normalizeTitle, selectNonRepeatingMovie } from '../game/rules';

const SEEN_MOVIES_STORAGE_KEY = 'cineclue_seen_tmdb_ids_v1';

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
    while (seen.length > 400) {
      seen.shift();
    }
    localStorage.setItem(SEEN_MOVIES_STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function clearSeenMoviePool(poolIdsToClear: string[], keepIds: string[] = []): void {
  const keepSet = new Set(keepIds.flatMap((id) => [id.trim(), normalizeMovieId(id)]));
  const clearSet = new Set(poolIdsToClear.flatMap((id) => [id.trim(), normalizeMovieId(id)]));

  // Also clear corresponding normalized titles from inMemorySeenTitles (except kept movies)
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

function isMovieAlreadyExcluded(movie: Movie, excludedIds: Iterable<string>): boolean {
  const rawId = movie.id.trim();
  const cleanId = normalizeMovieId(rawId);
  const normTitle = normalizeTitle(movie.title);

  for (const ex of excludedIds) {
    if (!ex) continue;
    const exTrim = ex.trim();
    const exClean = normalizeMovieId(exTrim);
    if (exTrim === rawId || exClean === cleanId) {
      return true;
    }
  }

  if (normTitle && inMemorySeenTitles.has(normTitle)) {
    return true;
  }

  return false;
}

/**
 * Fetches a fresh, random, unrepeated movie from the TMDB backend endpoint or verified multi-country archive.
 */
export async function fetchRandomTmdbMovie(
  customExcludeIds: string[] = [],
  filters: MovieFilters = DEFAULT_FILTERS
): Promise<Movie> {
  const activeFilters: MovieFilters = {
    countries: [...(filters?.countries || [])],
    decades: [...(filters?.decades || [])],
  };
  const currentKey = buildFilterKey(activeFilters);
  const seen = getSeenMovieIds();
  const allExcluded = buildOrderedExclusionList(seen, customExcludeIds);

  // 1. If we already have a pre-fetched movie matching the active filters and not excluded, use it and mark it seen!
  if (
    cachedNextMovie &&
    cachedFiltersKey === currentKey &&
    !isMovieAlreadyExcluded(cachedNextMovie, allExcluded) &&
    matchesMovieFilters(cachedNextMovie, activeFilters)
  ) {
    const movieToReturn = cachedNextMovie;
    cachedNextMovie = null;
    markMovieAsSeen(movieToReturn.id, movieToReturn.title);
    prefetchNextTmdbMovie([...allExcluded, movieToReturn.id], activeFilters);
    return movieToReturn;
  }

  // Cancel any in-flight prefetch so it cannot collide with this active request
  cachedNextMovie = null;
  prefetchGeneration += 1;

  const excludeParam = allExcluded.slice(-140).join(',');
  const excludeTitlesParam = getSeenMovieTitles().slice(-50).join(',');
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
    if (!res.ok) {
      throw new Error(`TMDB endpoint returned ${res.status}`);
    }
    const data = await res.json();
    if (data?.movie && matchesMovieFilters(data.movie, activeFilters)) {
      if (data.didCycleFilterPool && Array.isArray(data.filterPoolIds) && data.filterPoolIds.length > 0) {
        clearSeenMoviePool(data.filterPoolIds, [...customExcludeIds.slice(-6), data.movie.id]);
      }
      markMovieAsSeen(data.movie.id, data.movie.title);
      const updatedSeen = getSeenMovieIds();
      prefetchNextTmdbMovie(
        buildOrderedExclusionList(updatedSeen, [...customExcludeIds, data.movie.id]),
        activeFilters
      );
      return data.movie;
    }
  } catch (err) {
    console.warn('Using local multi-country cinema archive:', err);
  }

  // 2. Fallback to curated & global multi-country archive strictly respecting active filters and exclusions
  const immediateExcludes = allExcluded.slice(-8);
  const selection = selectNonRepeatingMovie(
    MOVIE_DATABASE,
    activeFilters,
    allExcluded,
    immediateExcludes,
    Math.random,
    getSeenMovieTitles()
  );

  if (selection.didCycleFilterPool) {
    clearSeenMoviePool(selection.filterPoolIds, [...customExcludeIds.slice(-6), selection.movie.id]);
  }

  markMovieAsSeen(selection.movie.id, selection.movie.title);
  const updatedSeen = getSeenMovieIds();
  prefetchNextTmdbMovie(
    buildOrderedExclusionList(updatedSeen, [...customExcludeIds, selection.movie.id]),
    activeFilters
  );
  return selection.movie;
}

/**
 * Pre-fetches the next movie in the background to ensure instantaneous transitions
 */
export async function prefetchNextTmdbMovie(
  excludedIds: string[] = [],
  filters: MovieFilters = DEFAULT_FILTERS
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
    const excludeParam = allExcluded.slice(-140).join(',');
    const excludeTitlesParam = getSeenMovieTitles().slice(-50).join(',');

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
        if (data.didCycleFilterPool && Array.isArray(data.filterPoolIds) && data.filterPoolIds.length > 0) {
          clearSeenMoviePool(data.filterPoolIds, excludedIds.slice(-6));
        }
        const refreshedExcluded = buildOrderedExclusionList(getSeenMovieIds(), excludedIds.slice(-6));
        if (!isMovieAlreadyExcluded(data.movie, refreshedExcluded)) {
          cachedNextMovie = data.movie;
          cachedFiltersKey = targetKey;
        }
      }
    }
  } catch {
    // Ignore prefetch errors
  }
}


