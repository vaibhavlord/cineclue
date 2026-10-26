import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import {
  matchesMovieFilters,
  selectDistinctSceneScreenshots,
  selectNonRepeatingMovie,
  normalizeTitle,
} from './game/rules.ts';
import { MOVIE_DATABASE, POPULAR_TITLES_CATALOG } from './data/movies.ts';
import {
  createMultiplayerRoom,
  joinMultiplayerRoom,
  startMultiplayerMatch,
  submitMultiplayerGuess,
  leaveMultiplayerRoom,
  getMultiplayerRoom,
} from './game/multiplayerManager.ts';

dotenv.config();

const app = express();

app.use(express.json());

// Normalize URLs if routed through Vercel rewrites
app.use((req, res, next) => {
  if (req.url.startsWith('/api/index')) {
    req.url = req.url.replace(/^\/api\/index/, '') || '/';
  } else if (req.url.startsWith('/index')) {
    req.url = req.url.replace(/^\/index/, '') || '/';
  }
  next();
});

// Check TMDB connection status
app.get(['/api/tmdb/status', '/tmdb/status'], (req: Request, res: Response) => {
  const hasKey = Boolean(process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim().length > 0);
  res.json({
    connected: hasKey,
    liveTmdb: hasKey,
    archiveCount: MOVIE_DATABASE.length,
    message: hasKey
      ? 'TMDB API is connected successfully with live movie database access.'
      : 'TMDB_API_KEY is not configured on the server. Please add TMDB_API_KEY to your Vercel Environment Variables.',
  });
});

// Provide public Firebase config to client (with and without VITE_ prefix support)
app.get(['/api/firebase/config', '/firebase/config'], (req: Request, res: Response) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBePT2O2pGqdKL-xpT2kIubk35_XA4UGM4',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || 'cinefight.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'cinefight',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || 'cinefight.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '550374740039',
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || '1:550374740039:web:0b7b4e4f994b6b31536162',
  });
});

// Proxy TMDB Movie Search with Built-in Catalog Fallback
app.get(['/api/tmdb/search', '/tmdb/search'], async (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').trim();
  if (!query) {
    res.json({ results: [] });
    return;
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    const qLower = query.toLowerCase();
    const localMatches = POPULAR_TITLES_CATALOG.filter((m) =>
      m.title.toLowerCase().includes(qLower)
    ).slice(0, 10);
    res.json({ results: localMatches });
    return;
  }

  try {
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(
        query
      )}&include_adult=false&page=1`
    );

    if (!tmdbRes.ok) {
      const qLower = query.toLowerCase();
      const localMatches = POPULAR_TITLES_CATALOG.filter((m) =>
        m.title.toLowerCase().includes(qLower)
      ).slice(0, 10);
      res.json({ results: localMatches });
      return;
    }

    const data = await tmdbRes.json();
    const results = (data.results || []).slice(0, 8).map((m: any) => ({
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.split('-')[0], 10) : 0,
      posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      id: String(m.id),
    }));

    res.json({ results });
  } catch (error) {
    const qLower = query.toLowerCase();
    const localMatches = POPULAR_TITLES_CATALOG.filter((m) =>
      m.title.toLowerCase().includes(qLower)
    ).slice(0, 10);
    res.json({ results: localMatches });
  }
});

// TMDB Genre Map
const TMDB_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

// Map ISO 3166-1 country codes to our filter IDs
function normalizeOriginCountry(originCountries?: string[], productionCountries?: any[]): string {
  if (originCountries && originCountries.length > 0) {
    return originCountries[0].toUpperCase();
  }
  if (productionCountries && productionCountries.length > 0) {
    return (productionCountries[0].iso_3166_1 || 'US').toUpperCase();
  }
  return 'US';
}

function deriveDecade(year: number): string {
  if (year < 1970) return 'classic';
  const decStart = Math.floor(year / 10) * 10;
  return `${decStart}s`;
}

// Random TMDB Movie Endpoint
app.get(['/api/tmdb/random-movie', '/tmdb/random-movie'], async (req: Request, res: Response) => {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    res.status(503).json({
      error: 'TMDB_API_KEY is not configured on the server. Please add TMDB_API_KEY in your Vercel Project Settings > Environment Variables.',
      code: 'TMDB_API_KEY_MISSING',
    });
    return;
  }

  const rawExcludes = ((req.query.exclude as string) || '').split(',').filter(Boolean);

  // Normalize excluded IDs in both raw and 'tmdb-' prefixed forms
  const excludedIds = new Set<string>();
  for (const raw of rawExcludes) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const clean = trimmed.replace(/^tmdb-/, '');
    excludedIds.add(trimmed);
    excludedIds.add(clean);
    excludedIds.add(`tmdb-${clean}`);
  }

  // Pre-collect normalized titles of excluded movies (passed via excludeTitles or from local DB)
  const excludedTitles = new Set<string>();
  if (req.query.excludeTitles) {
    const rawTitles = (req.query.excludeTitles as string).split('|').filter(Boolean);
    for (const t of rawTitles) {
      const norm = normalizeTitle(decodeURIComponent(t));
      if (norm) excludedTitles.add(norm);
    }
  }
  for (const m of MOVIE_DATABASE) {
    if (excludedIds.has(m.id) || excludedIds.has(m.id.replace(/^tmdb-/, ''))) {
      const norm = normalizeTitle(m.title);
      if (norm) excludedTitles.add(norm);
    }
  }

  let reqFilters = { countries: [] as string[], decades: [] as string[] };
  if (req.query.countries) {
    reqFilters.countries = (req.query.countries as string).split(',').filter(Boolean);
  }
  if (req.query.decades) {
    reqFilters.decades = (req.query.decades as string).split(',').filter(Boolean);
  }

  // Search parameters for TMDB Discover
  const hasCountryFilter = reqFilters.countries.length > 0;
  const hasDecadeFilter = reqFilters.decades.length > 0;

  let originCountryParam = '';
  if (hasCountryFilter) {
    originCountryParam = `&with_origin_country=${reqFilters.countries.map((c) => encodeURIComponent(c.trim())).join('|')}`;
  }

  let releaseDateFilter = '';
  if (hasDecadeFilter) {
    // Pick one of the selected decades randomly to target valid TMDB discover date ranges
    const selectedDecade = reqFilters.decades[Math.floor(Math.random() * reqFilters.decades.length)];
    if (selectedDecade === 'classic') {
      releaseDateFilter = '&primary_release_date.lte=1969-12-31';
    } else {
      const startYear = parseInt(selectedDecade, 10);
      if (!isNaN(startYear)) {
        releaseDateFilter = `&primary_release_date.gte=${startYear}-01-01&primary_release_date.lte=${startYear + 9}-12-31`;
      }
    }
  }

  const tmdbHeaders = {
    'User-Agent': 'CineClue/1.0 (Mystery Movie Deduction Game)',
    'Accept': 'application/json',
  };

  const sortOptions = ['vote_count.desc', 'popularity.desc', 'revenue.desc'];
  const chosenSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
  const voteCountThreshold = hasCountryFilter || hasDecadeFilter ? 15 : 40;

  try {
    // Query page 1 to discover total_pages and initial results
    const firstPageUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=${chosenSort}&vote_count.gte=${voteCountThreshold}&include_adult=false&include_video=false&page=1${originCountryParam}${releaseDateFilter}`;
    const firstRes = await fetch(firstPageUrl, { headers: tmdbHeaders });

    if (!firstRes.ok) {
      if (firstRes.status === 401 || firstRes.status === 403) {
        res.status(502).json({
          error: 'TMDB API key was rejected by TMDB (401 Unauthorized). Please check your TMDB_API_KEY.',
          code: 'TMDB_REJECTED',
          tmdbStatus: firstRes.status,
        });
        return;
      }
      res.status(502).json({
        error: `TMDB API discover returned status ${firstRes.status}.`,
        code: 'TMDB_REJECTED',
        tmdbStatus: firstRes.status,
      });
      return;
    }

    const firstData = await firstRes.json();
    if (!firstData.results || firstData.results.length === 0 || firstData.total_results === 0) {
      res.status(409).json({
        error: 'No movies match the selected filters in TMDB.',
        code: 'EXHAUSTED_POOL',
        exhausted: true,
      });
      return;
    }

    const totalPages = Math.min(Number(firstData.total_pages) || 1, 500);

    // Sample randomly across the full set of TMDB pages available for the active filters
    const sampledPageSet = new Set<number>();
    const maxPageAttempts = Math.min(6, totalPages);

    while (sampledPageSet.size < maxPageAttempts) {
      const pageToTry = totalPages === 1 ? 1 : Math.floor(Math.random() * totalPages) + 1;
      sampledPageSet.add(pageToTry);
    }

    for (const pageNum of sampledPageSet) {
      let pageResults = firstData.results;
      if (pageNum !== 1) {
        const pageUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=${chosenSort}&vote_count.gte=${voteCountThreshold}&include_adult=false&include_video=false&page=${pageNum}${originCountryParam}${releaseDateFilter}`;
        const pageRes = await fetch(pageUrl, { headers: tmdbHeaders });
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          if (Array.isArray(pageData.results) && pageData.results.length > 0) {
            pageResults = pageData.results;
          }
        }
      }

      // Filter candidate movies against exclusions
      const candidates = (pageResults || []).filter((m: any) => {
        if (!m.poster_path || !m.backdrop_path || !m.overview || m.overview.length < 20) {
          return false;
        }
        const idStr = String(m.id);
        const clean = idStr.replace(/^tmdb-/, '');
        if (excludedIds.has(idStr) || excludedIds.has(clean) || excludedIds.has(`tmdb-${clean}`)) {
          return false;
        }
        const norm = normalizeTitle(m.title || '');
        if (norm && excludedTitles.has(norm)) {
          return false;
        }
        return true;
      });

      if (candidates.length === 0) {
        continue;
      }

      // Shuffle candidates on this page
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);

      for (const candidate of shuffled) {
        const movieId = candidate.id;

        // Fetch movie details, credits, and images in parallel
        const [detailsRes, creditsRes, imagesRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}`, { headers: tmdbHeaders }),
          fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${apiKey}`, { headers: tmdbHeaders }),
          fetch(`https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${apiKey}`, { headers: tmdbHeaders }),
        ]);

        if (!detailsRes.ok) continue;

        const details = await detailsRes.json();
        const credits = creditsRes.ok ? await creditsRes.json() : { cast: [], crew: [] };
        const images = imagesRes.ok ? await imagesRes.json() : { backdrops: [] };

        const directorObj = (credits.crew || []).find((c: any) => c.job === 'Director');
        const directorName = directorObj ? directorObj.name : 'Unknown Director';

        const movieYear = details.release_date
          ? parseInt(details.release_date.split('-')[0], 10)
          : 2000;
        const movieCountry = normalizeOriginCountry(
          details.origin_country,
          details.production_countries
        );
        const movieDecade = deriveDecade(movieYear);

        // Filter validation
        const candidateMovieMeta = {
          id: String(movieId),
          title: details.title,
          year: movieYear,
          decade: movieDecade,
          country: movieCountry,
        };

        if (
          !matchesMovieFilters(candidateMovieMeta, reqFilters) ||
          excludedTitles.has(normalizeTitle(details.title || ''))
        ) {
          continue;
        }

        // Distinct scene screenshots
        const rawBackdropPath = details.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
          : null;
        let distinctScreenshots = selectDistinctSceneScreenshots(
          images.backdrops || [],
          rawBackdropPath,
          5
        );

        // If fewer than 5 textless widescreen stills, pad with available textless stills or backdrop
        if (distinctScreenshots.length < 5) {
          const fallbackStills = selectDistinctSceneScreenshots(
            images.backdrops || [],
            rawBackdropPath,
            1
          );
          if (fallbackStills.length > 0) {
            distinctScreenshots = [...fallbackStills];
            while (distinctScreenshots.length < 5) {
              distinctScreenshots.push(fallbackStills[distinctScreenshots.length % fallbackStills.length]);
            }
          } else if (rawBackdropPath) {
            distinctScreenshots = [
              rawBackdropPath,
              rawBackdropPath,
              rawBackdropPath,
              rawBackdropPath,
              rawBackdropPath,
            ];
          }
        }

        if (distinctScreenshots.length < 5) {
          continue;
        }

        // Genres
        const genres = (details.genres || []).map((g: any) => g.name);

        // Tagline
        let taglinePrompt = details.tagline || details.overview?.slice(0, 90) + '...';
        let blankWord = 'cinema';
        let fullTagline = taglinePrompt;

        if (details.tagline && details.tagline.trim().length > 10) {
          const words = details.tagline.split(' ');
          const longest = [...words].sort((a, b) => b.length - a.length)[0] || 'movie';
          blankWord = longest.replace(/[^a-zA-Z]/g, '');
          taglinePrompt = details.tagline.replace(new RegExp(`\\b${blankWord}\\b`, 'i'), '______');
          fullTagline = details.tagline;
        }

        // Cast dossier
        const castDossier = (credits.cast || []).slice(0, 3).map((member: any) => {
          const nameParts = (member.name || '').split(' ');
          const initials = nameParts.map((p: string) => p[0]).join('').toUpperCase().slice(0, 3);
          return {
            archetype: member.character || 'Supporting Role',
            characterDescription: `Portrayed by ${initials} in a defining performance.`,
            actorInitials: initials,
          };
        });

        const budgetFormatted = details.budget > 0
          ? `$${Math.round(details.budget / 1000000)}M Budget`
          : `$${Math.round((details.revenue || 50000000) / 1000000)}M Box Office`;

        const fullMoviePayload = {
          id: `tmdb-${details.id}`,
          title: details.title,
          year: movieYear,
          decade: movieDecade,
          country: movieCountry,
          director: directorName,
          genres: genres.length > 0 ? genres : ['Drama'],
          difficulty: 'Cinephile',
          emojiCryptogram: '🎬 ⭐ 🍿',
          tagline: {
            prompt: taglinePrompt,
            blank: blankWord,
            full: fullTagline,
          },
          quote: {
            dialogue: details.overview ? details.overview.slice(0, 140) + '...' : 'A remarkable scene.',
            speakerRole: 'Narrative Voice',
            context: `Released in ${movieYear}`,
          },
          minimalistArt: {
            primaryBg: '#1C1C1B',
            accentColor: '#EC5A49',
            themeSymbol: 'Film',
            description: details.overview || 'A cinema masterwork.',
          },
          castDossier: castDossier.length > 0 ? castDossier : [
            { archetype: 'Lead Character', characterDescription: 'The central protagonist.', actorInitials: 'PRO' }
          ],
          boxOfficeTrivia: {
            oscars: details.vote_average ? `${details.vote_average.toFixed(1)}/10 TMDB Rating` : 'Critically Acclaimed',
            budgetOrGross: budgetFormatted,
            secretTrivia: details.overview ? details.overview.slice(0, 160) + '...' : 'A must-see cinematic experience.',
          },
          screenshots: distinctScreenshots,
          posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
          backdropUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : null,
        };

        res.json({ movie: fullMoviePayload, source: 'tmdb-live' });
        return;
      }
    }

    // All sampled candidates were either already played or didn't meet criteria
    res.status(409).json({
      error: 'All movies matching the active filters have been played in this session.',
      code: 'EXHAUSTED_POOL',
      exhausted: true,
    });
  } catch (err: any) {
    console.error('TMDB selection error:', err);
    res.status(502).json({
      error: err?.message || 'Failed to communicate with TMDB API.',
      code: 'TMDB_REJECTED',
    });
  }
});

// --- 1v1 Online Multiplayer Authoritative Endpoints ---
app.post(['/api/multiplayer/room/create', '/multiplayer/room/create'], async (req: Request, res: Response) => {
  try {
    const { hostName, filters } = req.body || {};
    const result = await createMultiplayerRoom(hostName || 'Player 1', filters);
    res.json(result);
  } catch (err: any) {
    console.error('Multiplayer create error:', err);
    res.status(500).json({ error: err?.message || 'Failed to create room.' });
  }
});

app.post(['/api/multiplayer/room/join', '/multiplayer/room/join'], async (req: Request, res: Response) => {
  try {
    const { code, playerName } = req.body || {};
    if (!code) {
      res.status(400).json({ error: 'Room code is required' });
      return;
    }
    const result = await joinMultiplayerRoom(code, playerName || 'Player 2');
    if ('error' in result) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error('Multiplayer join error:', err);
    res.status(500).json({ error: err?.message || 'Failed to join room.' });
  }
});

app.post(['/api/multiplayer/room/start', '/multiplayer/room/start'], async (req: Request, res: Response) => {
  try {
    const { code, playerId } = req.body || {};
    if (!code || !playerId) {
      res.status(400).json({ error: 'Code and playerId are required' });
      return;
    }
    const result = await startMultiplayerMatch(code, playerId);
    if ('error' in result) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error('Multiplayer start error:', err);
    res.status(500).json({ error: err?.message || 'Failed to start match.' });
  }
});

app.post(['/api/multiplayer/room/guess', '/multiplayer/room/guess'], async (req: Request, res: Response) => {
  try {
    const { code, playerId, guess, movieIndex } = req.body || {};
    if (!code || !playerId || typeof guess !== 'string') {
      res.status(400).json({ error: 'Invalid guess payload' });
      return;
    }
    const result = await submitMultiplayerGuess(code, playerId, guess, Number(movieIndex) || 0);
    res.json(result);
  } catch (err: any) {
    console.error('Multiplayer guess error:', err);
    res.status(500).json({ error: err?.message || 'Failed to submit guess.' });
  }
});

app.post(['/api/multiplayer/room/leave', '/multiplayer/room/leave'], async (req: Request, res: Response) => {
  try {
    const { code, playerId } = req.body || {};
    const result = await leaveMultiplayerRoom(code || '', playerId || '');
    res.json(result);
  } catch (err: any) {
    console.error('Multiplayer leave error:', err);
    res.status(500).json({ error: err?.message || 'Failed to leave room.' });
  }
});

app.get(['/api/multiplayer/room/:code', '/multiplayer/room/:code'], async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const result = await getMultiplayerRoom(code);
    if ('error' in result) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error('Multiplayer fetch error:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch room.' });
  }
});

export default app;
