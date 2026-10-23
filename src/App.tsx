/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { MOVIE_DATABASE, POPULAR_TITLES_CATALOG } from './data/movies';
import { GameMode, GuessRecord, GameStats, Movie, MovieFilters } from './types/movie';
import {
  calculateScore,
  checkTitleMatch,
  compareReleaseYear,
  findMatchingGenres,
  calculateStarRating,
  getAvailableLetterHints,
} from './game/rules';
import {
  isSoundEnabled,
  setSoundEnabled,
  playProjectorClick,
  playClueRevealSound,
  playCorrectGuessFanfare,
  playWrongGuessSound,
  playLosingMusic,
  stopSpeaking,
} from './utils/audio';
import { Film } from 'lucide-react';
import {
  clearMoviePrefetchCache,
  fetchRandomTmdbMovie,
  prefetchNextTmdbMovie,
} from './services/tmdbService';
import { DEFAULT_FILTERS } from './data/filterOptions';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { ClueReel } from './components/ClueReel';
import { GuessInput } from './components/GuessInput';
import { StatusModal } from './components/StatusModal';
import { StatsModal } from './components/StatsModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { TmdbInfoModal } from './components/TmdbInfoModal';
import { FilterModal } from './components/FilterModal';

const STATS_STORAGE_KEY = 'cineclue_stats_v1';
const MAX_GUESSES_PER_ROUND = 5;

const INITIAL_STATS: GameStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalScore: 0,
  clueDistribution: {
    clue1: 0,
    clue2: 0,
    clue3: 0,
    clue4: 0,
    clue5: 0,
    clue6: 0,
  },
  solvedMovies: [],
};

export default function App() {
  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused' | 'gameover'>('title');
  const [gameMode, setGameMode] = useState<GameMode>('campaign');
  const [currentMovieIndex, setCurrentMovieIndex] = useState<number>(0);
  const [revealedTiers, setRevealedTiers] = useState<number>(1);
  const [guesses, setGuesses] = useState<GuessRecord[]>([]);
  const [unlockedLetters, setUnlockedLetters] = useState<Set<string>>(new Set());
  const [roundStatus, setRoundStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [sessionScore, setSessionScore] = useState<number>(0);
  const [lastRoundPoints, setLastRoundPoints] = useState<number>(0);
  const [solvedClueTier, setSolvedClueTier] = useState<number>(1);
  const [streak, setStreak] = useState<number>(0);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showHowToPlayModal, setShowHowToPlayModal] = useState<boolean>(false);
  const [showTmdbModal, setShowTmdbModal] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [speedrunTimer, setSpeedrunTimer] = useState<number>(15);

  // Filter state persisted in localStorage
  const [filters, setFilters] = useState<MovieFilters>(() => {
    if (typeof window === 'undefined') return DEFAULT_FILTERS;
    try {
      const saved = localStorage.getItem('cineclue_filters_v1');
      return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  // Load lifetime stats
  const [stats, setStats] = useState<GameStats>(() => {
    if (typeof window === 'undefined') return INITIAL_STATS;
    try {
      const saved = localStorage.getItem(STATS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_STATS;
    } catch {
      return INITIAL_STATS;
    }
  });

  // Save lifetime stats
  const saveStats = useCallback((updated: GameStats) => {
    setStats(updated);
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, []);

  // Update document.body.dataset.state for ultra-mode compliance
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const [currentMovie, setCurrentMovie] = useState<Movie>(MOVIE_DATABASE[0]);
  const [isLoadingMovie, setIsLoadingMovie] = useState<boolean>(false);
  const sessionPlayedIds = useRef<Set<string>>(new Set());

  // Apply filters handler
  const handleApplyFilters = async (newFilters: MovieFilters) => {
    setFilters(newFilters);
    clearMoviePrefetchCache();
    try {
      localStorage.setItem('cineclue_filters_v1', JSON.stringify(newFilters));
    } catch {
      // Ignore
    }

    // If currently in active gameplay (playing, paused, or post-round modal), load a film matching the updated filters!
    if ((gameState === 'playing' || gameState === 'paused' || gameState === 'gameover') && gameMode !== 'daily') {
      setIsLoadingMovie(true);
      try {
        const excludeList = Array.from(new Set([...sessionPlayedIds.current, currentMovie.id]));
        const movie = await fetchRandomTmdbMovie(excludeList, newFilters);
        if (movie) {
          sessionPlayedIds.current.add(movie.id);
          setCurrentMovie(movie);
          setRevealedTiers(1);
          setGuesses([]);
          setUnlockedLetters(new Set());
          setRoundStatus('playing');
          setLastRoundPoints(0);
          if (gameMode === 'speedrun') {
            setSpeedrunTimer(15);
          }
          setGameState('playing');
        }
      } finally {
        setIsLoadingMovie(false);
      }
    } else {
      // On title screen, warm the prefetch cache for the newly selected filters
      prefetchNextTmdbMovie(Array.from(sessionPlayedIds.current), newFilters);
    }
  };

  // Check URL autostart (?autostart=1)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        setGameState('playing');
        fetchRandomTmdbMovie(Array.from(sessionPlayedIds.current), filters).then((m) => {
          if (m) {
            sessionPlayedIds.current.add(m.id);
            setCurrentMovie(m);
          }
        });
      }
    }
  }, []);

  // Timer for Speedrun mode
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState === 'playing' && gameMode === 'speedrun' && roundStatus === 'playing' && !isLoadingMovie) {
      interval = setInterval(() => {
        setSpeedrunTimer((prev) => {
          if (prev <= 1) {
            handleForfeitOrTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState, gameMode, roundStatus, isLoadingMovie]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in search input
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (gameState === 'playing') {
          stopSpeaking();
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
      } else if (e.key.toLowerCase() === 'm') {
        const next = !soundOn;
        setSoundOn(next);
        setSoundEnabled(next);
      } else if (e.key.toLowerCase() === 'r') {
        if (gameState === 'playing') {
          handleRestartCurrentMovie();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [gameState, soundOn]);

  const handleStartGame = async (mode: GameMode) => {
    playProjectorClick();
    setGameMode(mode);
    setCurrentMovieIndex(0);
    setRevealedTiers(1);
    setGuesses([]);
    setUnlockedLetters(new Set());
    setRoundStatus('playing');
    setLastRoundPoints(0);
    if (mode === 'speedrun') {
      setSpeedrunTimer(15);
    }
    setGameState('playing');
    setIsLoadingMovie(true);

    try {
      const excludeList = Array.from(sessionPlayedIds.current);
      const movie = await fetchRandomTmdbMovie(excludeList, filters);
      if (movie) {
        sessionPlayedIds.current.add(movie.id);
        setCurrentMovie(movie);
      }
    } finally {
      setIsLoadingMovie(false);
    }
  };

  const handleRestartCurrentMovie = () => {
    playProjectorClick();
    stopSpeaking();
    setRevealedTiers(1);
    setGuesses([]);
    setUnlockedLetters(new Set());
    setRoundStatus('playing');
    setLastRoundPoints(0);
    if (gameMode === 'speedrun') {
      setSpeedrunTimer(15);
    }
    setGameState('playing');
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const handleRevealNextTier = () => {
    if (revealedTiers < 5) {
      setRevealedTiers((prev) => prev + 1);
    }
  };

  const availableLetters = useMemo(() => {
    return getAvailableLetterHints(currentMovie.title, unlockedLetters);
  }, [currentMovie.title, unlockedLetters]);

  const handleUnlockLetter = () => {
    if (availableLetters.length === 0) return;
    playProjectorClick();
    // Pick 1 random available letter
    const randomIndex = Math.floor(Math.random() * availableLetters.length);
    const chosenLetter = availableLetters[randomIndex];
    setUnlockedLetters((prev) => {
      const next = new Set(prev);
      next.add(chosenLetter);
      return next;
    });
  };

  const currentPointsYield = useMemo(() => {
    return calculateScore({
      clueTierRevealed: revealedTiers,
      incorrectGuesses: guesses.filter((g) => !g.isCorrect).length,
      streakCount: streak + 1,
      usedLetterHintCount: unlockedLetters.size,
    });
  }, [revealedTiers, guesses, streak, unlockedLetters.size]);

  const handleMakeGuess = (guessedTitle: string) => {
    if (roundStatus !== 'playing') return;

    const isMatch = checkTitleMatch(guessedTitle, currentMovie.title);

    // Look up year and genres from catalog or guess string
    const catalogEntry = POPULAR_TITLES_CATALOG.find(
      (m) => checkTitleMatch(m.title, guessedTitle)
    );
    const guessYear = catalogEntry ? catalogEntry.year : 0;
    const guessGenres = catalogEntry ? catalogEntry.genres : [];

    const yearRelation = guessYear ? compareReleaseYear(guessYear, currentMovie.year) : 'exact';
    const genreMatches = guessGenres.length > 0 ? findMatchingGenres(guessGenres, currentMovie.genres) : [];
    const decadeMatch = guessYear ? Math.floor(guessYear / 10) === Math.floor(currentMovie.year / 10) : false;

    const newRecord: GuessRecord = {
      title: catalogEntry ? catalogEntry.title : guessedTitle,
      year: guessYear,
      genres: guessGenres,
      isCorrect: isMatch,
      yearRelation,
      decadeMatch,
      genreMatches,
      guessNumber: guesses.length + 1,
    };

    const updatedGuesses = [...guesses, newRecord];
    setGuesses(updatedGuesses);

    if (isMatch) {
      // VICTORY!
      playCorrectGuessFanfare();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E50914', '#ffffff', '#b3b3b3'],
      });

      const earned = currentPointsYield;
      const newStreak = streak + 1;
      const tierAtSolve = revealedTiers;
      setSolvedClueTier(tierAtSolve);
      setLastRoundPoints(earned);
      setSessionScore((prev) => prev + earned);
      setStreak(newStreak);
      setRoundStatus('won');
      setRevealedTiers(5); // unlock all 5 screenshots on win so player can view all scenes
      setGameState('gameover');

      // Update career stats
      const clueKey = `clue${Math.min(tierAtSolve, 5)}` as keyof GameStats['clueDistribution'];
      const updatedStats: GameStats = {
        ...stats,
        gamesPlayed: stats.gamesPlayed + 1,
        gamesWon: stats.gamesWon + 1,
        currentStreak: newStreak,
        bestStreak: Math.max(stats.bestStreak, newStreak),
        totalScore: stats.totalScore + earned,
        clueDistribution: {
          ...stats.clueDistribution,
          [clueKey]: (stats.clueDistribution[clueKey] || 0) + 1,
        },
        solvedMovies: Array.from(new Set([...stats.solvedMovies, currentMovie.title])),
      };
      saveStats(updatedStats);
    } else {
      // WRONG GUESS
      playWrongGuessSound();

      if (updatedGuesses.length >= MAX_GUESSES_PER_ROUND) {
        // Round Lost (Out of 5 guesses after all 5 clues)
        handleForfeitOrTimeout();
      } else {
        // Automatically unlock next screenshot and deduct points step-by-step
        if (revealedTiers < 5) {
          setRevealedTiers((prev) => prev + 1);
        }
      }
    }
  };

  const handleForfeitOrTimeout = () => {
    playLosingMusic();
    stopSpeaking();
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#E50914', '#ffffff', '#737373'],
    });
    setSolvedClueTier(5);
    setStreak(0);
    setLastRoundPoints(0);
    setRoundStatus('lost');
    setRevealedTiers(5);
    setGameState('gameover');

    const updatedStats: GameStats = {
      ...stats,
      gamesPlayed: stats.gamesPlayed + 1,
      currentStreak: 0,
    };
    saveStats(updatedStats);
  };

  const handleNextFilm = async () => {
    playProjectorClick();
    stopSpeaking();

    if (gameMode === 'daily') {
      setGameState('title');
      return;
    }

    setIsLoadingMovie(true);
    try {
      sessionPlayedIds.current.add(currentMovie.id);
      const excludeList = Array.from(sessionPlayedIds.current);
      const nextMovie = await fetchRandomTmdbMovie(excludeList, filters);
      if (nextMovie) {
        sessionPlayedIds.current.add(nextMovie.id);
        setCurrentMovie(nextMovie);
        setCurrentMovieIndex((prev) => prev + 1);
        setRevealedTiers(1);
        setGuesses([]);
        setUnlockedLetters(new Set());
        setRoundStatus('playing');
        setLastRoundPoints(0);
        if (gameMode === 'speedrun') {
          setSpeedrunTimer(15);
        }
        setGameState('playing');
      }
    } finally {
      setIsLoadingMovie(false);
    }
  };

  const starsWon = useMemo(() => {
    const wrongCount = guesses.filter((g) => !g.isCorrect).length;
    return calculateStarRating(solvedClueTier, wrongCount);
  }, [solvedClueTier, guesses]);

  return (
    <div className="min-h-screen bg-[#141413] text-[#FDF5E1] flex flex-col items-center justify-start relative overflow-x-hidden selection:bg-[#EC5A49] selection:text-[#141413]">
      {/* Screen 1: Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          onOpenStats={() => setShowStatsModal(true)}
          onOpenHowToPlay={() => setShowHowToPlayModal(true)}
          onOpenTmdb={() => setShowTmdbModal(true)}
          onOpenFilters={() => setShowFilterModal(true)}
          currentFilters={filters}
          soundEnabled={soundOn}
          onToggleSound={handleToggleSound}
        />
      )}

      {/* Screen 2: Active Gameplay Screen */}
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameover') && (
        <div className="relative z-10 w-full flex flex-col items-center">
          <GameHud
            score={sessionScore}
            scoreYield={currentPointsYield}
            streak={streak}
            mode={gameMode}
            currentRound={currentMovieIndex + 1}
            totalRounds={gameMode === 'campaign' ? 10 : 99}
            timeRemaining={gameMode === 'speedrun' ? speedrunTimer : undefined}
            soundEnabled={soundOn}
            filters={filters}
            onOpenFilters={() => setShowFilterModal(true)}
            onOpenStats={() => setShowStatsModal(true)}
            onOpenHowToPlay={() => setShowHowToPlayModal(true)}
            onToggleSound={handleToggleSound}
            onPause={() => {
              stopSpeaking();
              setGameState('paused');
            }}
            onRestart={handleRestartCurrentMovie}
            onQuitToTitle={() => {
              stopSpeaking();
              setGameState('title');
            }}
          />

          <main className="w-full max-w-[1380px] mx-auto px-6 sm:px-10 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8 w-full flex flex-col">
              <ClueReel
                movie={currentMovie}
                revealedTiers={revealedTiers}
                onRevealNextTier={handleRevealNextTier}
                onRevealAnswer={handleForfeitOrTimeout}
                isSolved={roundStatus === 'won'}
                isRoundOver={roundStatus !== 'playing'}
                scoreYield={currentPointsYield}
                unlockedLetters={unlockedLetters}
                onUnlockLetter={handleUnlockLetter}
                availableLetterCount={availableLetters.length}
              />
            </div>

            <div className="lg:col-span-4 w-full flex flex-col">
              <GuessInput
                movie={currentMovie}
                guesses={guesses}
                maxGuesses={MAX_GUESSES_PER_ROUND}
                onMakeGuess={handleMakeGuess}
                onGiveUp={handleForfeitOrTimeout}
                isGameOver={roundStatus !== 'playing'}
                unlockedLetters={unlockedLetters}
                revealedTiers={revealedTiers}
                onRevealNextTier={handleRevealNextTier}
                onUnlockLetter={handleUnlockLetter}
                availableLetterCount={availableLetters.length}
              />
            </div>
          </main>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoadingMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-10 h-10 border-3 border-[#EC5A49] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Status Modals: Victory, Defeat, Paused */}
      {(gameState === 'paused' || gameState === 'gameover') && (
        <StatusModal
          status={gameState === 'paused' ? 'paused' : roundStatus === 'won' ? 'won' : 'lost'}
          movie={currentMovie}
          pointsEarned={lastRoundPoints}
          cluesUsed={solvedClueTier}
          attemptsUsed={guesses.length}
          stars={starsWon}
          streak={streak}
          isLastRound={gameMode === 'campaign' ? currentMovieIndex >= 9 : false}
          onNextFilm={handleNextFilm}
          onResume={() => setGameState('playing')}
          onRestart={handleRestartCurrentMovie}
          onQuitToTitle={() => {
            stopSpeaking();
            setGameState('title');
          }}
        />
      )}

      {/* Statistics Career Modal */}
      {showStatsModal && (
        <StatsModal stats={stats} onClose={() => setShowStatsModal(false)} />
      )}

      {/* How to Play Rulebook Modal */}
      {showHowToPlayModal && (
        <HowToPlayModal onClose={() => setShowHowToPlayModal(false)} />
      )}

      {/* TMDB API Setup & Connection Modal */}
      {showTmdbModal && (
        <TmdbInfoModal onClose={() => setShowTmdbModal(false)} />
      )}

      {/* Cinema Filters Modal */}
      {showFilterModal && (
        <FilterModal
          currentFilters={filters}
          onApplyFilters={handleApplyFilters}
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </div>
  );
}
