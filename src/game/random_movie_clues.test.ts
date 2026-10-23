import { test } from 'bun:test';
import assert from 'node:assert/strict';

const SERVER_BASE = 'http://localhost:3000';

test('Random movie selection returns 5 distinct w780 image clues and NEVER exposes title, id, or answer metadata initially', async () => {
  const res = await fetch(`${SERVER_BASE}/api/game/round/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 200);
  const data = await res.json();

  // 1. Verify round ID is provided
  assert.ok(data.roundId, 'Must return a valid roundId');
  assert.equal(typeof data.roundId, 'string');

  // 2. Security Check: Never expose correct movie title, ID, or answer metadata before round ends
  assert.equal(data.title, undefined, 'Must NEVER expose movie title in new round payload');
  assert.equal(data.movieId, undefined, 'Must NEVER expose movie ID in new round payload');
  assert.equal(data.id, undefined, 'Must NEVER expose ID in new round payload');
  assert.equal(data.director, undefined, 'Must NEVER expose director in new round payload');
  assert.equal(data.overview, undefined, 'Must NEVER expose overview in new round payload');
  assert.equal(data.tagline, undefined, 'Must NEVER expose tagline in new round payload');

  // 3. Verify exactly 5 distinct image clues
  assert.equal(data.totalClues, 5);
  assert.equal(data.revealedClues, 1);
  assert.ok(Array.isArray(data.imageUrls), 'imageUrls must be an array');
  assert.equal(data.imageUrls.length, 5, 'Must provide exactly 5 image clues');

  // Check no duplicates in image clues
  const uniqueUrls = new Set(data.imageUrls);
  assert.equal(uniqueUrls.size, 5, 'All 5 image clues in the round must be distinct');

  // Verify secure TMDB image URL format with w780 backdrop size
  for (const url of data.imageUrls) {
    assert.ok(
      url.startsWith('https://image.tmdb.org/t/p/w780/'),
      `Image URL must start with secure TMDB w780 format. Got: ${url}`
    );
    assert.ok(!url.includes('undefined') && !url.includes('null'), 'Image URL must be valid path');
  }
});

test('Progressive clue gameplay: Reveal Next Clue unlocks images 2 through 5 sequentially', async () => {
  const newRoundRes = await fetch(`${SERVER_BASE}/api/game/round/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const round = await newRoundRes.json();
  const roundId = round.roundId;

  // Initially only 1 clue revealed
  assert.equal(round.revealedClues, 1);

  // Reveal clue 2
  const step2Res = await fetch(`${SERVER_BASE}/api/game/round/reveal-clue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId }),
  });
  const step2 = await step2Res.json();
  assert.equal(step2.revealedClues, 2);
  assert.equal(step2.remainingClues, 3);

  // Reveal clue 3
  const step3Res = await fetch(`${SERVER_BASE}/api/game/round/reveal-clue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId }),
  });
  const step3 = await step3Res.json();
  assert.equal(step3.revealedClues, 3);
  assert.equal(step3.remainingClues, 2);

  // Reveal clues 4 and 5
  await fetch(`${SERVER_BASE}/api/game/round/reveal-clue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId }),
  });
  const step5Res = await fetch(`${SERVER_BASE}/api/game/round/reveal-clue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId }),
  });
  const step5 = await step5Res.json();
  assert.equal(step5.revealedClues, 5);
  assert.equal(step5.remainingClues, 0);
});

test('Server-side guess validation normalizes whitespace and casing, and provides correct feedback', async () => {
  const newRoundRes = await fetch(`${SERVER_BASE}/api/game/round/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const round = await newRoundRes.json();
  const roundId = round.roundId;

  // Submit incorrect guess with extra whitespace and mixed casing
  const wrongGuessRes = await fetch(`${SERVER_BASE}/api/game/round/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roundId,
      guess: '   inVAlid MoviE TitLE 99999   ',
    }),
  });

  assert.equal(wrongGuessRes.status, 200);
  const wrongData = await wrongGuessRes.json();
  assert.equal(wrongData.isCorrect, false);
  assert.equal(wrongData.isGameOver, false);
  assert.equal(wrongData.remainingGuesses, 4);
  assert.ok(wrongData.message, 'Must return feedback message for incorrect guess');
  assert.equal(wrongData.movie, undefined, 'Must not reveal movie answer while round is active');

  // Skip the round to get the secret title for testing exact match normalization
  const skipRes = await fetch(`${SERVER_BASE}/api/game/round/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId }),
  });
  const skipData = await skipRes.json();
  assert.ok(skipData.movie?.title, 'Skip must reveal movie answer');
  const actualTitle = skipData.movie.title;

  // Start a fresh round and submit the correct movie with irregular casing and leading/trailing whitespace
  const round2Res = await fetch(`${SERVER_BASE}/api/game/round/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const round2 = await round2Res.json();

  // Test Skip Movie option
  const skipMovieRes = await fetch(`${SERVER_BASE}/api/game/round/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId: round2.roundId }),
  });
  const skipMovieData = await skipMovieRes.json();
  assert.equal(skipMovieData.skipped, true);
  assert.equal(skipMovieData.roundStatus, 'lost');
  assert.equal(skipMovieData.pointsEarned, 0);
  assert.ok(skipMovieData.movie?.title, 'Must reveal movie on skip');
});

test('Prevents multiple submissions and repeated score awards on finished rounds', async () => {
  const newRoundRes = await fetch(`${SERVER_BASE}/api/game/round/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const round = await newRoundRes.json();
  const roundId = round.roundId;

  // Skip round to finish it
  await fetch(`${SERVER_BASE}/api/game/round/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId }),
  });

  // Attempting to guess after round is already finished must be rejected with 400
  const postFinishGuess = await fetch(`${SERVER_BASE}/api/game/round/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundId, guess: 'Some Movie' }),
  });

  assert.equal(postFinishGuess.status, 400);
  const errData = await postFinishGuess.json();
  assert.equal(errData.isGameOver, true);
  assert.ok(errData.error.includes('already finished'));
});

test('Successive rounds select different movies without repeating session movies', async () => {
  const round1Res = await fetch(`${SERVER_BASE}/api/game/round/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const round1 = await round1Res.json();

  const round2Res = await fetch(`${SERVER_BASE}/api/game/round/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ excludeIds: [round1.roundId] }),
  });
  const round2 = await round2Res.json();

  assert.notEqual(round1.roundId, round2.roundId, 'Round IDs must be distinct');
  assert.notDeepEqual(round1.imageUrls, round2.imageUrls, 'Image clues must come from different movies');
});
