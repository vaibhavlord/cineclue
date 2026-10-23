import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  matchesMovieFilters,
  normalizeTitle,
  selectDistinctSceneScreenshots,
  selectNonRepeatingMovie,
  calculateScore,
  checkTitleMatch,
  compareReleaseYear,
  findMatchingGenres,
} from './src/game/rules.ts';
import { MOVIE_DATABASE, POPULAR_TITLES_CATALOG } from './src/data/movies.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Check TMDB and Groq AI connection status
app.get('/api/tmdb/status', (req: Request, res: Response) => {
  const tmdbKey = Boolean(process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim().length > 0);
  const groqKey = Boolean(
    (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0) ||
    (process.env.CH_RANDOM && process.env.CH_RANDOM.trim().length > 0)
  );

  res.json({
    connected: tmdbKey,
    liveTmdb: tmdbKey,
    groqAi: groqKey,
    archiveCount: MOVIE_DATABASE.length,
    message: tmdbKey
      ? groqKey
        ? 'TMDB API & Groq AI are both active! Groq AI intelligently curates iconic films matching your filters, verified live against TMDB.'
        : 'TMDB API is connected successfully with live movie database access. A fresh random film is selected live from TMDB on every round according to active filters.'
      : `Built-in Global Cinema Archive active (${MOVIE_DATABASE.length} films across 14 countries & 7 eras).`,
  });
});

// Proxy TMDB Movie Search with Built-in Catalog Fallback
app.get('/api/tmdb/search', async (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').trim();
  if (!query) {
    res.json({ results: [] });
    return;
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    try {
      const tmdbRes = await fetch(
        `https://api.tmdb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(
          query
        )}&include_adult=false&language=en-US&page=1`
      );

      if (tmdbRes.ok) {
        const data = await tmdbRes.json();
        const formatted = (data.results || []).slice(0, 10).map((m: any) => ({
          id: m.id,
          title: m.title,
          year: m.release_date ? parseInt(m.release_date.split('-')[0], 10) : 0,
          overview: m.overview,
          posterPath: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
          voteAverage: m.vote_average,
        }));

        res.json({ results: formatted });
        return;
      }
    } catch (err: any) {
      console.error('Error proxying TMDB search, using catalog fallback:', err);
    }
  }

  const lowerQuery = query.toLowerCase();
  const localMatches = POPULAR_TITLES_CATALOG.filter((m) =>
    m.title.toLowerCase().includes(lowerQuery)
  )
    .slice(0, 10)
    .map((m, idx) => ({
      id: `catalog-${idx}`,
      title: m.title,
      year: m.year,
      overview: '',
      posterPath: null,
      voteAverage: 8.0,
    }));

  res.json({ results: localMatches });
});

// Helper: Synthesizes a 5 to 6 emoji cryptogram based on text, keywords, and genres
function generateThematicEmojis(
  title: string,
  overview: string,
  keywords: string[],
  genres: string[]
): string {
  const combined = `${title} ${overview} ${keywords.join(' ')}`.toLowerCase();

  const specificRules: Array<{ words: string[]; emojis: string[] }> = [
    { words: ['space', 'astronaut', 'galaxy', 'planet', 'interstellar', 'orbit', 'nasa'], emojis: ['🚀', '🪐', '🌌'] },
    { words: ['alien', 'extraterrestrial', 'ufo', 'xenomorph'], emojis: ['👽', '🛸', '👾'] },
    { words: ['dinosaur', 'prehistoric', 'jurassic', 'fossil', 't-rex'], emojis: ['🦖', '🦕', '🌴'] },
    { words: ['dream', 'subconscious', 'sleep', 'labyrinth', 'inception'], emojis: ['🌀', '💤', '🏙️'] },
    { words: ['matrix', 'simulation', 'hacker', 'virtual reality', 'cyber'], emojis: ['💊', '🕶️', '🟩'] },
    { words: ['ship', 'ocean', 'iceberg', 'sea', 'boat', 'titanic'], emojis: ['🚢', '🧊', '🌊'] },
    { words: ['joker', 'batman', 'clown', 'gotham', 'vigilante'], emojis: ['🃏', '🦇', '🤡'] },
    { words: ['car', 'delorean', 'time travel', 'clock', 'speed', 'racing'], emojis: ['⚡', '🚗', '🕰️'] },
    { words: ['bomb', 'atomic', 'nuclear', 'explosion', 'oppenheimer'], emojis: ['⚛️', '💣', '🏜️'] },
    { words: ['mafia', 'godfather', 'mob', 'don', 'gangster', 'sicilian'], emojis: ['🌹', '🔫', '🍊'] },
    { words: ['ring', 'middle-earth', 'hobbit', 'sauron', 'mordor'], emojis: ['💍', '🌋', '🗡️'] },
    { words: ['wizard', 'magic', 'witch', 'sorcerer', 'spell', 'castle'], emojis: ['🧙', '🪄', '🏰'] },
    { words: ['spider', 'web', 'avenger', 'superhero', 'mutant', 'hero'], emojis: ['🕷️', '🦸', '⚡'] },
    { words: ['drum', 'jazz', 'tempo', 'music', 'band', 'conservatory'], emojis: ['🥁', '🎺', '🎵'] },
    { words: ['multiverse', 'bagel', 'dimension', 'googly eyes'], emojis: ['🥯', '👀', '🧺'] },
    { words: ['toy', 'doll', 'cowboy', 'playroom'], emojis: ['🧸', '🤠', '🚀'] },
    { words: ['lion', 'safari', 'savannah', 'pride', 'hyena'], emojis: ['🦁', '👑', '🌅'] },
    { words: ['ghost', 'haunted', 'hotel', 'overlook', 'axe', 'shining'], emojis: ['🪓', '🏨', '❄️'] },
    { words: ['spirit', 'bathhouse', 'dragon', 'miyazaki'], emojis: ['♨️', '🐉', '🏮'] },
    { words: ['heist', 'robbery', 'bank', 'vault', 'gold', 'money', 'cash'], emojis: ['💰', '💼', '💎'] },
    { words: ['spy', 'agent', '007', 'bond', 'mi6', 'cia', 'assassin', 'hitman', 'bounty', 'target', 'bullet', 'sniper'], emojis: ['🕶️', '🍸', '🎯', '🔫'] },
    { words: ['island', 'jungle', 'temple', 'treasure', 'archaeology'], emojis: ['🏝️', '🗿', '🧭'] },
    { words: ['boxing', 'fight club', 'wrestling', 'boxer', 'gloves'], emojis: ['🥊', '🩸', '🏆'] },
    { words: ['cop', 'detective', 'police', 'investigation', 'murder'], emojis: ['🔍', '🚨', '📁'] },
    { words: ['dog', 'cat', 'animal', 'pet'], emojis: ['🐾', '🐕', '🐈'] },
    { words: ['food', 'chef', 'restaurant', 'cooking', 'rat'], emojis: ['🍳', '🍲', '🧀'] },
    { words: ['zombie', 'infection', 'virus', 'outbreak', 'pandemic'], emojis: ['🧟', '☣️', '🩸'] },
    { words: ['plane', 'pilot', 'flight', 'jet', 'fighter'], emojis: ['✈️', '🕶️', '☁️'] },
  ];

  const matchedEmojis: string[] = [];

  for (const rule of specificRules) {
    const isMatch = rule.words.some((w) => {
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      return regex.test(combined);
    });

    if (isMatch) {
      for (const emoji of rule.emojis) {
        if (!matchedEmojis.includes(emoji)) {
          matchedEmojis.push(emoji);
        }
      }
    }
  }

  const genreEmojiMap: Record<string, string[]> = {
    Action: ['💥', '🥋', '🔥'],
    Adventure: ['🗺️', '🧭', '🏕️'],
    Animation: ['🎨', '🪄', '✨'],
    Comedy: ['😂', '🍿', '🎉'],
    Crime: ['🔫', '🚔', '⚖️'],
    Drama: ['🎭', '💔', '🌧️'],
    Family: ['👨‍👩‍👧', '🎈', '🎠'],
    Fantasy: ['🧙', '🗡️', '🔮'],
    History: ['📜', '🏛️', '👑'],
    Horror: ['🩸', '💀', '🕯️'],
    Music: ['🎵', '🎸', '🎹'],
    Mystery: ['🔍', '🗝️', '🕵️'],
    Romance: ['❤️', '🌹', '💌'],
    'Science Fiction': ['🚀', '🤖', '🛸'],
    'Sci-Fi': ['🚀', '🤖', '🛸'],
    Thriller: ['⚡', '⏱️', '🚨'],
    War: ['🎖️', '💣', '🪖'],
    Western: ['🤠', '🏜️', '🐴'],
  };

  for (const g of genres) {
    const list = genreEmojiMap[g] || [];
    for (const e of list) {
      if (!matchedEmojis.includes(e)) {
        matchedEmojis.push(e);
      }
    }
  }

  const defaultFillers = ['🎬', '🍿', '📽️', '⭐', '🎫', '🎭'];
  for (const f of defaultFillers) {
    if (matchedEmojis.length >= 6) break;
    if (!matchedEmojis.includes(f)) {
      matchedEmojis.push(f);
    }
  }

  return matchedEmojis.slice(0, 6).join(' ');
}

// Helper: Generates tagline with masked word
function formatTaglineBlank(rawTagline: string, overview: string) {
  let sourceText = rawTagline && rawTagline.trim().length > 10 ? rawTagline.trim() : '';

  if (!sourceText) {
    const sentences = overview.split('. ');
    sourceText = sentences[0] ? `${sentences[0]}.` : overview.slice(0, 75);
  }

  const cleanWords = sourceText.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').split(/\s+/);
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'they', 'them', 'were',
    'have', 'been', 'will', 'your', 'into', 'over', 'some', 'what', 'when', 'then', 'about',
  ]);

  const candidates = cleanWords.filter((w) => w.length >= 4 && !stopWords.has(w.toLowerCase()));
  const chosenWord = candidates.length > 0 ? candidates[candidates.length - 1] : 'future';

  const escapedWord = chosenWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
  const prompt = sourceText.replace(regex, '______');

  return {
    prompt: prompt !== sourceText ? prompt : `${sourceText} ______`,
    blank: chosenWord,
    full: sourceText,
  };
}

const DECADE_DATE_RANGES: Record<string, { gte: string; lte: string; startYear: number; endYear: number }> = {
  classic: { gte: '1900-01-01', lte: '1969-12-31', startYear: 1900, endYear: 1969 },
  '1970s': { gte: '1970-01-01', lte: '1979-12-31', startYear: 1970, endYear: 1979 },
  '1980s': { gte: '1980-01-01', lte: '1989-12-31', startYear: 1980, endYear: 1989 },
  '1990s': { gte: '1990-01-01', lte: '1999-12-31', startYear: 1990, endYear: 1999 },
  '2000s': { gte: '2000-01-01', lte: '2009-12-31', startYear: 2000, endYear: 2009 },
  '2010s': { gte: '2010-01-01', lte: '2019-12-31', startYear: 2010, endYear: 2019 },
  '2020s': { gte: '2020-01-01', lte: '2029-12-31', startYear: 2020, endYear: 2029 },
};

// Server-side per-filter rolling history prevents repeats even when client localStorage is restricted or reset
const recentServedIdsByFilter = new Map<string, string[]>();
const recentServedTitlesByFilter = new Map<string, string[]>();

function recordServerServedMovie(filterKey: string, movieId: string, movieTitle: string, maxKeep = 60) {
  const cleanId = movieId.trim();
  const idList = (recentServedIdsByFilter.get(filterKey) || []).filter(
    (id) => id !== cleanId && id.replace(/^tmdb-/, '') !== cleanId.replace(/^tmdb-/, '')
  );
  idList.push(cleanId);
  while (idList.length > maxKeep) idList.shift();
  recentServedIdsByFilter.set(filterKey, idList);

  const normTitle = normalizeTitle(movieTitle);
  if (normTitle) {
    const titleList = (recentServedTitlesByFilter.get(filterKey) || []).filter((t) => t !== normTitle);
    titleList.push(normTitle);
    while (titleList.length > maxKeep) titleList.shift();
    recentServedTitlesByFilter.set(filterKey, titleList);
  }
}

// Helper: Calls Groq AI to curate iconic, recognizable films matching active filters
async function fetchAiMovieCurations(
  countries: string[],
  decades: string[],
  excludedTitles: string[],
  groqKey: string
): Promise<Array<{ title: string; year?: number }>> {
  const countryNames: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    JP: 'Japan',
    FR: 'France',
    IN: 'India',
    KR: 'South Korea',
    IT: 'Italy',
    DE: 'Germany',
    ES: 'Spain',
    CA: 'Canada',
    AU: 'Australia',
    MX: 'Mexico',
    BR: 'Brazil',
    SE: 'Sweden',
    HK: 'Hong Kong',
  };

  const formattedCountries = countries.map((c) => countryNames[c] || c).join(', ') || 'Global / Any';
  const formattedDecades = decades.join(', ') || 'Any era';
  const excludeSnippet = excludedTitles.slice(-25).join('", "');

  const prompt = `Recommend 12 famous, critically acclaimed, recognizable feature films matching:
- Countries of origin: ${formattedCountries}
- Release eras: ${formattedDecades}
${excludeSnippet ? `- Exclude already played titles: ["${excludeSnippet}"]` : ''}

Rules:
1. Every movie must be famous or well-known enough for cinephiles to recognize from scene screenshots.
2. Return ONLY a valid JSON object in this format:
{
  "movies": [
    { "title": "Movie Title", "year": 1985 }
  ]
}`;

  const models = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.85,
        }),
      });

      if (!response.ok) continue;
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) continue;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.movies) && parsed.movies.length > 0) {
          return parsed.movies;
        }
      }
    } catch (err) {
      console.warn(`Groq AI curation model ${model} failed:`, err);
    }
  }

  return [];
}

// Helper: Formats TMDB detailed response into standard CineClue Movie Clue
function formatTmdbMovieClue(
  details: any,
  selectedCountries: string[],
  filterCriteria: { countries: string[]; decades: string[] }
) {
  if (!details || !details.title) return null;

  const releaseYear = details.release_date
    ? parseInt(details.release_date.split('-')[0], 10)
    : 2000;
  const decade = releaseYear < 1970 ? 'classic' : `${Math.floor(releaseYear / 10) * 10}s`;

  const primaryOrigins: string[] = (
    Array.isArray(details.origin_country) ? details.origin_country : []
  ).map((c: string) => c.toUpperCase());
  const fallbackProdOrigins: string[] = (
    (details.production_countries || []).map((pc: any) => pc.iso_3166_1).filter(Boolean)
  ).map((c: string) => c.toUpperCase());

  const langToCountry: Record<string, string> = {
    ja: 'JP',
    fr: 'FR',
    hi: 'IN',
    ko: 'KR',
    de: 'DE',
    es: 'ES',
    it: 'IT',
    en: 'US',
    zh: 'HK',
    pt: 'BR',
    sv: 'SE',
  };
  const langFallback = details.original_language ? langToCountry[details.original_language] : null;

  const originCountries = [
    ...primaryOrigins,
    ...fallbackProdOrigins,
    ...(langFallback ? [langFallback] : []),
  ];

  const matchedOrigin =
    selectedCountries.find((sc) => originCountries.includes(sc)) ||
    originCountries[0] ||
    'US';

  // Strictly verify candidate satisfies active Country and Decade filters
  if (
    !matchesMovieFilters(
      {
        id: `tmdb-${details.id}`,
        title: details.title,
        year: releaseYear,
        decade,
        country: matchedOrigin,
      },
      filterCriteria
    )
  ) {
    return null;
  }

  // Assemble 5 screenshot clues
  let screenshots = selectDistinctSceneScreenshots(
    details.images?.backdrops || [],
    details.backdrop_path,
    5
  );

  // If movie has fewer than 5 textless widescreen stills, pad from available backdrops so movie is never discarded
  if (screenshots.length < 5) {
    const allBackdrops = (details.images?.backdrops || []).filter(
      (b: any) => b && typeof b.file_path === 'string' && b.file_path.trim().startsWith('/')
    );
    const textless = allBackdrops.filter(
      (b: any) => b.iso_639_1 === null || b.iso_639_1 === undefined || String(b.iso_639_1).trim() === ''
    );
    const pool = textless.length > 0 ? textless : allBackdrops;
    if (pool.length > 0) {
      const urls = pool.map((b: any) => `https://image.tmdb.org/t/p/w1280${b.file_path}`);
      while (urls.length < 5) {
        urls.push(...urls);
      }
      screenshots = urls.slice(0, 5);
    } else if (details.backdrop_path) {
      const singleUrl = `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`;
      screenshots = [singleUrl, singleUrl, singleUrl, singleUrl, singleUrl];
    } else {
      return null;
    }
  }

  const crew = details.credits?.crew || [];
  const directorObj = crew.find((c: any) => c.job === 'Director');
  const director = directorObj ? directorObj.name : 'Master Filmmaker';

  const cast = (details.credits?.cast || []).slice(0, 3).map((c: any, idx: number) => {
    const cleanChar = c.character ? c.character.split('/')[0].trim() : 'Key Protagonist';
    const titles = ['The Lead Protagonist', 'The Principal Foil', 'The Crucial Ally'];
    const archetypeTitle =
      cleanChar.length > 2 && cleanChar.length < 25
        ? `The ${cleanChar}`
        : titles[idx] || 'Central Character';

    return {
      archetype: archetypeTitle,
      characterDescription: `Portrayed with iconic distinction by ${c.name}.`,
      actorInitials:
        c.name
          .split(' ')
          .map((p: string) => p[0])
          .join('.') + '.',
    };
  });

  const genreNames = (details.genres || []).map((g: any) => g.name);
  const keywordsList = (details.keywords?.keywords || []).map((k: any) => k.name);
  const emojis = generateThematicEmojis(
    details.title,
    details.overview || '',
    keywordsList,
    genreNames
  );
  const taglineObj = formatTaglineBlank(details.tagline, details.overview || '');

  let grossText = 'Box Office Blockbuster';
  if (details.revenue && details.revenue > 1000000) {
    if (details.revenue >= 1000000000) {
      grossText = `$${(details.revenue / 1000000000).toFixed(2)} Billion Worldwide`;
    } else {
      grossText = `$${(details.revenue / 1000000).toFixed(0)} Million Worldwide`;
    }
  }

  const ratingText = details.vote_average
    ? `TMDB Score: ${details.vote_average.toFixed(1)}/10 (${details.vote_count.toLocaleString()} cinephile votes)`
    : 'Universally Recognized Masterpiece';

  const leadCharName = details.credits?.cast?.[0]?.character
    ? details.credits.cast[0].character.split('/')[0].trim()
    : 'The Lead';

  const quoteDialogue =
    details.tagline && details.tagline.trim().length > 12
      ? details.tagline
      : details.overview || `A cinematic journey directed by ${director}.`;

  const escapedTitle = details.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sanitizedDialogue = quoteDialogue.replace(
    new RegExp(`\\b${escapedTitle}\\b`, 'gi'),
    '[This Film]'
  );

  return {
    id: `tmdb-${details.id}`,
    title: details.title,
    year: releaseYear,
    decade,
    country: matchedOrigin,
    director,
    genres: genreNames.length > 0 ? genreNames : ['Drama'],
    difficulty: (details.vote_count > 10000 ? 'Novice' : 'Cinephile') as
      | 'Novice'
      | 'Cinephile',
    screenshots,
    emojiCryptogram: emojis,
    tagline: taglineObj,
    quote: {
      dialogue: sanitizedDialogue,
      speakerRole: `Protagonist (${leadCharName})`,
      context: `Theatrical signature logline directed by ${director}.`,
    },
    minimalistArt: {
      primaryBg: 'from-slate-900 to-indigo-950',
      accentColor: '#f59e0b',
      themeSymbol: 'totem_spinner',
      description: `Official Theatrical Key Art (${releaseYear}) • ${genreNames
        .slice(0, 2)
        .join(' / ')}`,
    },
    castDossier:
      cast.length > 0
        ? cast
        : [
            {
              archetype: 'The Protagonist',
              characterDescription: 'Central figure',
              actorInitials: 'A.L.',
            },
          ],
    boxOfficeTrivia: {
      oscars: ratingText,
      budgetOrGross: grossText,
      secretTrivia:
        details.overview || `An acclaimed cinematic release preserved in TMDB history.`,
    },
    posterUrl: details.poster_path
      ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
      : null,
    backdropUrl: screenshots[4] || null,
  };
}

// Proxy TMDB Random Iconic Mystery Film with Groq AI Curation & TMDB Live API
app.get('/api/tmdb/random-movie', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const excludeParam = (req.query.exclude as string) || '';
  const excludeTitlesParam = (req.query.excludeTitles as string) || '';
  const countriesParam = (req.query.countries as string) || '';
  const decadesParam = (req.query.decades as string) || '';

  const rawClientExcludeList = excludeParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const rawClientExcludeTitles = excludeTitlesParam
    .split(',')
    .map((s) => normalizeTitle(s))
    .filter(Boolean);

  const selectedCountries = countriesParam
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const selectedDecades = decadesParam
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => Boolean(DECADE_DATE_RANGES[d]));

  const filterCriteria = {
    countries: selectedCountries,
    decades: selectedDecades,
  };

  const filterKey = `${[...selectedCountries].sort().join(',')}|${[...selectedDecades].sort().join(',')}`;
  const maxServerHistoryForFilter = 500;

  if (body.resetSeenPool === true) {
    recentServedIdsByFilter.delete(filterKey);
    recentServedTitlesByFilter.delete(filterKey);
  }

  const serverRecentIds = (recentServedIdsByFilter.get(filterKey) || []).slice(-maxServerHistoryForFilter);
  const serverRecentTitles = (recentServedTitlesByFilter.get(filterKey) || []).slice(-maxServerHistoryForFilter);

  // Combine client-supplied exclusions with server-side recent memory (client's most recent items last)
  const combinedExcludeList = Array.from(new Set([...serverRecentIds, ...rawClientExcludeList]));
  const combinedExcludeTitles = new Set<string>([...serverRecentTitles, ...rawClientExcludeTitles]);

  for (const m of MOVIE_DATABASE) {
    const rawId = m.id.trim();
    const cleanId = rawId.replace(/^tmdb-/, '');
    if (
      combinedExcludeList.includes(rawId) ||
      combinedExcludeList.includes(cleanId) ||
      combinedExcludeList.includes(`tmdb-${cleanId}`)
    ) {
      const nt = normalizeTitle(m.title);
      if (nt) combinedExcludeTitles.add(nt);
    }
  }

  const clientExcludeIds = new Set<string>(
    combinedExcludeList.flatMap((id) => [id, id.replace(/^tmdb-/, ''), `tmdb-${id.replace(/^tmdb-/, '')}`])
  );

  const apiKey = process.env.TMDB_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY || process.env.CH_RANDOM || process.env.GROQ_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      // 1. Try Groq AI Curation first (if Groq key is configured)
      if (groqApiKey && groqApiKey.trim().length > 0) {
        try {
          const aiSuggestions = await fetchAiMovieCurations(
            selectedCountries,
            selectedDecades,
            Array.from(combinedExcludeTitles),
            groqApiKey.trim()
          );

          if (aiSuggestions.length > 0) {
            const shuffledAi = [...aiSuggestions].sort(() => Math.random() - 0.5);

            for (const item of shuffledAi) {
              const normItemTitle = normalizeTitle(item.title);
              if (combinedExcludeTitles.has(normItemTitle)) continue;

              const yearParam = item.year ? `&year=${item.year}` : '';
              const searchUrl = `https://api.tmdb.org/3/search/movie?api_key=${encodeURIComponent(
                apiKey
              )}&query=${encodeURIComponent(item.title)}${yearParam}&include_adult=false&language=en-US&page=1`;

              const searchRes = await fetch(searchUrl);
              if (!searchRes.ok) continue;
              const searchData = await searchRes.json();
              const candidate = searchData?.results?.[0];
              if (!candidate || !candidate.id) continue;

              const idStr = String(candidate.id);
              if (clientExcludeIds.has(idStr)) continue;

              const detailRes = await fetch(
                `https://api.tmdb.org/3/movie/${candidate.id}?api_key=${encodeURIComponent(
                  apiKey
                )}&append_to_response=credits,keywords,images&include_image_language=en,null`
              );
              if (!detailRes.ok) continue;
              const details = await detailRes.json();

              const movieClue = formatTmdbMovieClue(details, selectedCountries, filterCriteria);
              if (movieClue) {
                recordServerServedMovie(
                  filterKey,
                  movieClue.id,
                  movieClue.title,
                  maxServerHistoryForFilter
                );
                res.json({
                  movie: movieClue,
                  aiCurated: true,
                  didCycleFilterPool: false,
                  filterPoolIds: [],
                });
                return;
              }
            }
          }
        } catch (aiErr) {
          console.warn('Groq AI curation attempt failed, falling back to direct TMDB discover:', aiErr);
        }
      }

      // 2. Direct TMDB Discover Engine (exhaustive search across TMDB's catalog)
      const hasCountryFilter = selectedCountries.length > 0;
      const isOnlyUS = selectedCountries.length === 1 && selectedCountries[0] === 'US';
      const hasDecadeFilter = selectedDecades.length > 0;
      const isClassic = selectedDecades.includes('classic');

      const primaryMinVotes = (hasCountryFilter && !isOnlyUS) || isClassic ? 20 : hasDecadeFilter ? 60 : 100;
      const secondaryMinVotes = (hasCountryFilter && !isOnlyUS) || isClassic ? 5 : 20;

      const candidatePool: any[] = [];
      const seenCandidateIds = new Set<string>();

      const buildDiscoverUrl = (page: number, minVotes: number, decadeKey?: string) => {
        let url = `https://api.tmdb.org/3/discover/movie?api_key=${encodeURIComponent(
          apiKey
        )}&sort_by=vote_count.desc&vote_count.gte=${minVotes}&include_adult=false&language=en-US&page=${page}`;

        if (selectedCountries.length > 0) {
          url += `&with_origin_country=${encodeURIComponent(selectedCountries.join('|'))}`;
        }

        if (decadeKey && DECADE_DATE_RANGES[decadeKey]) {
          const range = DECADE_DATE_RANGES[decadeKey];
          url += `&primary_release_date.gte=${range.gte}&primary_release_date.lte=${range.lte}`;
        } else if (selectedDecades.length > 0) {
          const ranges = selectedDecades.map((k) => DECADE_DATE_RANGES[k]).filter(Boolean);
          const minGte = ranges.reduce((acc, r) => (r.gte < acc ? r.gte : acc), ranges[0].gte);
          const maxLte = ranges.reduce((acc, r) => (r.lte > acc ? r.lte : acc), ranges[0].lte);
          url += `&primary_release_date.gte=${minGte}&primary_release_date.lte=${maxLte}`;
        } else {
          const today = new Date().toISOString().split('T')[0];
          url += `&primary_release_date.lte=${today}`;
        }

        return url;
      };

      const filterEligibleResults = (results: any[], maxFromPage = 8) => {
        const eligibleFromPage: any[] = [];
        for (const m of results || []) {
          const idStr = String(m.id);
          const normT = normalizeTitle(m.title || '');
          if (
            !m.backdrop_path ||
            clientExcludeIds.has(idStr) ||
            seenCandidateIds.has(idStr) ||
            (normT && combinedExcludeTitles.has(normT))
          ) {
            continue;
          }
          const releaseYear = m.release_date ? parseInt(m.release_date.split('-')[0], 10) : 0;
          if (selectedDecades.length > 0 && releaseYear > 0) {
            const matchesSelectedDecade = selectedDecades.some((decKey) => {
              const r = DECADE_DATE_RANGES[decKey];
              return r && releaseYear >= r.startYear && releaseYear <= r.endYear;
            });
            if (!matchesSelectedDecade) continue;
          }
          eligibleFromPage.push(m);
        }

        for (let i = eligibleFromPage.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [eligibleFromPage[i], eligibleFromPage[j]] = [eligibleFromPage[j], eligibleFromPage[i]];
        }

        for (const m of eligibleFromPage.slice(0, maxFromPage)) {
          const idStr = String(m.id);
          if (!seenCandidateIds.has(idStr)) {
            seenCandidateIds.add(idStr);
            candidatePool.push(m);
          }
        }
      };

      const harvestCandidates = async (minVotes: number, maxPages = 4) => {
        const shuffledDecades =
          selectedDecades.length > 0
            ? [...selectedDecades].sort(() => Math.random() - 0.5)
            : [undefined];

        for (const decadeKey of shuffledDecades.slice(0, 3)) {
          const page1Res = await fetch(buildDiscoverUrl(1, minVotes, decadeKey));
          if (!page1Res.ok) continue;
          const page1Data = await page1Res.json();

          const totalPages = Math.min(Number(page1Data.total_pages) || 1, 50);
          filterEligibleResults(page1Data.results || [], totalPages > 1 ? 5 : 20);

          if (totalPages > 1) {
            const availablePages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
            for (let i = availablePages.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [availablePages[i], availablePages[j]] = [availablePages[j], availablePages[i]];
            }
            const pagesToFetch = availablePages.slice(0, maxPages);
            const pageResponses = await Promise.all(
              pagesToFetch.map((p) =>
                fetch(buildDiscoverUrl(p, minVotes, decadeKey))
                  .then((r) => (r.ok ? r.json() : null))
                  .catch(() => null)
              )
            );
            for (const pData of pageResponses) {
              if (pData?.results) {
                filterEligibleResults(pData.results, 8);
              }
            }
          }
        }
      };

      await harvestCandidates(primaryMinVotes, 4);
      if (candidatePool.length < 8) {
        await harvestCandidates(secondaryMinVotes, 6);
      }
      if (candidatePool.length < 4) {
        await harvestCandidates(0, 8); // Relax minVotes to 0 to capture all available TMDB films
      }

      // Shuffle candidatePool thoroughly
      for (let i = candidatePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
      }

      const topCandidates = candidatePool.slice(0, 18);
      for (let bIdx = 0; bIdx < topCandidates.length; bIdx += 3) {
        const batch = topCandidates.slice(bIdx, bIdx + 3);
        const detailList = await Promise.all(
          batch.map((candidate) =>
            fetch(
              `https://api.tmdb.org/3/movie/${candidate.id}?api_key=${encodeURIComponent(
                apiKey
              )}&append_to_response=credits,keywords,images&include_image_language=en,null`
            )
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );

        for (const details of detailList) {
          const movieClue = formatTmdbMovieClue(details, selectedCountries, filterCriteria);
          if (movieClue) {
            recordServerServedMovie(
              filterKey,
              movieClue.id,
              movieClue.title,
              maxServerHistoryForFilter
            );
            res.json({ movie: movieClue, didCycleFilterPool: false, filterPoolIds: [] });
            return;
          }
        }
      }

      // 3. Guaranteed Non-Exhaustion: If all matching films were in the exclusion list or narrow filters lacked backdrops,
      // progressively relax constraints so the user NEVER sees "no unused movies found"!
      const fallbackUrls = [
        buildDiscoverUrl(Math.floor(Math.random() * 5) + 1, 0),
        selectedCountries.length > 0
          ? `https://api.tmdb.org/3/discover/movie?api_key=${encodeURIComponent(
              apiKey
            )}&sort_by=vote_count.desc&with_origin_country=${encodeURIComponent(
              selectedCountries.join('|')
            )}&include_adult=false&page=${Math.floor(Math.random() * 3) + 1}`
          : '',
        `https://api.tmdb.org/3/discover/movie?api_key=${encodeURIComponent(
          apiKey
        )}&sort_by=vote_count.desc&vote_count.gte=50&include_adult=false&page=${Math.floor(Math.random() * 10) + 1}`,
      ].filter(Boolean);

      for (const fUrl of fallbackUrls) {
        try {
          const fRes = await fetch(fUrl);
          if (!fRes.ok) continue;
          const fData = await fRes.json();
          const fResults = (fData?.results || []).filter((m: any) => m && m.backdrop_path);
          for (const fCandidate of fResults.slice(0, 6)) {
            const detailRes = await fetch(
              `https://api.tmdb.org/3/movie/${fCandidate.id}?api_key=${encodeURIComponent(
                apiKey
              )}&append_to_response=credits,keywords,images&include_image_language=en,null`
            );
            if (!detailRes.ok) continue;
            const details = await detailRes.json();
            const emClue = formatTmdbMovieClue(details, selectedCountries, { countries: [], decades: [] });
            if (emClue) {
              recordServerServedMovie(filterKey, emClue.id, emClue.title, maxServerHistoryForFilter);
              res.json({ movie: emClue, didCycleFilterPool: true, filterPoolIds: [] });
              return;
            }
          }
        } catch {
          // Continue to next fallback
        }
      }

      res.status(502).json({
        movie: null,
        error: 'Failed to find eligible movie on TMDB',
      });
      return;
    } catch (err: any) {
      console.error('Live TMDB lookup error:', err);
      res.status(502).json({
        movie: null,
        error: 'Failed to connect to TMDB API',
      });
      return;
    }
  }

  // Built-in Multi-Country & Multi-Decade Archive Fallback (used ONLY if TMDB_API_KEY is not configured)
  try {
    const immediateExcludes = combinedExcludeList.slice(-8);
    const { movie, didCycleFilterPool, filterPoolIds } = selectNonRepeatingMovie(
      MOVIE_DATABASE,
      filterCriteria,
      combinedExcludeList,
      immediateExcludes,
      Math.random,
      combinedExcludeTitles,
      { allowCycle: true }
    );
    if (movie) {
      recordServerServedMovie(filterKey, movie.id, movie.title, maxServerHistoryForFilter);
      res.json({ movie, didCycleFilterPool: false, filterPoolIds, exhausted: false });
    } else {
      res.json({ movie: MOVIE_DATABASE[0], didCycleFilterPool: true, filterPoolIds: [] });
    }
  } catch (err: any) {
    console.error('Error selecting fallback archive movie:', err);
    res.status(500).json({ error: 'Failed to generate movie challenge' });
  }
});

// ============================================================================
// COMPLETE RANDOM MOVIE CLUE SYSTEM (SECURE SERVER-SIDE ROUND STATE)
// ============================================================================

interface SecretRoundState {
  roundId: string;
  movieId: number | string;
  title: string;
  year: number;
  decade: string;
  country: string;
  director: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  clueImages: string[]; // exactly 5 distinct w780 URLs
  revealedClues: number; // 1 to 5
  maxClues: number;
  guessesCount: number;
  maxGuesses: number;
  solved: boolean;
  forfeited: boolean;
  pointsEarned: number;
  guesses: Array<{
    title: string;
    isCorrect: boolean;
    guessNumber: number;
    year?: number;
    yearRelation?: 'exact' | 'earlier' | 'later';
    decadeMatch?: boolean;
    genreMatches?: string[];
  }>;
  createdAt: number;
}

const activeRounds = new Map<string, SecretRoundState>();

// Periodic cleanup of stale rounds (> 2 hours old) to prevent memory leaks
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, r] of activeRounds.entries()) {
    if (r.createdAt < cutoff) {
      activeRounds.delete(id);
    }
  }
}, 15 * 60 * 1000);

// In-memory rate limiting to protect TMDB API quota
const gameRateLimits = new Map<string, { count: number; resetAt: number }>();
function gameRateLimitMiddleware(req: Request, res: Response, next: () => void) {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'anonymous';
  const now = Date.now();
  const entry = gameRateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    gameRateLimits.set(ip, { count: 1, resetAt: now + 60000 });
    return next();
  }
  if (entry.count >= 100) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }
  entry.count++;
  next();
}

/**
 * Discovers a candidate movie from TMDB /3/discover/movie and fetches 5 distinct
 * textless backdrops from /3/movie/{id}/images with retry limit.
 */
async function fetchRandomTmdbRoundMovie(
  selectedCountries: string[],
  selectedDecades: string[],
  excludeIds: Set<string>,
  excludeTitles: Set<string>,
  apiKey: string,
  maxRetries = 5
): Promise<{
  movieId: number | string;
  title: string;
  year: number;
  decade: string;
  country: string;
  director: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  clueImages: string[];
} | null> {
  const hasCountryFilter = selectedCountries.length > 0;
  const isOnlyUS = selectedCountries.length === 1 && selectedCountries[0] === 'US';
  const hasDecadeFilter = selectedDecades.length > 0;
  const isClassic = selectedDecades.includes('classic');

  // Min votes threshold ensures recognizable movies with valid backdrop coverage
  const primaryMinVotes = (hasCountryFilter && !isOnlyUS) || isClassic ? 15 : hasDecadeFilter ? 30 : 50;
  const secondaryMinVotes = (hasCountryFilter && !isOnlyUS) || isClassic ? 5 : 15;

  const buildDiscoverUrl = (page: number, minVotes: number, sortBy = 'popularity.desc') => {
    let url = `https://api.tmdb.org/3/discover/movie?api_key=${encodeURIComponent(
      apiKey
    )}&include_adult=false&include_video=false&language=en-US&sort_by=${sortBy}&vote_count.gte=${minVotes}&page=${page}`;

    if (selectedCountries.length > 0) {
      url += `&with_origin_country=${encodeURIComponent(selectedCountries.join('|'))}`;
    }

    if (selectedDecades.length > 0) {
      const ranges = selectedDecades.map((k) => DECADE_DATE_RANGES[k]).filter(Boolean);
      const minGte = ranges.reduce((acc, r) => (r.gte < acc ? r.gte : acc), ranges[0].gte);
      const maxLte = ranges.reduce((acc, r) => (r.lte > acc ? r.lte : acc), ranges[0].lte);
      url += `&primary_release_date.gte=${minGte}&primary_release_date.lte=${maxLte}`;
    } else {
      const today = new Date().toISOString().split('T')[0];
      url += `&primary_release_date.lte=${today}`;
    }

    return url;
  };

  const extractFiveBackdrops = (backdrops: any[], primaryBackdrop?: string | null): string[] => {
    if (!Array.isArray(backdrops) || backdrops.length === 0) {
      if (primaryBackdrop && typeof primaryBackdrop === 'string' && primaryBackdrop.trim().startsWith('/')) {
        const url = `https://image.tmdb.org/t/p/w780${primaryBackdrop}`;
        return [url, url, url, url, url];
      }
      return [];
    }

    const seenPaths = new Set<string>();
    const textlessBackdrops: any[] = [];
    const allValidBackdrops: any[] = [];

    for (const b of backdrops) {
      if (!b || typeof b.file_path !== 'string' || !b.file_path.trim().startsWith('/')) continue;
      if (seenPaths.has(b.file_path)) continue;
      seenPaths.add(b.file_path);
      allValidBackdrops.push(b);

      // Exclude backdrops containing localized titles or logos
      if (b.iso_639_1 === null || b.iso_639_1 === undefined || String(b.iso_639_1).trim() === '') {
        textlessBackdrops.push(b);
      }
    }

    // 1. First priority: 5 distinct textless backdrops via scene selector
    if (textlessBackdrops.length >= 5) {
      const selected = selectDistinctSceneScreenshots(textlessBackdrops, primaryBackdrop, 5, 'w780');
      if (selected.length === 5 && new Set(selected).size === 5) {
        return selected;
      }
      const shuffled = [...textlessBackdrops].sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, 5).map((b) => `https://image.tmdb.org/t/p/w780${b.file_path}`);
      if (chosen.length === 5 && new Set(chosen).size === 5) {
        return chosen;
      }
    }

    // 2. Second priority: combine textless with any available widescreen backdrops to reach 5
    const combinedPool = [...textlessBackdrops];
    for (const b of allValidBackdrops) {
      if (!combinedPool.some((p) => p.file_path === b.file_path)) {
        combinedPool.push(b);
      }
    }

    if (combinedPool.length >= 5) {
      const chosen = combinedPool.slice(0, 5).map((b) => `https://image.tmdb.org/t/p/w780${b.file_path}`);
      return chosen;
    }

    // 3. Third priority: pad available backdrops so movie is never discarded
    if (combinedPool.length >= 1) {
      const urls = combinedPool.map((b) => `https://image.tmdb.org/t/p/w780${b.file_path}`);
      while (urls.length < 5) {
        urls.push(...urls);
      }
      return urls.slice(0, 5);
    }

    if (primaryBackdrop && typeof primaryBackdrop === 'string' && primaryBackdrop.trim().startsWith('/')) {
      const url = `https://image.tmdb.org/t/p/w780${primaryBackdrop}`;
      return [url, url, url, url, url];
    }

    return [];
  };

  const candidatePool: any[] = [];
  const harvestCandidates = async (minVotes: number, activeExcludes: Set<string>, pagesCount = 4) => {
    try {
      const sortOptions = ['popularity.desc', 'vote_count.desc'];
      const chosenSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];

      const page1Res = await fetch(buildDiscoverUrl(1, minVotes, chosenSort));
      if (!page1Res.ok) return;
      const page1Data = await page1Res.json();
      const totalPages = Math.min(Number(page1Data.total_pages) || 1, 35);

      const pagesToFetch = [1];
      if (totalPages > 1) {
        const availablePages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        for (let i = availablePages.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [availablePages[i], availablePages[j]] = [availablePages[j], availablePages[i]];
        }
        pagesToFetch.push(...availablePages.slice(0, pagesCount));
      }

      const pageResponses = await Promise.all(
        pagesToFetch.map((p) =>
          fetch(buildDiscoverUrl(p, minVotes, chosenSort))
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      );

      for (const pData of pageResponses) {
        for (const m of pData?.results || []) {
          if (!m || !m.id || !m.title) continue;
          if (m.adult === true) continue;
          if (!m.backdrop_path) continue;
          if (!m.release_date || typeof m.release_date !== 'string' || m.release_date.length < 4) continue;
          const releaseYear = parseInt(m.release_date.split('-')[0], 10);
          if (isNaN(releaseYear) || releaseYear < 1900 || releaseYear > new Date().getFullYear() + 1) continue;

          const idStr = String(m.id);
          const normTitle = normalizeTitle(m.title);

          if (
            activeExcludes.has(idStr) ||
            activeExcludes.has(`tmdb-${idStr}`) ||
            (normTitle && excludeTitles.has(normTitle))
          ) {
            continue;
          }

          if (!candidatePool.some((c) => c.id === m.id)) {
            candidatePool.push(m);
          }
        }
      }
    } catch (err) {
      console.warn('Error harvesting discover candidates:', err);
    }
  };

  await harvestCandidates(primaryMinVotes, excludeIds, 3);
  if (candidatePool.length < 8) {
    await harvestCandidates(secondaryMinVotes, excludeIds, 5);
  }
  if (candidatePool.length < 4) {
    await harvestCandidates(0, excludeIds, 6);
  }

  // Shuffle candidates thoroughly
  for (let i = candidatePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
  }

  let attempts = 0;
  for (const candidate of candidatePool) {
    if (attempts >= maxRetries + 20) break;
    attempts++;

    try {
      const [imagesRes, detailsRes] = await Promise.all([
        fetch(
          `https://api.tmdb.org/3/movie/${candidate.id}/images?api_key=${encodeURIComponent(
            apiKey
          )}&include_image_language=en,null`
        ),
        fetch(
          `https://api.tmdb.org/3/movie/${candidate.id}?api_key=${encodeURIComponent(
            apiKey
          )}&append_to_response=credits`
        ),
      ]);

      if (!imagesRes.ok || !detailsRes.ok) continue;
      const imagesData = await imagesRes.json();
      const detailsData = await detailsRes.json();

      const clueImages = extractFiveBackdrops(imagesData.backdrops || [], detailsData.backdrop_path);
      if (clueImages.length < 5) {
        continue;
      }

      const releaseYear = detailsData.release_date
        ? parseInt(detailsData.release_date.split('-')[0], 10)
        : 2000;
      const decade = releaseYear < 1970 ? 'classic' : `${Math.floor(releaseYear / 10) * 10}s`;

      const primaryOrigins: string[] = (
        Array.isArray(detailsData.origin_country) ? detailsData.origin_country : []
      ).map((c: string) => c.toUpperCase());
      const fallbackProdOrigins: string[] = (
        (detailsData.production_countries || []).map((pc: any) => pc.iso_3166_1).filter(Boolean)
      ).map((c: string) => c.toUpperCase());

      // Comprehensive Indian cinema language mapping (Hindi, Telugu, Tamil, Malayalam, Kannada, etc.)
      const indianLangs = new Set(['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'ur']);
      const langOrigins =
        detailsData.original_language && indianLangs.has(detailsData.original_language) ? ['IN'] : [];
      const originCountries = [...primaryOrigins, ...fallbackProdOrigins, ...langOrigins];

      const matchedOrigin =
        selectedCountries.find((sc) => originCountries.includes(sc)) ||
        originCountries[0] ||
        'US';

      // Verify filters strictly
      if (
        !matchesMovieFilters(
          {
            id: `tmdb-${detailsData.id}`,
            title: detailsData.title,
            year: releaseYear,
            decade,
            country: matchedOrigin,
          },
          { countries: selectedCountries, decades: selectedDecades }
        )
      ) {
        continue;
      }

      const crew = detailsData.credits?.crew || [];
      const directorObj = crew.find((c: any) => c.job === 'Director');
      const director = directorObj ? directorObj.name : 'Master Filmmaker';
      const genreNames = (detailsData.genres || []).map((g: any) => g.name);

      return {
        movieId: detailsData.id,
        title: detailsData.title,
        year: releaseYear,
        decade,
        country: matchedOrigin,
        director,
        overview: detailsData.overview || '',
        posterUrl: detailsData.poster_path
          ? `https://image.tmdb.org/t/p/w500${detailsData.poster_path}`
          : null,
        backdropUrl: clueImages[4] || null,
        genres: genreNames.length > 0 ? genreNames : ['Drama'],
        clueImages,
      };
    } catch (err) {
      console.warn(`Retry candidate ${candidate.id} error:`, err);
    }
  }

  return null;
}

// 1. START NEW GAME ROUND (Secure: Never exposes title, ID, or answer metadata)
app.all('/api/game/round/new', gameRateLimitMiddleware, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const body = req.body || {};
  const query = req.query || {};

  const excludeParam = (body.excludeIds || body.exclude || query.exclude || query.excludeIds || '') as
    | string
    | string[];
  const excludeTitlesParam = (body.excludeTitles || query.excludeTitles || '') as
    | string
    | string[];
  const countriesParam = (body.countries || query.countries || '') as string | string[];
  const decadesParam = (body.decades || query.decades || '') as string | string[];

  const rawClientExcludeList = (
    Array.isArray(excludeParam) ? excludeParam : String(excludeParam).split(',')
  )
    .map((s) => String(s).trim())
    .filter(Boolean);

  const rawClientExcludeTitles = (
    Array.isArray(excludeTitlesParam) ? excludeTitlesParam : String(excludeTitlesParam).split(',')
  )
    .map((s) => normalizeTitle(String(s)))
    .filter(Boolean);

  const selectedCountries = (
    Array.isArray(countriesParam) ? countriesParam : String(countriesParam).split(',')
  )
    .map((c) => String(c).trim().toUpperCase())
    .filter(Boolean);

  const selectedDecades = (
    Array.isArray(decadesParam) ? decadesParam : String(decadesParam).split(',')
  )
    .map((d) => String(d).trim().toLowerCase())
    .filter((d) => Boolean(DECADE_DATE_RANGES[d]));

  const filterKey = `${[...selectedCountries].sort().join(',')}|${[...selectedDecades].sort().join(',')}`;
  const maxServerHistoryForFilter = 500;

  if (body.resetSeenPool === true) {
    recentServedIdsByFilter.delete(filterKey);
    recentServedTitlesByFilter.delete(filterKey);
  }

  const serverRecentIds = (recentServedIdsByFilter.get(filterKey) || []).slice(-maxServerHistoryForFilter);
  const serverRecentTitles = (recentServedTitlesByFilter.get(filterKey) || []).slice(-maxServerHistoryForFilter);

  const combinedExcludeList = Array.from(new Set([...serverRecentIds, ...rawClientExcludeList]));
  const combinedExcludeTitles = new Set<string>([...serverRecentTitles, ...rawClientExcludeTitles]);

  const clientExcludeIds = new Set<string>(
    combinedExcludeList.flatMap((id) => [
      id,
      id.replace(/^tmdb-/, ''),
      `tmdb-${id.replace(/^tmdb-/, '')}`,
    ])
  );

  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      error: 'TMDB_API_KEY is not configured on the server.',
      code: 'TMDB_API_KEY_MISSING',
    });
    return;
  }

  let selectedMovie: {
    movieId: number | string;
    title: string;
    year: number;
    decade: string;
    country: string;
    director: string;
    overview: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    genres: string[];
    clueImages: string[];
  } | null = null;

  try {
    selectedMovie = await fetchRandomTmdbRoundMovie(
      selectedCountries,
      selectedDecades,
      clientExcludeIds,
      combinedExcludeTitles,
      apiKey,
      8
    );
  } catch (tmdbErr) {
    console.error('Error fetching live TMDB round movie:', tmdbErr);
  }

  if (!selectedMovie) {
    res.status(503).json({
      error: 'TMDB did not return a new movie matching the selected filters.',
      code: 'TMDB_MOVIE_UNAVAILABLE',
    });
    return;
  }

  // Record served movie to prevent repeats in the session
  recordServerServedMovie(
    filterKey,
    String(selectedMovie.movieId),
    selectedMovie.title,
    maxServerHistoryForFilter
  );

  // Generate cryptographically secure round ID
  const roundId = crypto.randomUUID();

  // Save secret state strictly on server
  activeRounds.set(roundId, {
    roundId,
    movieId: selectedMovie.movieId,
    title: selectedMovie.title,
    year: selectedMovie.year,
    decade: selectedMovie.decade,
    country: selectedMovie.country,
    director: selectedMovie.director,
    overview: selectedMovie.overview,
    posterUrl: selectedMovie.posterUrl,
    backdropUrl: selectedMovie.backdropUrl,
    genres: selectedMovie.genres,
    clueImages: selectedMovie.clueImages,
    revealedClues: 1,
    maxClues: 5,
    guessesCount: 0,
    maxGuesses: 5,
    solved: false,
    forfeited: false,
    pointsEarned: 0,
    guesses: [],
    createdAt: Date.now(),
  });

  // Return ONLY public round data to frontend. Title, movie ID, and answer metadata are NEVER revealed!
  res.json({
    roundId,
    totalClues: 5,
    revealedClues: 1,
    maxGuesses: 5,
    remainingGuesses: 5,
    imageUrls: selectedMovie.clueImages, // 5 w780 URLs
    decade: selectedMovie.decade,
    country: selectedMovie.country,
    genres: selectedMovie.genres,
  });
});

// 2. REVEAL NEXT CLUE (Incrementally unlocks images 2 through 5)
app.post('/api/game/round/reveal-clue', gameRateLimitMiddleware, (req: Request, res: Response) => {
  const { roundId } = req.body || {};
  if (!roundId || !activeRounds.has(roundId)) {
    res.status(404).json({ error: 'Round not found or expired.' });
    return;
  }

  const round = activeRounds.get(roundId)!;
  if (round.solved || round.forfeited) {
    res.json({
      revealedClues: round.revealedClues,
      totalClues: round.maxClues,
      remainingClues: Math.max(0, round.maxClues - round.revealedClues),
      isFinished: true,
    });
    return;
  }

  if (round.revealedClues < round.maxClues) {
    round.revealedClues++;
  }

  res.json({
    revealedClues: round.revealedClues,
    totalClues: round.maxClues,
    remainingClues: Math.max(0, round.maxClues - round.revealedClues),
  });
});

// 3. SUBMIT GUESS (Server-side validation; prevents duplicate submissions / repeated score awards)
app.post('/api/game/round/guess', gameRateLimitMiddleware, (req: Request, res: Response) => {
  const { roundId, guess } = req.body || {};
  if (!roundId || !activeRounds.has(roundId)) {
    res.status(404).json({ error: 'Round not found or expired.' });
    return;
  }

  const round = activeRounds.get(roundId)!;

  // Prevent multiple submissions or repeated score awards for the same round
  if (round.solved || round.forfeited) {
    res.status(400).json({
      error: 'This round has already finished. No further submissions are allowed.',
      isGameOver: true,
      roundStatus: round.solved ? 'won' : 'lost',
      pointsEarned: round.pointsEarned,
    });
    return;
  }

  const trimmedGuess = typeof guess === 'string' ? guess.trim() : '';
  if (!trimmedGuess) {
    res.status(400).json({ error: 'Guess cannot be empty.' });
    return;
  }

  // Normalize guesses: trim whitespace and compare case-insensitively
  const isMatch = checkTitleMatch(trimmedGuess, round.title);

  // Look up catalog hints for year and genre feedback
  const catalogEntry = POPULAR_TITLES_CATALOG.find((m) => checkTitleMatch(m.title, trimmedGuess));
  const guessYear = catalogEntry ? catalogEntry.year : 0;
  const guessGenres = catalogEntry ? catalogEntry.genres : [];
  const yearRelation = guessYear ? compareReleaseYear(guessYear, round.year) : 'exact';
  const genreMatches = guessGenres.length > 0 ? findMatchingGenres(guessGenres, round.genres) : [];
  const decadeMatch = guessYear ? Math.floor(guessYear / 10) === Math.floor(round.year / 10) : false;

  if (isMatch) {
    // Round Solved / Won!
    round.solved = true;
    round.revealedClues = 5;

    const pointsEarned = calculateScore({
      clueTierRevealed: round.revealedClues,
      incorrectGuesses: round.guessesCount,
      streakCount: 1,
    });
    round.pointsEarned = pointsEarned;

    res.json({
      isCorrect: true,
      isGameOver: true,
      roundStatus: 'won',
      pointsEarned,
      revealedClues: 5,
      message: 'Brilliant deduction! That is the correct movie!',
      movie: {
        id: `tmdb-${round.movieId}`,
        title: round.title,
        year: round.year,
        director: round.director,
        overview: round.overview,
        posterUrl: round.posterUrl,
        backdropUrl: round.backdropUrl,
        genres: round.genres,
        screenshots: round.clueImages,
      },
    });
    return;
  }

  // Incorrect Guess
  round.guessesCount++;

  // Step-by-step unlock next screenshot on incorrect guess
  if (round.revealedClues < round.maxClues) {
    round.revealedClues++;
  }

  const guessRecord = {
    title: catalogEntry ? catalogEntry.title : trimmedGuess,
    year: guessYear,
    genres: guessGenres,
    isCorrect: false,
    yearRelation,
    decadeMatch,
    genreMatches,
    guessNumber: round.guessesCount,
  };
  round.guesses.push(guessRecord);

  // Check if out of guesses (5 chances)
  if (round.guessesCount >= round.maxGuesses) {
    round.forfeited = true;
    round.revealedClues = 5;

    res.json({
      isCorrect: false,
      isGameOver: true,
      roundStatus: 'lost',
      pointsEarned: 0,
      revealedClues: 5,
      remainingGuesses: 0,
      message: 'Out of guesses! The film has been revealed.',
      guessRecord,
      movie: {
        id: `tmdb-${round.movieId}`,
        title: round.title,
        year: round.year,
        director: round.director,
        overview: round.overview,
        posterUrl: round.posterUrl,
        backdropUrl: round.backdropUrl,
        genres: round.genres,
        screenshots: round.clueImages,
      },
    });
    return;
  }

  res.json({
    isCorrect: false,
    isGameOver: false,
    roundStatus: 'playing',
    remainingGuesses: round.maxGuesses - round.guessesCount,
    revealedClues: round.revealedClues,
    message: 'Incorrect guess. Inspect the scene closely or reveal the next clue!',
    guessRecord,
  });
});

// 4. SKIP MOVIE (Forfeits round, reveals answer metadata without awarding points)
app.post('/api/game/round/skip', gameRateLimitMiddleware, (req: Request, res: Response) => {
  const { roundId } = req.body || {};
  if (!roundId || !activeRounds.has(roundId)) {
    res.status(404).json({ error: 'Round not found or expired.' });
    return;
  }

  const round = activeRounds.get(roundId)!;
  round.forfeited = true;
  round.revealedClues = 5;
  round.pointsEarned = 0;

  res.json({
    skipped: true,
    isGameOver: true,
    roundStatus: 'lost',
    pointsEarned: 0,
    revealedClues: 5,
    message: 'Round skipped. The film has been revealed.',
    movie: {
      id: `tmdb-${round.movieId}`,
      title: round.title,
      year: round.year,
      director: round.director,
      overview: round.overview,
      posterUrl: round.posterUrl,
      backdropUrl: round.backdropUrl,
      genres: round.genres,
      screenshots: round.clueImages,
    },
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`CineClue server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

