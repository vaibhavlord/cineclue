import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesMovieFilters, normalizeTitle } from './rules.ts';

const SERVER_URL = 'http://localhost:3000';

test('TMDB status endpoint returns connected, liveTmdb true, and groqAi true', { timeout: 20000 }, async () => {
  const res = await fetch(`${SERVER_URL}/api/tmdb/status`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.connected, true);
  assert.equal(data.liveTmdb, true);
  assert.equal(data.groqAi, true);
});

test('Fetches a live TMDB movie with valid 5 textless scene screenshots', { timeout: 20000 }, async () => {
  const res = await fetch(`${SERVER_URL}/api/tmdb/random-movie?_t=${Date.now()}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.movie !== null);
  assert.ok(data.movie.id.startsWith('tmdb-'));
  assert.equal(data.movie.screenshots.length, 5);
  assert.ok(data.movie.title.length > 0);
  assert.ok(data.movie.year > 1900);
});

test('Applies country and decade filters live on TMDB (Japan 1980s)', { timeout: 20000 }, async () => {
  const res = await fetch(`${SERVER_URL}/api/tmdb/random-movie?countries=JP&decades=1980s&_t=${Date.now()}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.movie !== null);
  assert.equal(data.movie.country, 'JP');
  assert.equal(data.movie.decade, '1980s');
  assert.ok(data.movie.year >= 1980);
  assert.ok(data.movie.year <= 1989);
  assert.equal(
    matchesMovieFilters(data.movie, {
      countries: ['JP'],
      decades: ['1980s'],
    }),
    true
  );
});

test('Applies country and decade filters live on TMDB (France 1970s)', { timeout: 20000 }, async () => {
  const res = await fetch(`${SERVER_URL}/api/tmdb/random-movie?countries=FR&decades=1970s&_t=${Date.now()}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.movie !== null);
  assert.equal(data.movie.country, 'FR');
  assert.equal(data.movie.decade, '1970s');
  assert.ok(data.movie.year >= 1970);
  assert.ok(data.movie.year <= 1979);
  assert.equal(
    matchesMovieFilters(data.movie, {
      countries: ['FR'],
      decades: ['1970s'],
    }),
    true
  );
});

test('Excludes previously seen movies without repeating', { timeout: 20000 }, async () => {
  const res1 = await fetch(`${SERVER_URL}/api/tmdb/random-movie?countries=KR&decades=2010s&_t=${Date.now()}`);
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.ok(data1.movie !== null);
  const movie1 = data1.movie;

  const res2 = await fetch(
    `${SERVER_URL}/api/tmdb/random-movie?countries=KR&decades=2010s&exclude=${movie1.id}&excludeTitles=${encodeURIComponent(
      movie1.title
    )}&_t=${Date.now()}`
  );
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.ok(data2.movie !== null);
  assert.notEqual(data2.movie.id, movie1.id);
  assert.notEqual(normalizeTitle(data2.movie.title), normalizeTitle(movie1.title));
});
