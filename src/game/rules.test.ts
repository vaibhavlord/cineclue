import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateScore,
  normalizeTitle,
  checkTitleMatch,
  compareReleaseYear,
  findMatchingGenres,
  calculateStarRating,
  getMaskedTitle,
  getAvailableLetterHints,
  selectDistinctSceneScreenshots,
  matchesMovieFilters,
  selectNonRepeatingMovie,
} from './rules.ts';
import {
  isFilterActive,
  formatFilterSummary,
  DEFAULT_FILTERS,
  MAJOR_COUNTRIES,
  DECADE_OPTIONS,
} from '../data/filterOptions.ts';
import { MOVIE_DATABASE } from '../data/movies.ts';

test('scoring gives 1000 base points on first clue with 0 incorrect guesses', () => {
  const score = calculateScore({
    clueTierRevealed: 1,
    incorrectGuesses: 0,
    streakCount: 1,
  });
  assert.equal(score, 1000);
});

test('scoring scales down step-by-step across 5 screenshots (-200 pts each) and incorrect guesses', () => {
  assert.equal(calculateScore({ clueTierRevealed: 1, incorrectGuesses: 0, streakCount: 1 }), 1000);
  assert.equal(calculateScore({ clueTierRevealed: 2, incorrectGuesses: 0, streakCount: 1 }), 800);
  assert.equal(calculateScore({ clueTierRevealed: 3, incorrectGuesses: 0, streakCount: 1 }), 600);
  assert.equal(calculateScore({ clueTierRevealed: 4, incorrectGuesses: 0, streakCount: 1 }), 400);
  assert.equal(calculateScore({ clueTierRevealed: 5, incorrectGuesses: 0, streakCount: 1 }), 200);

  const score = calculateScore({
    clueTierRevealed: 3,
    incorrectGuesses: 2,
    streakCount: 1,
  });
  // Tier 3 = 600 base - 2 * 50 (100) = 500
  assert.equal(score, 500);
});

test('scoring applies streak multipliers for consecutive wins', () => {
  const scoreStreak1 = calculateScore({ clueTierRevealed: 1, incorrectGuesses: 0, streakCount: 1 });
  const scoreStreak3 = calculateScore({ clueTierRevealed: 1, incorrectGuesses: 0, streakCount: 3 });
  assert.equal(scoreStreak1, 1000);
  assert.equal(scoreStreak3, 1300); // 1.0 + (3-1)*0.15 = 1.3x -> 1300
});

test('normalizeTitle cleans leading articles and special characters', () => {
  assert.equal(normalizeTitle('The Dark Knight'), 'darkknight');
  assert.equal(normalizeTitle('A Quiet Place, Part II'), 'quietplacepartii');
  assert.equal(normalizeTitle('   An American Werewolf in London   '), 'americanwerewolfinlondon');
});

test('checkTitleMatch matches titles regardless of case, articles, and symbols', () => {
  assert.equal(checkTitleMatch('The Matrix', 'Matrix'), true);
  assert.equal(checkTitleMatch('Lord of the Rings: Fellowship', 'The Lord of the Rings: Fellowship'), true);
  assert.equal(checkTitleMatch('Inception', 'Interstellar'), false);
  assert.equal(checkTitleMatch('', 'Inception'), false);
});

test('compareReleaseYear accurately returns exact, earlier, and later', () => {
  assert.equal(compareReleaseYear(1994, 1994), 'exact');
  assert.equal(compareReleaseYear(1982, 1994), 'earlier');
  assert.equal(compareReleaseYear(2010, 1994), 'later');
});

test('findMatchingGenres returns intersection of genre tags', () => {
  const matches = findMatchingGenres(['Action', 'Sci-Fi', 'Thriller'], ['Drama', 'Sci-Fi', 'Action']);
  assert.deepEqual(matches, ['Action', 'Sci-Fi']);
});

test('calculateStarRating assigns 3, 2, or 1 stars depending on clues', () => {
  assert.equal(calculateStarRating(1, 0), 3);
  assert.equal(calculateStarRating(2, 1), 3);
  assert.equal(calculateStarRating(3, 1), 2);
  assert.equal(calculateStarRating(4, 2), 2);
  assert.equal(calculateStarRating(5, 2), 1);
});

test('getMaskedTitle hides unknown letters while preserving punctuation and spaces', () => {
  const revealed = new Set(['T', 'A', 'N']);
  const masked = getMaskedTitle('TITANIC!', revealed);
  assert.equal(masked, 'T_TAN__!');
});

test('getAvailableLetterHints returns remaining letters', () => {
  const revealed = new Set(['A', 'L', 'I', 'E', 'N']);
  const hints = getAvailableLetterHints('ALIEN', revealed);
  assert.equal(hints.length, 0);

  const partialHints = getAvailableLetterHints('JAWS', new Set(['J']));
  assert.deepEqual(partialHints.sort(), ['A', 'S', 'W']);
});

test('isFilterActive correctly detects when country or decade filters are active', () => {
  assert.equal(isFilterActive(DEFAULT_FILTERS), false);
  assert.equal(isFilterActive({ countries: ['JP'], decades: [] }), true);
  assert.equal(isFilterActive({ countries: [], decades: ['1990s'] }), true);
  assert.equal(isFilterActive({ countries: ['FR', 'IT'], decades: ['1970s'] }), true);

  assert.equal(formatFilterSummary(DEFAULT_FILTERS), 'All Cinema & All Eras');
  assert.equal(formatFilterSummary({ countries: ['JP'], decades: [] }), '🇯🇵 Japan');
  assert.equal(formatFilterSummary({ countries: [], decades: ['1990s'] }), '1990s');
});

test('selectDistinctSceneScreenshots strictly excludes titled images (iso_639_1 !== null) and primary promotional banner', () => {
  const backdrops = [
    { file_path: '/primary-promo-title.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 },
    { file_path: '/english-title-banner.jpg', iso_639_1: 'en', width: 1920, height: 1080, aspect_ratio: 1.778 },
    { file_path: '/french-title-banner.jpg', iso_639_1: 'fr', width: 1920, height: 1080, aspect_ratio: 1.778 },
    { file_path: '/top-banner-1.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 },
    { file_path: '/top-banner-2.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 },
    { file_path: '/scene-a.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778, vote_average: 5.5 },
    { file_path: '/scene-b.jpg', iso_639_1: null, width: 3840, height: 2160, aspect_ratio: 1.778, vote_average: 5.2 },
    { file_path: '/scene-c.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778, vote_average: 4.8 },
    { file_path: '/scene-d.jpg', iso_639_1: null, width: 2560, height: 1440, aspect_ratio: 1.778, vote_average: 4.1 },
    { file_path: '/scene-e.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778, vote_average: 3.5 },
    { file_path: '/scene-f.jpg', iso_639_1: null, width: 3840, height: 2160, aspect_ratio: 1.778, vote_average: 2.0 },
  ];

  const selected = selectDistinctSceneScreenshots(backdrops, '/primary-promo-title.jpg', 5);
  assert.equal(selected.length, 5);
  assert.equal(new Set(selected).size, 5, 'All 5 screenshots must be distinct');
  assert.equal(
    selected.some((u) => u.includes('english-title-banner') || u.includes('french-title-banner')),
    false,
    'Must never include backdrops tagged with a language/title'
  );
  assert.equal(
    selected.some((u) => u.includes('primary-promo-title')),
    false,
    'Must exclude primary promotional backdrop when scene stills are available'
  );
});

test('selectDistinctSceneScreenshots returns empty array if movie has fewer than 5 textless scene stills', () => {
  const backdrops = [
    { file_path: '/scene-1.jpg', iso_639_1: null, width: 1920, height: 1080 },
    { file_path: '/scene-2.jpg', iso_639_1: null, width: 1920, height: 1080 },
    { file_path: '/titled-3.jpg', iso_639_1: 'en', width: 1920, height: 1080 },
    { file_path: '/titled-4.jpg', iso_639_1: 'en', width: 1920, height: 1080 },
    { file_path: '/titled-5.jpg', iso_639_1: 'en', width: 1920, height: 1080 },
  ];

  const selected = selectDistinctSceneScreenshots(backdrops, null, 5);
  assert.equal(selected.length, 0);
});

test('every movie in MOVIE_DATABASE has 5 distinct scene screenshots and valid country code', () => {
  assert.ok(MOVIE_DATABASE.length >= 180, `Expected at least 180 movies, got ${MOVIE_DATABASE.length}`);
  for (const movie of MOVIE_DATABASE) {
    assert.ok(Array.isArray(movie.screenshots), `${movie.title} must have a screenshots array`);
    assert.equal(movie.screenshots.length, 5, `${movie.title} must have 5 screenshots`);
    assert.equal(
      new Set(movie.screenshots).size,
      5,
      `${movie.title} must have 5 strictly distinct scene screenshot URLs`
    );
    assert.ok(Boolean(movie.country), `${movie.title} must have a country code`);
  }
});

test('matchesMovieFilters accurately matches countries and decades including classic (<1970)', () => {
  const indian2010s = { id: '1', title: '3 Idiots', year: 2009, decade: '2000s', country: 'IN' };
  const classicUS = { id: '2', title: '12 Angry Men', year: 1957, decade: '1950s', country: 'US' };

  assert.equal(matchesMovieFilters(indian2010s, { countries: ['IN'], decades: [] }), true);
  assert.equal(matchesMovieFilters(indian2010s, { countries: ['US'], decades: [] }), false);
  assert.equal(matchesMovieFilters(indian2010s, { countries: ['IN'], decades: ['2000s'] }), true);
  assert.equal(matchesMovieFilters(indian2010s, { countries: ['IN'], decades: ['1990s'] }), false);

  assert.equal(matchesMovieFilters(classicUS, { countries: ['US'], decades: ['classic'] }), true);
  assert.equal(matchesMovieFilters(classicUS, { countries: ['US'], decades: ['1970s'] }), false);
});

test('selectNonRepeatingMovie serves strictly matching, non-repeating movies for every country and decade', () => {
  // Verify every single country option has multiple movies and never repeats across 8 consecutive rounds
  for (const country of MAJOR_COUNTRIES) {
    const seen = new Set<string>();
    let lastId = '';
    for (let round = 0; round < 8; round++) {
      const { movie } = selectNonRepeatingMovie(
        MOVIE_DATABASE,
        { countries: [country.code], decades: [] },
        seen,
        lastId ? [lastId] : []
      );
      assert.ok(movie, `Expected eligible movie for country ${country.code}`);
      assert.equal(
        movie.country,
        country.code,
        `Expected movie country ${country.code}, got ${movie.country} (${movie.title})`
      );
      assert.equal(
        seen.has(movie.id),
        false,
        `Movie ${movie.title} (${movie.id}) was repeated on round ${round + 1} for country ${country.code}`
      );
      seen.add(movie.id);
      lastId = movie.id;
    }
  }

  // Verify every single decade option has at least 60 movies and never repeats across 35 consecutive rounds
  for (const dec of DECADE_OPTIONS) {
    const matchingDecadeMovies = MOVIE_DATABASE.filter((m) =>
      matchesMovieFilters(m, { countries: [], decades: [dec.id] })
    );
    assert.ok(
      matchingDecadeMovies.length >= 60,
      `Expected at least 60 movies for decade ${dec.id}, found ${matchingDecadeMovies.length}`
    );

    const seen = new Set<string>();
    const recentOrder: string[] = [];
    for (let round = 0; round < 35; round++) {
      const { movie } = selectNonRepeatingMovie(
        MOVIE_DATABASE,
        { countries: [], decades: [dec.id] },
        seen,
        recentOrder.slice(-8)
      );
      assert.ok(movie, `Expected eligible movie for decade ${dec.id}`);
      assert.equal(
        matchesMovieFilters(movie, { countries: [], decades: [dec.id] }),
        true,
        `Movie ${movie.title} (${movie.year}) did not match decade ${dec.id}`
      );
      assert.equal(
        seen.has(movie.id),
        false,
        `Movie ${movie.title} was repeated on round ${round + 1} for decade ${dec.id}`
      );
      seen.add(movie.id);
      recentOrder.push(movie.id);
    }
  }

  // Verify every single (Country, Decade) combination across all 14 countries x 7 decades has strictly matching movies
  for (const country of MAJOR_COUNTRIES) {
    for (const dec of DECADE_OPTIONS) {
      const filter = { countries: [country.code], decades: [dec.id] };
      const seen = new Set<string>();
      let lastId = '';
      for (let round = 0; round < 3; round++) {
        const { movie, didCycleFilterPool, filterPoolIds } = selectNonRepeatingMovie(
          MOVIE_DATABASE,
          filter,
          seen,
          lastId ? [lastId] : [],
          Math.random,
          [],
          { allowCycle: true }
        );
        assert.ok(movie, `Expected movie for ${country.code} + ${dec.id}`);
        assert.equal(
          matchesMovieFilters(movie, filter),
          true,
          `Expected ${movie.title} (${movie.country}, ${movie.year}) to strictly match ${country.code} + ${dec.id}`
        );
        if (lastId && filterPoolIds.length > 1) {
          assert.notEqual(
            movie.id,
            lastId,
            `Back-to-back repeat for ${country.code} + ${dec.id}: ${movie.title}`
          );
        }
        if (didCycleFilterPool) {
          seen.clear();
        }
        seen.add(movie.id);
        lastId = movie.id;
      }
    }
  }
});

test('selectNonRepeatingMovie returns null/exhausted when all movies in filter pool are seen and allowCycle is false', () => {
  const smallCatalog = [
    { id: 'kr-1', title: 'Parasite', year: 2019, decade: '2010s', country: 'KR' },
    { id: 'kr-2', title: 'Oldboy', year: 2003, decade: '2000s', country: 'KR' },
    { id: 'us-1', title: 'Inception', year: 2010, decade: '2010s', country: 'US' },
  ];

  // Both KR movies have been seen
  const result = selectNonRepeatingMovie(
    smallCatalog,
    { countries: ['KR'], decades: [] },
    ['kr-1', 'kr-2']
  );

  assert.equal(result.movie, null);
  assert.equal(result.exhausted, true);
  assert.equal(result.didCycleFilterPool, false);
});

test('selectNonRepeatingMovie strictly refuses to return non-matching movies when filter pool is empty', () => {
  const smallCatalog = [
    { id: 'us-1', title: 'Inception', year: 2010, decade: '2010s', country: 'US' },
    { id: 'gb-1', title: 'Skyfall', year: 2012, decade: '2010s', country: 'GB' },
  ];

  const result = selectNonRepeatingMovie(
    smallCatalog,
    { countries: ['JP'], decades: ['classic'] },
    []
  );

  assert.equal(result.movie, null);
  assert.equal(result.exhausted, true);
  assert.equal(result.filterPoolIds.length, 0);
});

test('selectNonRepeatingMovie cycles within the active filter pool when allowCycle is explicitly enabled', () => {
  const smallCatalog = [
    { id: 'kr-1', title: 'Parasite', year: 2019, decade: '2010s', country: 'KR' },
    { id: 'kr-2', title: 'Oldboy', year: 2003, decade: '2000s', country: 'KR' },
    { id: 'us-1', title: 'Inception', year: 2010, decade: '2010s', country: 'US' },
  ];

  // Both KR movies have been seen, and kr-2 was the immediately preceding movie
  const result = selectNonRepeatingMovie(
    smallCatalog,
    { countries: ['KR'], decades: [] },
    ['kr-1', 'kr-2'],
    ['kr-2'],
    Math.random,
    [],
    { allowCycle: true }
  );

  assert.ok(result.movie);
  assert.equal(result.didCycleFilterPool, true);
  assert.equal(result.movie.country, 'KR', 'Must preserve KR filter even when pool cycles');
  assert.equal(result.movie.id, 'kr-1', 'Must not repeat immediately preceding movie kr-2');
});




