import { describe, test, expect } from 'bun:test';
import { matchesMovieFilters, normalizeTitle } from './rules.ts';

describe('Live TMDB API Integration & Strict Filtering', () => {
  const SERVER_URL = 'http://localhost:3000';

  test('TMDB status endpoint returns connected and liveTmdb true', async () => {
    const res = await fetch(`${SERVER_URL}/api/tmdb/status`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.connected).toBe(true);
    expect(data.liveTmdb).toBe(true);
  });

  test('Fetches a live TMDB movie with valid 5 textless scene screenshots', async () => {
    const res = await fetch(`${SERVER_URL}/api/tmdb/random-movie?_t=${Date.now()}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.movie).not.toBeNull();
    expect(data.movie.id.startsWith('tmdb-')).toBe(true);
    expect(data.movie.screenshots.length).toBe(5);
    expect(data.movie.title.length).toBeGreaterThan(0);
    expect(data.movie.year).toBeGreaterThan(1900);
  });

  test('Applies country and decade filters live on TMDB (Japan 1980s)', async () => {
    const res = await fetch(`${SERVER_URL}/api/tmdb/random-movie?countries=JP&decades=1980s&_t=${Date.now()}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.movie).not.toBeNull();
    expect(data.movie.country).toBe('JP');
    expect(data.movie.decade).toBe('1980s');
    expect(data.movie.year).toBeGreaterThanOrEqual(1980);
    expect(data.movie.year).toBeLessThanOrEqual(1989);
    expect(
      matchesMovieFilters(data.movie, {
        countries: ['JP'],
        decades: ['1980s'],
      })
    ).toBe(true);
  });

  test('Applies country and decade filters live on TMDB (France 1970s)', async () => {
    const res = await fetch(`${SERVER_URL}/api/tmdb/random-movie?countries=FR&decades=1970s&_t=${Date.now()}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.movie).not.toBeNull();
    expect(data.movie.country).toBe('FR');
    expect(data.movie.decade).toBe('1970s');
    expect(data.movie.year).toBeGreaterThanOrEqual(1970);
    expect(data.movie.year).toBeLessThanOrEqual(1979);
    expect(
      matchesMovieFilters(data.movie, {
        countries: ['FR'],
        decades: ['1970s'],
      })
    ).toBe(true);
  });

  test('Excludes previously seen movies without repeating', async () => {
    const res1 = await fetch(`${SERVER_URL}/api/tmdb/random-movie?countries=KR&decades=2010s&_t=${Date.now()}`);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.movie).not.toBeNull();
    const movie1 = data1.movie;

    const res2 = await fetch(
      `${SERVER_URL}/api/tmdb/random-movie?countries=KR&decades=2010s&exclude=${movie1.id}&excludeTitles=${encodeURIComponent(
        movie1.title
      )}&_t=${Date.now()}`
    );
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.movie).not.toBeNull();
    expect(data2.movie.id).not.toBe(movie1.id);
    expect(normalizeTitle(data2.movie.title)).not.toBe(normalizeTitle(movie1.title));
  });

  test('Returns exhausted true and null movie when filter pool has no matching unused movies', async () => {
    // Iceland in classic era (1900-1969) has 0 eligible widescreen films with 5 backdrops
    const res = await fetch(`${SERVER_URL}/api/tmdb/random-movie?countries=IS&decades=classic&_t=${Date.now()}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.movie).toBeNull();
    expect(data.exhausted).toBe(true);
    expect(data.message).toContain('No unused movies found on TMDB');
  });
});
