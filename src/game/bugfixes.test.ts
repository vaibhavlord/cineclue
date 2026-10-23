import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesMovieFilters,
  selectNonRepeatingMovie,
  normalizeTitle,
} from './rules.ts';
import { MOVIE_DATABASE } from '../data/movies.ts';
import { DEFAULT_FILTERS } from '../data/filterOptions.ts';

test('BUG 1 FIX: consecutive rounds never select a movie that has already appeared in the session', () => {
  const sessionSeenIds = new Set<string>();
  const sessionSeenTitles = new Set<string>();

  // Run 20 rounds with default filters
  for (let round = 0; round < 20; round++) {
    const { movie, exhausted } = selectNonRepeatingMovie(
      MOVIE_DATABASE,
      DEFAULT_FILTERS,
      sessionSeenIds,
      Array.from(sessionSeenIds).slice(-8),
      Math.random,
      sessionSeenTitles
    );

    assert.equal(exhausted, false, `Round ${round + 1} should not be exhausted`);
    assert.ok(movie, `Round ${round + 1} must return a movie`);

    const normId = movie.id.replace(/^tmdb-/, '');
    const normTitle = normalizeTitle(movie.title);

    assert.equal(
      sessionSeenIds.has(movie.id) || sessionSeenIds.has(normId),
      false,
      `Movie "${movie.title}" (${movie.id}) already appeared in the session on round ${round + 1}`
    );
    assert.equal(
      sessionSeenTitles.has(normTitle),
      false,
      `Movie title "${movie.title}" already appeared in the session on round ${round + 1}`
    );

    sessionSeenIds.add(movie.id);
    sessionSeenIds.add(normId);
    sessionSeenTitles.add(normTitle);
  }
});

test('BUG 1 FIX: deduplication catches both raw IDs, tmdb-prefixed IDs, and normalized titles', () => {
  const catalog = [
    { id: 'tmdb-27205', title: 'Inception', year: 2010, decade: '2010s', country: 'US' },
    { id: 'tmdb-603', title: 'The Matrix', year: 1999, decade: '1990s', country: 'US' },
  ];

  // Exclude by raw number without tmdb- prefix
  const res1 = selectNonRepeatingMovie(catalog, DEFAULT_FILTERS, ['27205']);
  assert.ok(res1.movie);
  assert.equal(res1.movie.title, 'The Matrix');

  // Exclude by title variant
  const res2 = selectNonRepeatingMovie(catalog, DEFAULT_FILTERS, [], [], Math.random, ['inception']);
  assert.ok(res2.movie);
  assert.equal(res2.movie.title, 'The Matrix');
});

test('BUG 2 FIX: filter options strictly control which movies are selected', () => {
  // Test Japan + 1980s
  const jp1980Filter = { countries: ['JP'], decades: ['1980s'] };
  const resJP = selectNonRepeatingMovie(MOVIE_DATABASE, jp1980Filter, []);
  assert.ok(resJP.movie);
  assert.equal(resJP.movie.country, 'JP');
  assert.equal(resJP.movie.decade, '1980s');
  assert.ok(matchesMovieFilters(resJP.movie, jp1980Filter));

  // Test France + 1970s
  const fr1970Filter = { countries: ['FR'], decades: ['1970s'] };
  const resFR = selectNonRepeatingMovie(MOVIE_DATABASE, fr1970Filter, []);
  assert.ok(resFR.movie);
  assert.equal(resFR.movie.country, 'FR');
  assert.equal(resFR.movie.decade, '1970s');
  assert.ok(matchesMovieFilters(resFR.movie, fr1970Filter));

  // Test India + 2000s
  const in2000Filter = { countries: ['IN'], decades: ['2000s'] };
  const resIN = selectNonRepeatingMovie(MOVIE_DATABASE, in2000Filter, []);
  assert.ok(resIN.movie);
  assert.equal(resIN.movie.country, 'IN');
  assert.equal(resIN.movie.decade, '2000s');
  assert.ok(matchesMovieFilters(resIN.movie, in2000Filter));
});

test('BUG 2 FIX: never silently falls back to unfiltered movies or partial filters when empty', () => {
  const testCatalog = [
    { id: 'us-1', title: 'The Dark Knight', year: 2008, decade: '2000s', country: 'US' },
    { id: 'us-2', title: 'Pulp Fiction', year: 1994, decade: '1990s', country: 'US' },
  ];

  // Request a country not in the catalog
  const res = selectNonRepeatingMovie(testCatalog, { countries: ['JP'], decades: ['2000s'] }, []);
  assert.equal(res.movie, null, 'Must NOT return US movies when JP was selected');
  assert.equal(res.exhausted, true);

  // Request a decade not in the catalog
  const resDecade = selectNonRepeatingMovie(testCatalog, { countries: ['US'], decades: ['1970s'] }, []);
  assert.equal(resDecade.movie, null, 'Must NOT return 2000s or 1990s movies when 1970s was selected');
  assert.equal(resDecade.exhausted, true);
});

test('BUG 2 FIX: changing or clearing filters immediately updates the eligible movie pool', () => {
  const catalog = [
    { id: '1', title: 'Parasite', year: 2019, decade: '2010s', country: 'KR' },
    { id: '2', title: 'Spirited Away', year: 2001, decade: '2000s', country: 'JP' },
    { id: '3', title: 'Amélie', year: 2001, decade: '2000s', country: 'FR' },
  ];

  // Filter for KR
  const krResult = selectNonRepeatingMovie(catalog, { countries: ['KR'], decades: [] }, []);
  assert.ok(krResult.movie);
  assert.equal(krResult.movie.country, 'KR');

  // Change to JP
  const jpResult = selectNonRepeatingMovie(catalog, { countries: ['JP'], decades: [] }, []);
  assert.ok(jpResult.movie);
  assert.equal(jpResult.movie.country, 'JP');

  // Clear filters
  const allResult = selectNonRepeatingMovie(catalog, DEFAULT_FILTERS, []);
  assert.ok(allResult.movie);
  assert.equal(allResult.filterPoolIds.length, 3);
});

test('BUG 1 & 2: returns exhausted without silently repeating when all matching movies have appeared', () => {
  const catalog = [
    { id: 'kr-1', title: 'Parasite', year: 2019, decade: '2010s', country: 'KR' },
    { id: 'kr-2', title: 'Oldboy', year: 2003, decade: '2000s', country: 'KR' },
  ];

  const seen = new Set<string>();

  // Round 1
  const r1 = selectNonRepeatingMovie(catalog, { countries: ['KR'], decades: [] }, seen);
  assert.ok(r1.movie);
  seen.add(r1.movie.id);

  // Round 2
  const r2 = selectNonRepeatingMovie(catalog, { countries: ['KR'], decades: [] }, seen);
  assert.ok(r2.movie);
  assert.notEqual(r2.movie.id, r1.movie.id);
  seen.add(r2.movie.id);

  // Round 3: all matching movies are seen
  const r3 = selectNonRepeatingMovie(catalog, { countries: ['KR'], decades: [] }, seen);
  assert.equal(r3.movie, null, 'Must NOT silently choose a repeated movie');
  assert.equal(r3.exhausted, true);
  assert.equal(r3.didCycleFilterPool, false);
});
