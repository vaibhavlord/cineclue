/**
 * Pure game rules, scoring logic, and comparison utilities for CineClue.
 */

export interface ScoringParams {
  clueTierRevealed: number; // 1 to 5 (Screenshot #1 to #5)
  incorrectGuesses: number; // 0 to 4
  streakCount: number;
  usedLetterHintCount?: number;
}

/**
 * Calculates score for a correct movie guess across 5 scene screenshots.
 * Screenshot #1 = 1000 pts (0 deducted)
 * Screenshot #2 = 800 pts (-200 pts deducted)
 * Screenshot #3 = 600 pts (-400 pts total, -200 step-by-step)
 * Screenshot #4 = 400 pts (-600 pts total, -200 step-by-step)
 * Screenshot #5 = 200 pts (-800 pts total, -200 step-by-step)
 * Minus 50 pts per incorrect attempt & 50 pts per letter hint unlocked.
 * Streak multiplier: +15% per consecutive win up to 2.0x.
 */
export function calculateScore({
  clueTierRevealed,
  incorrectGuesses = 0,
  streakCount = 0,
  usedLetterHintCount = 0,
}: ScoringParams): number {
  const basePointsByTier: Record<number, number> = {
    1: 1000,
    2: 800,
    3: 600,
    4: 400,
    5: 200,
  };

  const clampedTier = Math.min(Math.max(clueTierRevealed, 1), 5);
  const base = basePointsByTier[clampedTier] ?? 200;
  const incorrectPenalty = incorrectGuesses * 50;
  const letterPenalty = usedLetterHintCount * 50;
  const rawScore = Math.max(100, base - incorrectPenalty - letterPenalty);

  const streakMultiplier = Math.min(2.0, 1.0 + Math.max(0, streakCount - 1) * 0.15);
  return Math.round(rawScore * streakMultiplier);
}

/**
 * Normalizes movie titles for comparison (removes punctuation, extra spaces, casing, leading 'the/a/an')
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    .replace(/^the\s+/, '')
    .replace(/^a\s+/, '')
    .replace(/^an\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if the guessed title matches the target movie title
 */
export function checkTitleMatch(guess: string, target: string): boolean {
  if (!guess || !target) return false;
  const normGuess = normalizeTitle(guess);
  const normTarget = normalizeTitle(target);
  return normGuess.length > 0 && normGuess === normTarget;
}

export type YearComparison = 'exact' | 'earlier' | 'later';

/**
 * Compares release year of guessed movie vs target movie
 */
export function compareReleaseYear(guessYear: number, targetYear: number): YearComparison {
  if (guessYear === targetYear) return 'exact';
  return guessYear < targetYear ? 'earlier' : 'later';
}

/**
 * Checks matching genres between guessed movie and target
 */
export function findMatchingGenres(guessGenres: string[], targetGenres: string[]): string[] {
  const targetLower = new Set(targetGenres.map(g => g.toLowerCase().trim()));
  return guessGenres.filter(g => targetLower.has(g.toLowerCase().trim()));
}

/**
 * Calculate stars rating (1 to 3) based on clues used
 */
export function calculateStarRating(cluesUsed: number, incorrectGuesses: number): 1 | 2 | 3 {
  if (cluesUsed <= 2 && incorrectGuesses <= 1) return 3;
  if (cluesUsed <= 4 && incorrectGuesses <= 2) return 2;
  return 1;
}

/**
 * Generates masked letters for the letter hint tool.
 * Spaces and punctuation stay visible; letters are hidden unless in revealedLetters set.
 */
export function getMaskedTitle(title: string, revealedLetters: Set<string>): string {
  return title
    .split('')
    .map(char => {
      const upper = char.toUpperCase();
      if (!/[A-Z0-9]/.test(upper)) {
        return char;
      }
      return revealedLetters.has(upper) ? char : '_';
    })
    .join('');
}

/**
 * Returns available unrevealed letters from the movie title
 */
export function getAvailableLetterHints(title: string, revealedLetters: Set<string>): string[] {
  const letters = new Set<string>();
  for (const char of title.toUpperCase()) {
    if (/[A-Z]/.test(char) && !revealedLetters.has(char)) {
      letters.add(char);
    }
  }
  return Array.from(letters);
}

export interface TmdbBackdropItem {
  file_path: string;
  iso_639_1?: string | null;
  aspect_ratio?: number;
  width?: number;
  height?: number;
  vote_average?: number;
  vote_count?: number;
}

/**
 * Selects N (default 5) distinct, title-free scene screenshots from a movie's TMDB backdrops list.
 * - Strictly rejects any backdrop with a language tag (iso_639_1 !== null), as TMDB tags images containing titles/logos with a language code.
 * - Excludes the movie's primary promotional backdrop_path (and index 0 header banner when enough scene stills exist), which often contain untagged title art.
 * - Samples across 5 non-overlapping segments of the movie's entire backdrop pool so all 5 screenshots come from different scenes of the same movie.
 */
export function selectDistinctSceneScreenshots(
  backdrops: TmdbBackdropItem[],
  primaryBackdropPath?: string | null,
  requiredCount = 5
): string[] {
  if (!Array.isArray(backdrops) || backdrops.length === 0) {
    return [];
  }

  // 1. Strictly keep only textless (iso_639_1 === null/undefined) widescreen stills with unique file_paths
  const seenPaths = new Set<string>();
  const textlessStills: TmdbBackdropItem[] = [];

  for (const b of backdrops) {
    if (!b || typeof b.file_path !== 'string' || !b.file_path.trim().startsWith('/')) {
      continue;
    }
    // Reject any image tagged with a language (contains movie title / text overlay)
    if (b.iso_639_1 !== null && b.iso_639_1 !== undefined && String(b.iso_639_1).trim() !== '') {
      continue;
    }
    // Reject non-widescreen promotional crops if aspect_ratio is provided
    if (typeof b.aspect_ratio === 'number' && (b.aspect_ratio < 1.65 || b.aspect_ratio > 1.95)) {
      continue;
    }
    // Reject low-res thumbnails if width is provided
    if (typeof b.width === 'number' && b.width < 1000) {
      continue;
    }
    if (seenPaths.has(b.file_path)) {
      continue;
    }
    seenPaths.add(b.file_path);
    textlessStills.push(b);
  }

  if (textlessStills.length < requiredCount) {
    // Second attempt: allow textless stills of any resolution (e.g. classic/international 720p stills)
    for (const b of backdrops) {
      if (!b || typeof b.file_path !== 'string' || !b.file_path.trim().startsWith('/')) {
        continue;
      }
      if (b.iso_639_1 !== null && b.iso_639_1 !== undefined && String(b.iso_639_1).trim() !== '') {
        continue;
      }
      if (seenPaths.has(b.file_path)) {
        continue;
      }
      seenPaths.add(b.file_path);
      textlessStills.push(b);
    }
  }

  if (textlessStills.length < requiredCount) {
    return [];
  }

  // 2. Exclude primary promotional backdrop_path (and top promotional banner at index 0) when enough scene stills exist
  const withoutPrimary = primaryBackdropPath
    ? textlessStills.filter((b) => b.file_path !== primaryBackdropPath)
    : textlessStills;

  let scenePool = withoutPrimary.length >= requiredCount ? withoutPrimary : textlessStills;

  // If the movie has plenty of stills, also skip the first 1-2 highest-voted promotional banners
  if (scenePool.length >= requiredCount + 3) {
    scenePool = scenePool.slice(2);
  } else if (scenePool.length >= requiredCount + 1) {
    scenePool = scenePool.slice(1);
  }

  // 3. Partition scenePool into `requiredCount` non-overlapping segments from deep scenes (Clue #1) to flagship scenes (Clue #5)
  const selectedItems: TmdbBackdropItem[] = [];
  const selectedIndices: number[] = [];
  const selectedPaths = new Set<string>();
  const minIndexDistance = scenePool.length >= requiredCount * 2 ? 2 : 1;

  for (let seg = requiredCount - 1; seg >= 0; seg--) {
    const segStart = Math.floor((seg * scenePool.length) / requiredCount);
    const segEnd = Math.max(segStart + 1, Math.floor(((seg + 1) * scenePool.length) / requiredCount));
    const midIdx = Math.floor((segStart + segEnd - 1) / 2);

    // Build candidate index order inside this segment starting from midpoint outward
    const candidateIndices: number[] = [];
    for (let offset = 0; offset <= segEnd - segStart; offset++) {
      const right = midIdx + offset;
      const left = midIdx - offset;
      if (right >= segStart && right < segEnd && !candidateIndices.includes(right)) {
        candidateIndices.push(right);
      }
      if (left >= segStart && left < segEnd && !candidateIndices.includes(left)) {
        candidateIndices.push(left);
      }
    }

    let chosenIdx = -1;
    // First pass: prefer a still that differs in resolution/vote signature from the last selected still (avoids batch uploads from same scene)
    for (const idx of candidateIndices) {
      const candidate = scenePool[idx];
      if (!candidate || selectedPaths.has(candidate.file_path)) continue;
      const farEnough = selectedIndices.every((prevIdx) => Math.abs(prevIdx - idx) >= minIndexDistance);
      if (!farEnough) continue;

      const prev = selectedItems[selectedItems.length - 1];
      const hasDifferentBatchSignature =
        !prev ||
        prev.width !== candidate.width ||
        prev.height !== candidate.height ||
        prev.vote_average !== candidate.vote_average;

      if (hasDifferentBatchSignature) {
        chosenIdx = idx;
        break;
      }
    }

    // Second pass: any unused candidate in segment respecting index distance
    if (chosenIdx === -1) {
      for (const idx of candidateIndices) {
        const candidate = scenePool[idx];
        if (!candidate || selectedPaths.has(candidate.file_path)) continue;
        const farEnough = selectedIndices.every((prevIdx) => Math.abs(prevIdx - idx) >= minIndexDistance);
        if (farEnough) {
          chosenIdx = idx;
          break;
        }
      }
    }

    // Third pass: any unused candidate in segment
    if (chosenIdx === -1) {
      for (const idx of candidateIndices) {
        const candidate = scenePool[idx];
        if (candidate && !selectedPaths.has(candidate.file_path)) {
          chosenIdx = idx;
          break;
        }
      }
    }

    if (chosenIdx !== -1) {
      const chosen = scenePool[chosenIdx];
      selectedItems.push(chosen);
      selectedIndices.push(chosenIdx);
      selectedPaths.add(chosen.file_path);
    }
  }

  // Fill any remaining slots if needed from unused textless stills
  if (selectedItems.length < requiredCount) {
    for (const b of scenePool) {
      if (selectedItems.length >= requiredCount) break;
      if (!selectedPaths.has(b.file_path)) {
        selectedItems.push(b);
        selectedPaths.add(b.file_path);
      }
    }
  }

  if (selectedItems.length < requiredCount) {
    return [];
  }

  return selectedItems
    .slice(0, requiredCount)
    .map((item) => `https://image.tmdb.org/t/p/w1280${item.file_path}`);
}

export interface FilterableMovieItem {
  id: string;
  title: string;
  year: number;
  decade?: string;
  country?: string;
}

export interface FilterCriteria {
  countries: string[];
  decades: string[];
}

/**
 * Checks whether a movie matches the active Country and Decade filter criteria.
 */
export function matchesMovieFilters(movie: FilterableMovieItem, filters: FilterCriteria): boolean {
  const activeCountries = (filters?.countries || [])
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const activeDecades = (filters?.decades || [])
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (activeCountries.length > 0) {
    const movieCountry = (movie.country || 'US').trim().toUpperCase();
    if (!activeCountries.includes(movieCountry)) {
      return false;
    }
  }

  if (activeDecades.length > 0) {
    const year = Number(movie.year) || 2000;
    const computedDecade = year < 1970 ? 'classic' : `${Math.floor(year / 10) * 10}s`;
    const movieDecadeLower = (movie.decade || '').trim().toLowerCase();

    const matchesDecade = activeDecades.some((dec) => {
      if (dec === 'classic' || dec === '1960s') {
        return year < 1970 || movieDecadeLower === 'classic' || movieDecadeLower === '1960s';
      }
      return dec === computedDecade || dec === movieDecadeLower;
    });

    if (!matchesDecade) {
      return false;
    }
  }

  return true;
}

/**
 * Selects a random non-repeating movie from a catalog while strictly respecting filters.
 * Deduplicates by both ID and normalized movie title.
 * If all movies in the filtered pool have been seen, resets seen status only for that filtered pool
 * while keeping immediateExcludeIds excluded so back-to-back or near repeats never happen.
 */
export function selectNonRepeatingMovie<T extends FilterableMovieItem>(
  catalog: T[],
  filters: FilterCriteria,
  seenIds: Iterable<string>,
  immediateExcludeIds: Iterable<string> = [],
  randomFn: () => number = Math.random,
  extraExcludedTitles: Iterable<string> = []
): { movie: T; didCycleFilterPool: boolean; filterPoolIds: string[] } {
  if (!catalog || catalog.length === 0) {
    throw new Error('Movie catalog cannot be empty');
  }

  // 1. Determine filtered pool: strict Country + Decade match first
  let filteredPool = catalog.filter((m) => matchesMovieFilters(m, filters));

  // If strict Country + Decade intersection is empty in local catalog, prioritize Decade match if only decade or both set, then Country match
  if (filteredPool.length === 0 && filters.decades.length > 0) {
    filteredPool = catalog.filter((m) =>
      matchesMovieFilters(m, { countries: [], decades: filters.decades })
    );
  }
  if (filteredPool.length === 0 && filters.countries.length > 0) {
    filteredPool = catalog.filter((m) =>
      matchesMovieFilters(m, { countries: filters.countries, decades: [] })
    );
  }
  if (filteredPool.length === 0) {
    filteredPool = catalog;
  }

  const filterPoolIds = filteredPool.map((m) => m.id);

  // Build exclusion sets for IDs (both raw and without tmdb- prefix) and normalized titles
  const normalizeId = (id: string) => id.trim().replace(/^tmdb-/, '');
  const seenIdSet = new Set<string>();
  for (const id of seenIds) {
    if (id && id.trim()) {
      seenIdSet.add(id.trim());
      seenIdSet.add(normalizeId(id));
    }
  }

  const immediateList = Array.from(immediateExcludeIds).filter((id) => Boolean(id && id.trim()));
  // Keep at most half the pool (or up to 10 recent items) in immediate exclusion so cycling never starves small pools
  const maxImmediateCount = Math.max(1, Math.min(10, Math.floor((filteredPool.length - 1) / 2) || 1));
  const boundedImmediateList =
    filteredPool.length <= 1 ? [] : immediateList.slice(-maxImmediateCount);

  const immediateIdSet = new Set<string>();
  for (const id of boundedImmediateList) {
    immediateIdSet.add(id.trim());
    immediateIdSet.add(normalizeId(id));
  }

  const excludedTitles = new Set<string>();
  for (const t of extraExcludedTitles) {
    const norm = normalizeTitle(t);
    if (norm) excludedTitles.add(norm);
  }

  const immediateTitles = new Set<string>();
  for (const m of catalog) {
    const rawId = m.id.trim();
    const cleanId = normalizeId(rawId);
    const normTitle = normalizeTitle(m.title);
    if (seenIdSet.has(rawId) || seenIdSet.has(cleanId)) {
      if (normTitle) excludedTitles.add(normTitle);
    }
    if (immediateIdSet.has(rawId) || immediateIdSet.has(cleanId)) {
      if (normTitle) {
        excludedTitles.add(normTitle);
        immediateTitles.add(normTitle);
      }
    }
  }

  const isExcluded = (m: T) => {
    const rawId = m.id.trim();
    const cleanId = normalizeId(rawId);
    const normTitle = normalizeTitle(m.title);
    return (
      seenIdSet.has(rawId) ||
      seenIdSet.has(cleanId) ||
      immediateIdSet.has(rawId) ||
      immediateIdSet.has(cleanId) ||
      (normTitle.length > 0 && excludedTitles.has(normTitle))
    );
  };

  const isImmediateExcluded = (m: T) => {
    const rawId = m.id.trim();
    const cleanId = normalizeId(rawId);
    const normTitle = normalizeTitle(m.title);
    return (
      immediateIdSet.has(rawId) ||
      immediateIdSet.has(cleanId) ||
      (normTitle.length > 0 && immediateTitles.has(normTitle))
    );
  };

  let candidates = filteredPool.filter((m) => !isExcluded(m));
  let didCycleFilterPool = false;

  // If the player has exhausted every movie in this specific filter pool, cycle the filter pool
  // while still strictly preserving the active filter and avoiding the recently played movie(s)
  if (candidates.length === 0) {
    didCycleFilterPool = true;
    const withoutImmediate = filteredPool.filter((m) => !isImmediateExcluded(m));
    candidates = withoutImmediate.length > 0 ? withoutImmediate : filteredPool;
  }

  const index = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(randomFn() * candidates.length))
  );

  return {
    movie: candidates[index],
    didCycleFilterPool,
    filterPoolIds,
  };
}



