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

  // Verify every single decade option has multiple movies and never repeats across 10 consecutive rounds
  for (const dec of DECADE_OPTIONS) {
    const seen = new Set<string>();
    let lastId = '';
    for (let round = 0; round < 10; round++) {
      const { movie } = selectNonRepeatingMovie(
        MOVIE_DATABASE,
        { countries: [], decades: [dec.id] },
        seen,
        lastId ? [lastId] : []
      );
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
      lastId = movie.id;
    }
  }
});

import {
  createMultiplayerRoom,
  joinMultiplayerRoom,
  startMultiplayerMatch,
  submitMultiplayerGuess,
  leaveMultiplayerRoom,
  getMultiplayerRoom,
  _resetMultiplayerRooms,
  _getInternalRoom,
} from './multiplayerManager.ts';

test('createMultiplayerRoom generates 6-char code, sanitizes movies for client, and enforces filters', () => {
  _resetMultiplayerRooms();
  const created = createMultiplayerRoom('Alice', { countries: ['JP'], decades: [] });

  assert.equal(created.code.length, 6);
  assert.equal(created.room.hostId, created.playerId);
  assert.equal(created.room.players[created.playerId].name, 'Alice');
  assert.equal(created.room.players[created.playerId].isHost, true);
  assert.equal(created.room.status, 'lobby');

  // Verify movies are sanitized for clients: none have a title field
  for (const m of created.room.movieList) {
    assert.equal((m as any).title, undefined, 'Client safe movie must not expose title');
    assert.ok(m.director, 'Client safe movie should include director');
    assert.ok(m.year, 'Client safe movie should include year');
  }

  // Internal room has corresponding secret titles
  const internal = _getInternalRoom(created.code);
  assert.ok(internal);
  assert.equal(internal.secretTitles.length, created.room.movieList.length);
  assert.equal(new Set(internal.secretTitles).size, internal.secretTitles.length, 'No duplicate movies in match pool');
});

test('joinMultiplayerRoom allows second player and blocks third player', () => {
  _resetMultiplayerRooms();
  const { code } = createMultiplayerRoom('HostPlayer');

  // Join player 2
  const joinRes = joinMultiplayerRoom(code, 'ChallengerPlayer');
  assert.equal('error' in joinRes, false);
  if ('room' in joinRes) {
    assert.equal(Object.keys(joinRes.room.players).length, 2);
    assert.equal(joinRes.room.players[joinRes.playerId].name, 'ChallengerPlayer');
    assert.equal(joinRes.room.players[joinRes.playerId].isHost, false);
  }

  // Attempt to join player 3
  const thirdRes = joinMultiplayerRoom(code, 'Intruder');
  assert.equal('error' in thirdRes, true);
});

test('startMultiplayerMatch enforces host authorization and 60-second synchronized timer', () => {
  _resetMultiplayerRooms();
  const { code, playerId: hostId } = createMultiplayerRoom('HostPlayer');
  const challenger = joinMultiplayerRoom(code, 'Challenger');
  assert.equal('playerId' in challenger, true);
  if (!('playerId' in challenger)) return;

  // Challenger cannot start
  const failStart = startMultiplayerMatch(code, challenger.playerId);
  assert.equal('error' in failStart, true);

  // Host starts
  const startRes = startMultiplayerMatch(code, hostId);
  assert.equal('room' in startRes, true);
  if ('room' in startRes) {
    assert.equal(startRes.room.status, 'playing');
    assert.ok(startRes.room.matchStartTime);
    assert.ok(startRes.room.matchEndTime);
    assert.equal(startRes.room.matchEndTime! - startRes.room.matchStartTime!, 60000);
    assert.equal(startRes.room.currentMovieIndex, 0);
  }
});

test('submitMultiplayerGuess awards point to first solver and rejects simultaneous double-scoring', () => {
  _resetMultiplayerRooms();
  const { code, playerId: hostId } = createMultiplayerRoom('Alice');
  const joinRes = joinMultiplayerRoom(code, 'Bob');
  if (!('playerId' in joinRes)) return;
  const bobId = joinRes.playerId;

  startMultiplayerMatch(code, hostId);
  const internal = _getInternalRoom(code)!;
  const firstMovieTitle = internal.secretTitles[0];

  // Alice submits correct answer for movie 0
  const aliceGuess = submitMultiplayerGuess(code, hostId, firstMovieTitle, 0);
  assert.equal(aliceGuess.isCorrect, true);
  assert.equal(aliceGuess.awarded, true);
  assert.equal(aliceGuess.room?.players[hostId].score, 1);
  assert.equal(aliceGuess.room?.currentMovieIndex, 1);

  // Bob submits same correct answer for movie 0 immediately after (race condition test)
  const bobLateGuess = submitMultiplayerGuess(code, bobId, firstMovieTitle, 0);
  assert.equal(bobLateGuess.awarded, false);
  assert.equal(bobLateGuess.room?.players[bobId].score, 0, 'Late submit must not double-award point');

  // Verify Bob solves movie 1 correctly
  const secondMovieTitle = internal.secretTitles[1];
  const bobGuess = submitMultiplayerGuess(code, bobId, secondMovieTitle, 1);
  assert.equal(bobGuess.isCorrect, true);
  assert.equal(bobGuess.awarded, true);
  assert.equal(bobGuess.room?.players[bobId].score, 1);
  assert.equal(bobGuess.room?.currentMovieIndex, 2);
});

test('leaveMultiplayerRoom handles match abandonment and awards forfeit victory', () => {
  _resetMultiplayerRooms();
  const { code, playerId: p1 } = createMultiplayerRoom('P1');
  const p2Res = joinMultiplayerRoom(code, 'P2');
  if (!('playerId' in p2Res)) return;
  const p2 = p2Res.playerId;

  startMultiplayerMatch(code, p1);

  // P1 disconnects / leaves during match
  const res = leaveMultiplayerRoom(code, p1);
  assert.equal(res.room?.status, 'abandoned');
  assert.equal(res.room?.winnerId, p2, 'Remaining player must be awarded win upon opponent forfeit');
});



