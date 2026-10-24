import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  matchesMovieFilters,
  selectDistinctSceneScreenshots,
  selectNonRepeatingMovie,
} from './src/game/rules.ts';
import { MOVIE_DATABASE, POPULAR_TITLES_CATALOG } from './src/data/movies.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Check TMDB connection status
app.get(['/api/tmdb/status', '/tmdb/status'], (req: Request, res: Response) => {
  const hasKey = Boolean(process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim().length > 0);
  res.json({
    connected: true,
    liveTmdb: hasKey,
    archiveCount: MOVIE_DATABASE.length,
    message: hasKey
      ? 'TMDB API is connected successfully with live movie database access.'
      : `Built-in Global Cinema Archive active (${MOVIE_DATABASE.length} films across 14 countries & 7 eras).`,
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
  if (apiKey && apiKey.trim().length > 0) {
    try {
      const tmdbRes = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(
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
  classic: { gte: '1920-01-01', lte: '1969-12-31', startYear: 1920, endYear: 1969 },
  '1970s': { gte: '1970-01-01', lte: '1979-12-31', startYear: 1970, endYear: 1979 },
  '1980s': { gte: '1980-01-01', lte: '1989-12-31', startYear: 1980, endYear: 1989 },
  '1990s': { gte: '1990-01-01', lte: '1999-12-31', startYear: 1990, endYear: 1999 },
  '2000s': { gte: '2000-01-01', lte: '2009-12-31', startYear: 2000, endYear: 2009 },
  '2010s': { gte: '2010-01-01', lte: '2019-12-31', startYear: 2010, endYear: 2019 },
  '2020s': { gte: '2020-01-01', lte: '2029-12-31', startYear: 2020, endYear: 2029 },
};

// Proxy TMDB Random Iconic Mystery Film with Guaranteed Multi-Country & Multi-Decade Archive Fallback
app.get(['/api/tmdb/random-movie', '/tmdb/random-movie'], async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const excludeParam = (req.query.exclude as string) || '';
  const countriesParam = (req.query.countries as string) || '';
  const decadesParam = (req.query.decades as string) || '';

  const rawClientExcludeList = excludeParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const clientExcludeIds = new Set<string>(
    rawClientExcludeList.flatMap((id) => [id, id.replace(/^tmdb-/, '')])
  );

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

  const apiKey = process.env.TMDB_API_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const hasSpecialFilters = selectedCountries.length > 0 || selectedDecades.length > 0;
      const isOnlyUS = selectedCountries.length === 1 && selectedCountries[0] === 'US';
      const primaryMinVotes = hasSpecialFilters && !isOnlyUS ? 80 : 600;
      const secondaryMinVotes = hasSpecialFilters ? 12 : 150;

      const candidatePool: any[] = [];
      const seenCandidateIds = new Set<string>();

      const buildDiscoverUrl = (page: number, minVotes: number, decadeKey?: string) => {
        let url = `https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(
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
        }

        return url;
      };

      const addEligibleFromResults = (results: any[]) => {
        for (const m of results || []) {
          const idStr = String(m.id);
          if (!m.backdrop_path || clientExcludeIds.has(idStr) || seenCandidateIds.has(idStr)) {
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
          seenCandidateIds.add(idStr);
          candidatePool.push(m);
        }
      };

      const harvestCandidates = async (minVotes: number) => {
        const shuffledDecades =
          selectedDecades.length > 0
            ? [...selectedDecades].sort(() => Math.random() - 0.5)
            : [undefined];

        for (const decadeKey of shuffledDecades.slice(0, 2)) {
          // 1. Fetch page 1 first to learn actual total_pages for this exact filter
          const page1Res = await fetch(buildDiscoverUrl(1, minVotes, decadeKey));
          if (!page1Res.ok) continue;
          const page1Data = await page1Res.json();
          addEligibleFromResults(page1Data.results || []);

          const totalPages = Math.min(Number(page1Data.total_pages) || 1, 15);
          if (totalPages > 1) {
            const extraPages: number[] = [];
            const availablePages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
            availablePages.sort(() => Math.random() - 0.5);
            extraPages.push(...availablePages.slice(0, 3));

            for (const p of extraPages) {
              const pRes = await fetch(buildDiscoverUrl(p, minVotes, decadeKey));
              if (!pRes.ok) continue;
              const pData = await pRes.json();
              addEligibleFromResults(pData.results || []);
              if (candidatePool.length >= 18) break;
            }
          }
        }
      };

      await harvestCandidates(primaryMinVotes);
      if (candidatePool.length < 6) {
        await harvestCandidates(secondaryMinVotes);
      }

      // Shuffle candidatePool thoroughly using Fisher-Yates
      for (let i = candidatePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
      }

      // Find a candidate that has at least 5 distinct textless scene backdrops
      for (const candidate of candidatePool.slice(0, 10)) {
        const detailsRes = await fetch(
          `https://api.themoviedb.org/3/movie/${candidate.id}?api_key=${encodeURIComponent(
            apiKey
          )}&append_to_response=credits,keywords,images&include_image_language=null`
        );
        if (!detailsRes.ok) continue;

        const details = await detailsRes.json();
        const screenshots = selectDistinctSceneScreenshots(
          details.images?.backdrops || [],
          details.backdrop_path,
          5
        );

        if (screenshots.length < 5) continue;

        const releaseYear = details.release_date
          ? parseInt(details.release_date.split('-')[0], 10)
          : 2000;
        const decade = releaseYear < 1970 ? '1960s' : `${Math.floor(releaseYear / 10) * 10}s`;

        const originCountries: string[] = [
          ...(Array.isArray(details.origin_country) ? details.origin_country : []),
          ...((details.production_countries || []).map((pc: any) => pc.iso_3166_1).filter(Boolean)),
        ].map((c: string) => c.toUpperCase());

        const matchedOrigin =
          selectedCountries.find((sc) => originCountries.includes(sc)) ||
          originCountries[0] ||
          selectedCountries[0] ||
          'US';

        // Double-check candidate satisfies active filters
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
          continue;
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

        const movieClue = {
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

        res.json({ movie: movieClue });
        return;
      }
    } catch (err: any) {
      console.error('Live TMDB lookup failed, serving from built-in archive:', err);
    }
  }

  // Built-in Multi-Country & Multi-Decade Archive Fallback (ensures 100% uptime across all deployed devices)
  try {
    const immediateExcludes = rawClientExcludeList.slice(-5);
    const { movie, didCycleFilterPool, filterPoolIds } = selectNonRepeatingMovie(
      MOVIE_DATABASE,
      filterCriteria,
      rawClientExcludeList,
      immediateExcludes
    );
    res.json({ movie, didCycleFilterPool, filterPoolIds });
  } catch (err: any) {
    console.error('Error selecting fallback archive movie:', err);
    res.status(500).json({ error: 'Failed to generate movie challenge' });
  }
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

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;

