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
  matchesMovieFilters,
  normalizeTitle,
  selectNonRepeatingMovie,
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
  resetSeenMovies,
  startNewGameRound,
  submitRoundGuess,
  revealNextRoundClue,
  skipGameRound,
  PublicRoundData,
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
import { ExhaustedPoolModal } from './components/ExhaustedPoolModal';

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
  const [showExhaustedModal, setShowExhaustedModal] = useState<boolean>(false);
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

  const filtersRef = useRef<MovieFilters>(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const [currentMovie, setCurrentMovie] = useState<Movie>(() => {
    const { movie } = selectNonRepeatingMovie(MOVIE_DATABASE, filters, []);
    return movie || MOVIE_DATABASE[0];
  });
  const [activeRound, setActiveRound] = useState<PublicRoundData | null>(null);
  const [revealedMovie, setRevealedMovie] = useState<Movie | null>(null);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState<boolean>(false);
  const [guessFeedbackMessage, setGuessFeedbackMessage] = useState<string | null>(null);
  const [isLoadingMovie, setIsLoadingMovie] = useState<boolean>(false);
  const sessionPlayedIds = useRef<Set<string>>(new Set());
  const sessionPlayedTitles = useRef<Set<string>>(new Set());

  // Prefetch first live TMDB movie immediately on mount
  useEffect(() => {
    const excludeList = Array.from(sessionPlayedIds.current);
    const excludeTitles = Array.from(sessionPlayedTitles.current);
    prefetchNextTmdbMovie(excludeList, filtersRef.current, excludeTitles);
  }, []);

  const recordSessionMovie = useCallback((movieOrId: Movie | string, maybeTitle?: string) => {
    const id = typeof movieOrId === 'string' ? movieOrId : movieOrId?.id;
    const title = typeof movieOrId === 'string' ? maybeTitle : movieOrId?.title;
    if (id && id.trim()) {
      const trimmed = id.trim();
      const clean = trimmed.replace(/^tmdb-/, '');
      sessionPlayedIds.current.add(trimmed);
      sessionPlayedIds.current.add(clean);
      sessionPlayedIds.current.add(`tmdb-${clean}`);
    }
    if (title && title.trim()) {
      const norm = normalizeTitle(title);
      if (norm) sessionPlayedTitles.current.add(norm);
    }
  }, []);

  // Apply filters handler
  const handleApplyFilters = async (newFilters: MovieFilters) => {
    filtersRef.current = newFilters;
    setFilters(newFilters);
    clearMoviePrefetchCache();
    setGuessFeedbackMessage(null);
    try {
      localStorage.setItem('cineclue_filters_v1', JSON.stringify(newFilters));
    } catch {
      // Ignore
    }

    // If currently in active gameplay (playing, paused, or post-round modal), load a round matching the updated filters!
    if ((gameState === 'playing' || gameState === 'paused' || gameState === 'gameover') && gameMode !== 'daily') {
      setIsLoadingMovie(true);
      try {
        const excludeList = Array.from(sessionPlayedIds.current);
        const excludeTitles = Array.from(sessionPlayedTitles.current);
        const roundData = await startNewGameRound(newFilters, excludeList, excludeTitles);
        if (roundData && roundData.roundId) {
          setActiveRound(roundData);
          setRevealedMovie(null);
          setRevealedTiers(roundData.revealedClues || 1);
          setGuesses([]);
          setUnlockedLetters(new Set());
          setRoundStatus('playing');
          setLastRoundPoints(0);
          if (gameMode === 'speedrun') {
            setSpeedrunTimer(15);
          }
          setGameState('playing');
        } else {
          setShowExhaustedModal(true);
        }
      } catch (err) {
        console.error('Error applying filters to game round:', err);
        setShowExhaustedModal(true);
      } finally {
        setIsLoadingMovie(false);
      }
    } else {
      // On title screen, prefetch next movie matching updated filters
      const excludeList = Array.from(sessionPlayedIds.current);
      const excludeTitles = Array.from(sessionPlayedTitles.current);
      prefetchNextTmdbMovie(excludeList, newFilters, excludeTitles);
    }
  };

  // Check URL autostart (?autostart=1)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        const excludeList = Array.from(sessionPlayedIds.current);
        const excludeTitles = Array.from(sessionPlayedTitles.current);
        startNewGameRound(filtersRef.current, excludeList, excludeTitles).then((roundData) => {
          if (roundData && roundData.roundId) {
            setActiveRound(roundData);
            setRevealedMovie(null);
            setRevealedTiers(roundData.revealedClues || 1);
            setGameState('playing');
          } else {
            setShowExhaustedModal(true);
          }
        }).catch(() => setShowExhaustedModal(true));
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
    const activeFilters = filtersRef.current;
    setIsLoadingMovie(true);
    setGuessFeedbackMessage(null);

    try {
      const excludeList = Array.from(sessionPlayedIds.current);
      const excludeTitles = Array.from(sessionPlayedTitles.current);
      const roundData = await startNewGameRound(activeFilters, excludeList, excludeTitles);
      if (roundData && roundData.roundId) {
        setActiveRound(roundData);
        setRevealedMovie(null);
        setGameMode(mode);
        setCurrentMovieIndex(0);
        setRevealedTiers(roundData.revealedClues || 1);
        setGuesses([]);
        setUnlockedLetters(new Set());
        setRoundStatus('playing');
        setLastRoundPoints(0);
        if (mode === 'speedrun') {
          setSpeedrunTimer(15);
        }
        setGameState('playing');
      } else {
        setShowExhaustedModal(true);
      }
    } catch (err) {
      console.error('Error starting game round:', err);
      setShowExhaustedModal(true);
    } finally {
      setIsLoadingMovie(false);
    }
  };

  const handleRestartCurrentMovie = async () => {
    playProjectorClick();
    stopSpeaking();
    setGuessFeedbackMessage(null);
    if (!activeRound) return;

    // Reset current round state locally (same movie clues)
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

  const handleRevealNextTier = async () => {
    if (revealedTiers < 5 && activeRound && roundStatus === 'playing') {
      playClueRevealSound();
      try {
        const result = await revealNextRoundClue(activeRound.roundId);
        setRevealedTiers(result.revealedClues);
      } catch {
        setRevealedTiers((prev) => Math.min(prev + 1, 5));
      }
    }
  };

  const availableLetters = useMemo(() => {
    return revealedMovie ? getAvailableLetterHints(revealedMovie.title, unlockedLetters) : [];
  }, [revealedMovie, unlockedLetters]);

  const handleUnlockLetter = () => {
    if (availableLetters.length === 0) return;
    playProjectorClick();
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

  const handleMakeGuess = async (guessedTitle: string) => {
    if (roundStatus !== 'playing' || !activeRound || isSubmittingGuess) return;
    setIsSubmittingGuess(true);
    setGuessFeedbackMessage(null);

    try {
      const result = await submitRoundGuess(activeRound.roundId, guessedTitle);

      if (result.error && !result.isGameOver) {
        setGuessFeedbackMessage(result.error);
        return;
      }

      if (result.isCorrect) {
        // VICTORY!
        playCorrectGuessFanfare();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#E50914', '#ffffff', '#b3b3b3'],
        });

        const earned = result.pointsEarned ?? currentPointsYield;
        const newStreak = streak + 1;
        const tierAtSolve = revealedTiers;
        setSolvedClueTier(tierAtSolve);
        setLastRoundPoints(earned);
        setSessionScore((prev) => prev + earned);
        setStreak(newStreak);
        setRoundStatus('won');
        setRevealedTiers(5);
        setRevealedMovie(result.movie || null);
        if (result.movie) {
          recordSessionMovie(result.movie);
        }
        setGameState('gameover');
        setGuessFeedbackMessage(result.message || 'Correct! Brilliant deduction!');

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
          solvedMovies: result.movie
            ? Array.from(new Set([...stats.solvedMovies, result.movie.title]))
            : stats.solvedMovies,
        };
        saveStats(updatedStats);
      } else {
        // WRONG GUESS
        playWrongGuessSound();

        if (result.guessRecord) {
          setGuesses((prev) => [...prev, result.guessRecord]);
        }
        if (result.revealedClues) {
          setRevealedTiers(result.revealedClues);
        }
        setGuessFeedbackMessage(result.message || 'Incorrect guess.');

        if (result.isGameOver) {
          // Out of guesses!
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
          setRevealedMovie(result.movie || null);
          if (result.movie) {
            recordSessionMovie(result.movie);
          }
          setGameState('gameover');

          const updatedStats: GameStats = {
            ...stats,
            gamesPlayed: stats.gamesPlayed + 1,
            currentStreak: 0,
          };
          saveStats(updatedStats);
        }
      }
    } catch (err) {
      console.error('Error submitting guess:', err);
      setGuessFeedbackMessage('Failed to validate guess. Please try again.');
    } finally {
      setIsSubmittingGuess(false);
    }
  };

  const handleForfeitOrTimeout = async () => {
    if (roundStatus !== 'playing' || !activeRound) return;
    setIsLoadingMovie(true);
    setGuessFeedbackMessage(null);

    try {
      const result = await skipGameRound(activeRound.roundId);
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
      setRevealedMovie(result.movie);
      if (result.movie) {
        recordSessionMovie(result.movie);
      }
      setGameState('gameover');

      const updatedStats: GameStats = {
        ...stats,
        gamesPlayed: stats.gamesPlayed + 1,
        currentStreak: 0,
      };
      saveStats(updatedStats);
    } catch (err) {
      console.error('Error skipping round:', err);
    } finally {
      setIsLoadingMovie(false);
    }
  };

  const handleNextFilm = async () => {
    playProjectorClick();
    stopSpeaking();
    setGuessFeedbackMessage(null);

    if (gameMode === 'daily') {
      setGameState('title');
      return;
    }

    setIsLoadingMovie(true);
    try {
      const excludeList = Array.from(sessionPlayedIds.current);
      const excludeTitles = Array.from(sessionPlayedTitles.current);
      const roundData = await startNewGameRound(filtersRef.current, excludeList, excludeTitles);
      if (roundData && roundData.roundId) {
        setActiveRound(roundData);
        setRevealedMovie(null);
        setCurrentMovieIndex((prev) => prev + 1);
        setRevealedTiers(roundData.revealedClues || 1);
        setGuesses([]);
        setUnlockedLetters(new Set());
        setRoundStatus('playing');
        setLastRoundPoints(0);
        if (gameMode === 'speedrun') {
          setSpeedrunTimer(15);
        }
        setGameState('playing');
      } else {
        setShowExhaustedModal(true);
      }
    } catch (err) {
      console.error('Error starting next film round:', err);
      setShowExhaustedModal(true);
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
          isModalOpen={
            showFilterModal ||
            showStatsModal ||
            showHowToPlayModal ||
            showTmdbModal ||
            showExhaustedModal
          }
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
                movie={revealedMovie}
                imageUrls={activeRound?.imageUrls || []}
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
                movie={revealedMovie}
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
                isSubmitting={isSubmittingGuess}
                feedbackMessage={guessFeedbackMessage}
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
          movie={revealedMovie || currentMovie}
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

      {/* Exhausted Movie Pool Modal */}
      {showExhaustedModal && (
        <ExhaustedPoolModal
          currentFilters={filters}
          onClearFilters={async () => {
            setShowExhaustedModal(false);
            await handleApplyFilters(DEFAULT_FILTERS);
          }}
          onOpenFilters={() => {
            setShowExhaustedModal(false);
            setShowFilterModal(true);
          }}
          onResetSeen={async () => {
            setShowExhaustedModal(false);
            sessionPlayedIds.current.clear();
            sessionPlayedTitles.current.clear();
            resetSeenMovies();
            if (gameState === 'title') {
              handleStartGame(gameMode);
            } else {
              setIsLoadingMovie(true);
              try {
                const roundData = await startNewGameRound(filtersRef.current, [], []);
                if (roundData && roundData.roundId) {
                  setActiveRound(roundData);
                  setRevealedMovie(null);
                  setRevealedTiers(roundData.revealedClues || 1);
                  setGuesses([]);
                  setUnlockedLetters(new Set());
                  setRoundStatus('playing');
                  setLastRoundPoints(0);
                  setGameState('playing');
                }
              } finally {
                setIsLoadingMovie(false);
              }
            }
          }}
          onQuitToTitle={
            gameState !== 'title'
              ? () => {
                  setShowExhaustedModal(false);
                  stopSpeaking();
                  setGameState('title');
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
