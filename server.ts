import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { selectDistinctSceneScreenshots } from './src/game/rules';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory set of recently served movie IDs to guarantee non-repetition across rounds
const servedHistory = new Set<string>();

// Check TMDB connection status
app.get('/api/tmdb/status', (req: Request, res: Response) => {
  const hasKey = Boolean(process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim().length > 0);
  res.json({
    connected: hasKey,
    message: hasKey
      ? 'TMDB API is connected successfully with live movie database access.'
      : 'TMDB API key is not configured yet. Add TMDB_API_KEY in your environment or Secrets.',
  });
});

// Proxy TMDB Movie Search
app.get('/api/tmdb/search', async (req: Request, res: Response) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'TMDB_API_KEY is not configured' });
    return;
  }

  const query = req.query.q as string;
  if (!query || query.trim().length === 0) {
    res.json({ results: [] });
    return;
  }

  try {
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(
        query
      )}&include_adult=false&language=en-US&page=1`
    );

    if (!tmdbRes.ok) {
      res.status(tmdbRes.status).json({ error: 'Failed to fetch from TMDB' });
      return;
    }

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
  } catch (err: any) {
    console.error('Error proxying TMDB search:', err);
    res.status(500).json({ error: 'Internal TMDB proxy error' });
  }
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
    { words: ['spirit', 'bathhouse', 'dragon', ' Miyazaki'], emojis: ['♨️', '🐉', '🏮'] },
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
    const isMatch = rule.words.some(w => {
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

  // Genre fallbacks
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

  // Fallbacks if fewer than 5
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
    // Extract first sentence of overview
    const sentences = overview.split('. ');
    sourceText = sentences[0] ? `${sentences[0]}.` : overview.slice(0, 75);
  }

  const cleanWords = sourceText.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').split(/\s+/);
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'they', 'them', 'were',
    'have', 'been', 'will', 'your', 'into', 'over', 'some', 'what', 'when', 'then', 'about',
  ]);

  const candidates = cleanWords.filter(w => w.length >= 4 && !stopWords.has(w.toLowerCase()));
  const chosenWord = candidates.length > 0 ? candidates[candidates.length - 1] : 'future';

  // Replace case-insensitively the chosen word in the sourceText
  const regex = new RegExp(`\\b${chosenWord}\\b`, 'i');
  const prompt = sourceText.replace(regex, '______');

  return {
    prompt: prompt !== sourceText ? prompt : `${sourceText} ______`,
    blank: chosenWord,
    full: sourceText,
  };
}

// Proxy TMDB Random Iconic Mystery Film
app.get('/api/tmdb/random-movie', async (req: Request, res: Response) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'TMDB_API_KEY is not configured' });
    return;
  }

  // Parse exclusions and filters from client
  const excludeParam = (req.query.exclude as string) || '';
  const countriesParam = (req.query.countries as string) || '';
  const decadesParam = (req.query.decades as string) || '';

  const clientExcludeIds = new Set<string>(
    excludeParam.split(',').map(s => s.trim().replace(/^tmdb-/, '')).filter(Boolean)
  );

  const selectedCountries = countriesParam.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  const selectedDecades = decadesParam.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

  const decadeDateRanges: Record<string, { gte: string; lte: string }> = {
    classic: { gte: '1920-01-01', lte: '1969-12-31' },
    '1970s': { gte: '1970-01-01', lte: '1979-12-31' },
    '1980s': { gte: '1980-01-01', lte: '1989-12-31' },
    '1990s': { gte: '1990-01-01', lte: '1999-12-31' },
    '2000s': { gte: '2000-01-01', lte: '2009-12-31' },
    '2010s': { gte: '2010-01-01', lte: '2019-12-31' },
    '2020s': { gte: '2020-01-01', lte: '2029-12-31' },
  };

  try {
    // Adjust vote threshold based on filter specificity (e.g. international cinema or older eras have fewer votes on TMDB)
    const hasSpecialFilters = selectedCountries.length > 0 || selectedDecades.length > 0;
    const isOnlyUS = selectedCountries.length === 1 && selectedCountries[0] === 'US';
    const minVoteCount = hasSpecialFilters && !isOnlyUS ? 120 : 900;
    const maxPageSample = hasSpecialFilters ? 10 : 20;

    const candidatePool: any[] = [];
    const seenCandidateIds = new Set<string>();

    for (let attempt = 0; attempt < 4; attempt++) {
      const randomPage = Math.floor(Math.random() * maxPageSample) + 1;
      let discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(
        apiKey
      )}&sort_by=vote_count.desc&vote_count.gte=${minVoteCount}&language=en-US&page=${randomPage}`;

      if (selectedCountries.length > 0) {
        discoverUrl += `&with_origin_country=${encodeURIComponent(selectedCountries.join('|'))}`;
      }

      if (selectedDecades.length > 0) {
        const pickedDecadeKey = selectedDecades[Math.floor(Math.random() * selectedDecades.length)];
        const range = decadeDateRanges[pickedDecadeKey];
        if (range) {
          discoverUrl += `&primary_release_date.gte=${range.gte}&primary_release_date.lte=${range.lte}`;
        }
      }

      const discoverRes = await fetch(discoverUrl);
      if (!discoverRes.ok) continue;

      const discoverData = await discoverRes.json();
      const eligible = (discoverData.results || []).filter((m: any) => {
        const idStr = String(m.id);
        return (
          Boolean(m.backdrop_path) &&
          !clientExcludeIds.has(idStr) &&
          !servedHistory.has(idStr) &&
          !seenCandidateIds.has(idStr)
        );
      });

      for (const m of eligible) {
        seenCandidateIds.add(String(m.id));
        candidatePool.push(m);
      }

      if (candidatePool.length >= 12) break;
    }

    // Fallback page if sampled pages had no unplayed candidates
    if (candidatePool.length === 0) {
      let fallbackUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(
        apiKey
      )}&sort_by=popularity.desc&page=1`;

      if (selectedCountries.length > 0) {
        fallbackUrl += `&with_origin_country=${encodeURIComponent(selectedCountries.join('|'))}`;
      }
      if (selectedDecades.length > 0) {
        const range = decadeDateRanges[selectedDecades[0]];
        if (range) {
          fallbackUrl += `&primary_release_date.gte=${range.gte}&primary_release_date.lte=${range.lte}`;
        }
      }

      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const unplayed = (fallbackData.results || []).filter(
          (m: any) => Boolean(m.backdrop_path) && !clientExcludeIds.has(String(m.id))
        );
        candidatePool.push(...(unplayed.length > 0 ? unplayed : fallbackData.results || []));
      }
    }

    if (candidatePool.length === 0) {
      res.status(404).json({ error: 'No unplayed movies found for selected filters' });
      return;
    }

    // Shuffle candidatePool to randomize selection
    for (let i = candidatePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
    }

    // Find a candidate that has at least 5 strictly textless (iso_639_1 === null) distinct scene backdrops
    let details: any = null;
    let screenshots: string[] = [];

    for (const candidate of candidatePool.slice(0, 8)) {
      const detailsRes = await fetch(
        `https://api.themoviedb.org/3/movie/${candidate.id}?api_key=${encodeURIComponent(
          apiKey
        )}&append_to_response=credits,keywords,images&include_image_language=null`
      );
      if (!detailsRes.ok) continue;

      const candidateDetails = await detailsRes.json();
      const distinctScenes = selectDistinctSceneScreenshots(
        candidateDetails.images?.backdrops || [],
        candidateDetails.backdrop_path,
        5
      );

      if (distinctScenes.length === 5) {
        details = candidateDetails;
        screenshots = distinctScenes;
        break;
      }
    }

    if (!details || screenshots.length < 5) {
      res.status(404).json({ error: 'Could not find a movie with 5 title-free scene screenshots' });
      return;
    }

    // Mark as served in history
    servedHistory.add(String(details.id));
    if (servedHistory.size > 250) {
      const firstEntry = servedHistory.values().next().value;
      if (firstEntry) servedHistory.delete(firstEntry);
    }

    const releaseYear = details.release_date ? parseInt(details.release_date.split('-')[0], 10) : 2000;
    const decade = `${Math.floor(releaseYear / 10) * 10}s`;

    // Extract director
    const crew = details.credits?.crew || [];
    const directorObj = crew.find((c: any) => c.job === 'Director');
    const director = directorObj ? directorObj.name : 'Master Filmmaker';

    // Extract cast dossier
    const cast = (details.credits?.cast || []).slice(0, 3).map((c: any, idx: number) => {
      const cleanChar = c.character ? c.character.split('/')[0].trim() : 'Key Protagonist';
      const titles = ['The Lead Protagonist', 'The Principal Foil', 'The Crucial Ally'];
      const archetypeTitle = cleanChar.length > 2 && cleanChar.length < 25 ? `The ${cleanChar}` : titles[idx] || 'Central Character';

      return {
        archetype: archetypeTitle,
        characterDescription: `Portrayed with iconic distinction by ${c.name}.`,
        actorInitials: c.name
          .split(' ')
          .map((p: string) => p[0])
          .join('.') + '.',
      };
    });

    const genreNames = (details.genres || []).map((g: any) => g.name);
    const keywordsList = (details.keywords?.keywords || []).map((k: any) => k.name);

    // Dynamic Thematic Emojis
    const emojis = generateThematicEmojis(details.title, details.overview || '', keywordsList, genreNames);

    // Tagline with blank
    const taglineObj = formatTaglineBlank(details.tagline, details.overview || '');

    // Format box office
    let grossText = 'Box Office Blockbuster';
    if (details.revenue && details.revenue > 1000000) {
      if (details.revenue >= 1000000000) {
        grossText = `$${(details.revenue / 1000000000).toFixed(2)} Billion Worldwide`;
      } else {
        grossText = `$${(details.revenue / 1000000).toFixed(0)} Million Worldwide`;
      }
    }

    // Format rating
    const ratingText = details.vote_average
      ? `TMDB Score: ${details.vote_average.toFixed(1)}/10 (${details.vote_count.toLocaleString()} cinephile votes)`
      : 'Universally Recognized Masterpiece';

    // Quote dialog
    const leadCharName = details.credits?.cast?.[0]?.character
      ? details.credits.cast[0].character.split('/')[0].trim()
      : 'The Lead';

    const quoteDialogue = details.tagline && details.tagline.trim().length > 12
      ? details.tagline
      : details.overview || `A cinematic journey directed by ${director}.`;

    // Redact movie title from dialogue to prevent spoiler
    const escapedTitle = details.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sanitizedDialogue = quoteDialogue.replace(new RegExp(`\\b${escapedTitle}\\b`, 'gi'), '[This Film]');

    const movieClue = {
      id: `tmdb-${details.id}`,
      title: details.title,
      year: releaseYear,
      decade,
      director,
      genres: genreNames,
      difficulty: (details.vote_count > 10000 ? 'Novice' : 'Cinephile') as 'Novice' | 'Cinephile',
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
        description: `Official Theatrical Key Art (${releaseYear}) • ${genreNames.slice(0, 2).join(' / ')}`,
      },
      castDossier: cast.length > 0 ? cast : [
        { archetype: 'The Protagonist', characterDescription: 'Central figure', actorInitials: 'A.L.' }
      ],
      boxOfficeTrivia: {
        oscars: ratingText,
        budgetOrGross: grossText,
        secretTrivia: details.overview || `An acclaimed cinematic release preserved in TMDB history.`,
      },
      posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
      backdropUrl: screenshots[4] || null,
    };

    res.json({ movie: movieClue });
  } catch (err: any) {
    console.error('Error fetching random TMDB movie:', err);
    res.status(500).json({ error: 'Failed to generate TMDB movie challenge' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
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

  app.listen(PORT, () => {
    console.log(`CineClue server running on http://localhost:${PORT}`);
  });
}

startServer();
