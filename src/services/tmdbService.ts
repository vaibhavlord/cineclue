import { Movie, MovieFilters } from '../types/movie';
import { MOVIE_DATABASE } from '../data/movies';

const SEEN_MOVIES_STORAGE_KEY = 'cineclue_seen_tmdb_ids_v1';

export function getSeenMovieIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SEEN_MOVIES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markMovieAsSeen(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const seen = getSeenMovieIds();
    if (!seen.includes(id)) {
      seen.push(id);
      // Keep up to 300 seen IDs before cycling
      if (seen.length > 300) seen.shift();
      localStorage.setItem(SEEN_MOVIES_STORAGE_KEY, JSON.stringify(seen));
    }
  } catch {
    // Ignore storage errors
  }
}

export function resetSeenMovies(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SEEN_MOVIES_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

let cachedNextMovie: Movie | null = null;
let cachedFiltersKey = '';
let isPrefetching = false;

function buildFilterKey(filters?: MovieFilters): string {
  if (!filters) return '';
  const countries = [...(filters.countries || [])].sort().join(',');
  const decades = [...(filters.decades || [])].sort().join(',');
  return `${countries}|${decades}`;
}

/**
 * Fetches a fresh, random, unrepeated movie from the TMDB backend endpoint.
 */
export async function fetchRandomTmdbMovie(
  customExcludeIds: string[] = [],
  filters?: MovieFilters
): Promise<Movie> {
  const currentKey = buildFilterKey(filters);

  // If we already have a pre-fetched movie matching the active filters, use it!
  if (cachedNextMovie && cachedFiltersKey === currentKey && !customExcludeIds.includes(cachedNextMovie.id)) {
    const movieToReturn = cachedNextMovie;
    cachedNextMovie = null;
    // Trigger pre-fetch of the NEXT one in background
    prefetchNextTmdbMovie([...customExcludeIds, movieToReturn.id], filters);
    return movieToReturn;
  }

  const seen = getSeenMovieIds();
  const allExcluded = Array.from(new Set([...seen, ...customExcludeIds]));
  const excludeParam = allExcluded.slice(-50).join(',');

  const queryParams = new URLSearchParams();
  if (excludeParam) queryParams.set('exclude', excludeParam);
  if (filters?.countries && filters.countries.length > 0) {
    queryParams.set('countries', filters.countries.join(','));
  }
  if (filters?.decades && filters.decades.length > 0) {
    queryParams.set('decades', filters.decades.join(','));
  }

  try {
    const res = await fetch(`/api/tmdb/random-movie?${queryParams.toString()}`);
    if (!res.ok) {
      throw new Error(`TMDB endpoint returned ${res.status}`);
    }
    const data = await res.json();
    if (data.movie) {
      markMovieAsSeen(data.movie.id);
      // Start prefetching the next movie
      prefetchNextTmdbMovie([...allExcluded, data.movie.id], filters);
      return data.movie;
    }
  } catch (err) {
    console.warn('Could not fetch from TMDB, falling back to local library:', err);
  }

  // Fallback to random unplayed movie from curated list matching filters
  let pool = MOVIE_DATABASE.filter(m => !allExcluded.includes(m.id));

  if (filters?.decades && filters.decades.length > 0) {
    const decadeMatch = pool.filter(m => {
      if (filters.decades.includes('classic') && m.year < 1970) return true;
      return filters.decades.includes(m.decade);
    });
    if (decadeMatch.length > 0) pool = decadeMatch;
  }

  if (pool.length === 0) pool = MOVIE_DATABASE;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  markMovieAsSeen(picked.id);
  return picked;
}

/**
 * Pre-fetches the next movie in the background to ensure instantaneous transitions
 */
export async function prefetchNextTmdbMovie(
  excludedIds: string[] = [],
  filters?: MovieFilters
): Promise<void> {
  if (isPrefetching) return;
  isPrefetching = true;

  try {
    const seen = getSeenMovieIds();
    const allExcluded = Array.from(new Set([...seen, ...excludedIds]));
    const excludeParam = allExcluded.slice(-50).join(',');

    const queryParams = new URLSearchParams();
    if (excludeParam) queryParams.set('exclude', excludeParam);
    if (filters?.countries && filters.countries.length > 0) {
      queryParams.set('countries', filters.countries.join(','));
    }
    if (filters?.decades && filters.decades.length > 0) {
      queryParams.set('decades', filters.decades.join(','));
    }

    const res = await fetch(`/api/tmdb/random-movie?${queryParams.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.movie) {
        cachedNextMovie = data.movie;
        cachedFiltersKey = buildFilterKey(filters);
      }
    }
  } catch {
    // Ignore prefetch errors
  } finally {
    isPrefetching = false;
  }
}
