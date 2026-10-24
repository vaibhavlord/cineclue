import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RoomState, MultiplayerMovieSafe } from '../types/multiplayer';
import { POPULAR_TITLES_CATALOG } from '../data/movies';
import { submitGuess, leaveRoom } from '../services/multiplayerService';
import { subscribeToMultiplayerRoom } from '../services/firebase';
import {
  playProjectorClick,
  playCorrectGuessFanfare,
  playWrongGuessSound,
  playClueRevealSound,
} from '../utils/audio';
import {
  Clock,
  Send,
  Search,
  Check,
  X,
  Trophy,
  ArrowLeft,
  Flame,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Lock,
} from 'lucide-react';

interface MultiplayerArenaProps {
  initialRoom: RoomState;
  myPlayerId: string;
  onMatchFinished: (room: RoomState) => void;
  onLeaveMatch: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const MultiplayerArena: React.FC<MultiplayerArenaProps> = ({
  initialRoom,
  myPlayerId,
  onMatchFinished,
  onLeaveMatch,
  soundEnabled,
  onToggleSound,
}) => {
  const [room, setRoom] = useState<RoomState>(initialRoom);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isOpenDropdown, setIsOpenDropdown] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [activeSceneTab, setActiveSceneTab] = useState<number>(1);
  const [revealedSceneCount, setRevealedSceneCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [confirmLeave, setConfirmLeave] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMovieIndexRef = useRef<number>(initialRoom.currentMovieIndex);

  // Subscribe to real-time room changes
  useEffect(() => {
    const unsubscribe = subscribeToMultiplayerRoom(room.code, (updatedRoom) => {
      setRoom(updatedRoom);

      // Check if match ended or abandoned
      if (updatedRoom.status === 'ended' || updatedRoom.status === 'abandoned') {
        onMatchFinished(updatedRoom);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [room.code, onMatchFinished]);

  // Synchronized countdown timer based on server room.matchEndTime
  useEffect(() => {
    const updateCountdown = () => {
      if (!room.matchEndTime) return;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((room.matchEndTime - now) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0 && room.status === 'playing') {
        // Time expired, let server state resolve
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 250);
    return () => clearInterval(interval);
  }, [room.matchEndTime, room.status]);

  // Auto-progress revealed scene count every 9 seconds for the current movie
  const currentMovieIndex = room.currentMovieIndex;
  useEffect(() => {
    if (prevMovieIndexRef.current !== currentMovieIndex) {
      // Movie advanced!
      prevMovieIndexRef.current = currentMovieIndex;
      setRevealedSceneCount(1);
      setActiveSceneTab(1);
      setSearchTerm('');
      setIsOpenDropdown(false);
      playClueRevealSound();
    }
  }, [currentMovieIndex]);

  useEffect(() => {
    // Reveal next screenshot scene every 9 seconds up to 5
    const sceneInterval = setInterval(() => {
      setRevealedSceneCount((prev) => {
        if (prev < 5) {
          playClueRevealSound();
          return prev + 1;
        }
        return prev;
      });
    }, 9000);

    return () => clearInterval(sceneInterval);
  }, [currentMovieIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter autocomplete suggestions
  const filteredSuggestions = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    const query = searchTerm.toLowerCase().trim();
    return POPULAR_TITLES_CATALOG.filter((item) =>
      item.title.toLowerCase().includes(query)
    ).slice(0, 6);
  }, [searchTerm]);

  const currentMovie: MultiplayerMovieSafe | undefined = room.movieList[currentMovieIndex];

  // Players
  const playersList = Object.values(room.players);
  const myPlayer = room.players[myPlayerId] || { name: 'You', score: 0 };
  const opponent = playersList.find((p) => p.id !== myPlayerId) || {
    name: 'Opponent',
    score: 0,
  };

  const handleGuessSubmit = async (titleToSubmit?: string) => {
    const guessText = (titleToSubmit || searchTerm).trim();
    if (!guessText || isSubmitting || room.status !== 'playing') return;

    setIsSubmitting(true);
    setIsOpenDropdown(false);
    playProjectorClick();

    try {
      const res = await submitGuess(
        room.code,
        myPlayerId,
        guessText,
        room.currentMovieIndex
      );

      if (res.isCorrect) {
        playCorrectGuessFanfare();
        setFeedbackMessage({
          text: `+1 Point! "${guessText}" was correct!`,
          type: 'success',
        });
        setSearchTerm('');
        if (res.room) {
          setRoom(res.room);
          if (res.room.status === 'ended') {
            onMatchFinished(res.room);
          }
        }
      } else {
        playWrongGuessSound();
        setFeedbackMessage({
          text: res.message || 'Incorrect title, keep guessing!',
          type: res.message?.includes('already solved') ? 'info' : 'error',
        });
        if (res.room) {
          setRoom(res.room);
          if (res.room.status === 'ended') {
            onMatchFinished(res.room);
          }
        }
      }
    } catch {
      setFeedbackMessage({
        text: 'Network error submitting guess. Try again.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setFeedbackMessage(null);
      }, 3500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredSuggestions.length);
        setIsOpenDropdown(true);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setHighlightedIndex((prev) =>
          prev === 0 ? filteredSuggestions.length - 1 : prev - 1
        );
        setIsOpenDropdown(true);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpenDropdown && filteredSuggestions[highlightedIndex]) {
        handleGuessSubmit(filteredSuggestions[highlightedIndex].title);
      } else {
        handleGuessSubmit();
      }
    } else if (e.key === 'Escape') {
      setIsOpenDropdown(false);
    }
  };

  const handleForfeitAndExit = async () => {
    playProjectorClick();
    await leaveRoom(room.code, myPlayerId);
    onLeaveMatch();
  };

  const screenshots = currentMovie?.screenshots || [];
  const currentSceneUrl = screenshots[activeSceneTab - 1] || null;

  return (
    <div className="min-h-screen w-full bg-[#141413] text-[#FDF5E1] flex flex-col justify-between select-none">
      {/* Top Authoritative Scoreboard & Timer */}
      <header className="w-full border-b border-white/[0.08] bg-[#1A1A19]/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-8 h-[74px] flex items-center justify-between gap-4">
          {/* Player 1 (You) Score */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EC5A49]/20 border border-[#EC5A49]/50 flex items-center justify-center font-cinema text-xl text-[#EC5A49]">
              {myPlayer.score}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-cinema text-lg text-white truncate max-w-[110px] sm:max-w-[160px]">
                  {myPlayer.name}
                </span>
                <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 uppercase">
                  You
                </span>
              </div>
              <span className="text-[11px] font-mono-code text-[#EC5A49]">
                {myPlayer.score} {myPlayer.score === 1 ? 'pt' : 'pts'}
              </span>
            </div>
          </div>

          {/* Center: Synchronized Match Timer */}
          <div className="flex flex-col items-center">
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${
                secondsRemaining <= 10
                  ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                  : 'bg-[#252524] border-white/15 text-[#EAF18A]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="font-mono-code text-lg sm:text-xl font-bold tracking-wider tabular-nums">
                {String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:
                {String(secondsRemaining % 60).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[10px] font-mono-code text-[#8E8A82] uppercase tracking-wider mt-0.5">
              Film {currentMovieIndex + 1} of {room.movieList.length}
            </span>
          </div>

          {/* Player 2 (Opponent) Score & Sound/Exit Controls */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-right min-w-0">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 uppercase">
                  Opponent
                </span>
                <span className="font-cinema text-lg text-white truncate max-w-[110px] sm:max-w-[160px]">
                  {opponent.name}
                </span>
              </div>
              <span className="text-[11px] font-mono-code text-[#C2B6EF]">
                {opponent.score} {opponent.score === 1 ? 'pt' : 'pts'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#C2B6EF]/20 border border-[#C2B6EF]/50 flex items-center justify-center font-cinema text-xl text-[#C2B6EF]">
              {opponent.score}
            </div>

            <button
              type="button"
              onClick={onToggleSound}
              className="w-9 h-9 rounded-xl bg-[#252524] hover:bg-[#333332] border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer ml-1"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
            </button>

            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="p-2 rounded-xl bg-[#252524] hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-white/10 transition-colors cursor-pointer"
              title="Leave / Forfeit Match"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Real-time Event Ticker / Feedback Banner */}
      {feedbackMessage ? (
        <div
          className={`w-full py-2.5 px-6 text-center text-xs font-mono-code transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-300'
              : feedbackMessage.type === 'info'
              ? 'bg-amber-950/80 border-b border-amber-500/40 text-amber-300'
              : 'bg-red-950/80 border-b border-red-500/40 text-red-300'
          }`}
        >
          {feedbackMessage.text}
        </div>
      ) : room.recentEvent ? (
        <div className="w-full py-2 px-6 text-center text-xs font-mono-code bg-[#1F1F1E] border-b border-white/[0.06] text-[#C2BCB0] flex items-center justify-center gap-2">
          <Flame className="w-3.5 h-3.5 text-[#EC5A49]" />
          <span>{room.recentEvent.message}</span>
        </div>
      ) : null}

      {/* Main Duel Content Area */}
      <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-8 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Clue Scene Display (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div className="w-full rounded-[22px] bg-[#1A1A19] border border-white/[0.08] overflow-hidden flex flex-col justify-between h-full">
            {/* Clue Header Bar */}
            <div className="px-5 h-11 flex items-center justify-between border-b border-white/[0.06] bg-[#181817]">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#EC5A49] inline-block" />
                <span className="font-mono-code text-[12px] tracking-[0.14em] text-[#E6DFD3] uppercase">
                  SCENE {String(activeSceneTab).padStart(2, '0')} / 05
                </span>
                <span className="text-xs text-[#8E8A82]">
                  ({revealedSceneCount} of 5 unlocked)
                </span>
              </div>

              {currentMovie && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-code text-[#EAF18A] px-2 py-0.5 rounded bg-white/5">
                    {currentMovie.year} &bull; {currentMovie.decade}
                  </span>
                  <span className="text-xs font-mono-code text-[#8E8A82] hidden sm:inline">
                    {currentMovie.director}
                  </span>
                </div>
              )}
            </div>

            {/* 16:9 Clue Viewport */}
            <div className="relative w-full aspect-video bg-[#0E0E0E] flex items-center justify-center overflow-hidden">
              {currentSceneUrl ? (
                <>
                  <img
                    key={`mp-scene-${currentMovieIndex}-${activeSceneTab}`}
                    src={currentSceneUrl}
                    alt={`Movie scene ${activeSceneTab}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover select-none block"
                    draggable={false}
                  />

                  <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="absolute top-3.5 right-3.5 w-9 h-9 rounded-lg bg-black/70 hover:bg-black border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </>
              ) : currentMovie ? (
                // Fallback rich clue card when TMDB screenshot is loading or offline
                <div className="p-8 text-center max-w-lg space-y-4">
                  <div className="text-5xl sm:text-6xl tracking-widest animate-pulse">
                    {currentMovie.emojiCryptogram}
                  </div>
                  {activeSceneTab === 1 && (
                    <p className="text-sm text-[#C2BCB0] italic">
                      &ldquo;{currentMovie.tagline.prompt}&rdquo;
                    </p>
                  )}
                  {activeSceneTab === 2 && (
                    <p className="text-sm text-[#EAF18A]">
                      Quote: &ldquo;{currentMovie.quote.dialogue}&rdquo;
                    </p>
                  )}
                  {activeSceneTab >= 3 && (
                    <div className="text-xs text-[#8E8A82]">
                      Directed by <strong className="text-white">{currentMovie.director}</strong> ({currentMovie.year})
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-neutral-500 font-mono-code">
                  Loading clue reel...
                </div>
              )}
            </div>

            {/* Bottom 5-Scene Selector Row */}
            <div className="px-5 py-3.5 bg-[#181817] border-t border-white/[0.06] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((step) => {
                  const isUnlocked = step <= revealedSceneCount;
                  const isActive = step === activeSceneTab;

                  return (
                    <button
                      key={step}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => {
                        if (isUnlocked) {
                          playProjectorClick();
                          setActiveSceneTab(step);
                        }
                      }}
                      className={`h-10 rounded-xl font-mono-code text-xs px-3.5 flex items-center gap-1.5 transition-all ${
                        isActive
                          ? 'bg-[#EC5A49] text-[#141413] font-bold cursor-pointer'
                          : isUnlocked
                          ? 'bg-[#252524] hover:bg-[#333332] text-white border border-white/10 cursor-pointer'
                          : 'bg-[#181817] border border-white/5 text-[#5C5852] cursor-not-allowed'
                      }`}
                    >
                      <span>Scene {step}</span>
                      {!isUnlocked && <Lock className="w-2.5 h-2.5" />}
                    </button>
                  );
                })}
              </div>

              {currentMovie && currentMovie.genres.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#8E8A82]">
                  {currentMovie.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px]"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Guess Input & Buzzer (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between">
          <div className="w-full h-full rounded-[22px] bg-[#1A1A19] border border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between">
            {/* Header */}
            <div>
              <span className="font-mono-code text-[11px] tracking-[0.16em] text-[#EC5A49] uppercase font-bold">
                FIRST BUZZ SCORES
              </span>
              <h2 className="font-cinema text-3xl sm:text-4xl text-white leading-tight mt-1">
                GUESS THE TITLE
              </h2>
              <p className="text-xs text-[#8E8A82] mt-1">
                Type the film title as fast as you can. Autocomplete suggestions will appear as you type.
              </p>
            </div>

            {/* Autocomplete Input Box */}
            <div className="relative my-4">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsOpenDropdown(true);
                  }}
                  onFocus={() => setIsOpenDropdown(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type movie title..."
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-[#121212] border border-white/15 focus:border-[#EC5A49] text-white text-sm placeholder-neutral-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Suggestions Dropdown */}
              {isOpenDropdown && filteredSuggestions.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute left-0 right-0 top-full mt-1.5 bg-[#171716] border border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5"
                >
                  {filteredSuggestions.map((item, idx) => (
                    <button
                      key={`${item.title}-${item.year}`}
                      type="button"
                      onClick={() => handleGuessSubmit(item.title)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        idx === highlightedIndex
                          ? 'bg-[#272726] text-white'
                          : 'text-[#C2BCB0] hover:bg-[#20201F]'
                      }`}
                    >
                      <span className="font-medium text-white truncate">
                        {item.title}
                      </span>
                      {item.year > 0 && (
                        <span className="font-mono-code text-[11px] text-[#8E8A82] ml-2 shrink-0">
                          {item.year}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Submit Guess Button */}
              <button
                type="button"
                disabled={!searchTerm.trim() || isSubmitting}
                onClick={() => handleGuessSubmit()}
                className={`w-full h-12 rounded-xl mt-3 flex items-center justify-center gap-2 font-cinema text-xl uppercase tracking-wider transition-all cursor-pointer ${
                  searchTerm.trim() && !isSubmitting
                    ? 'bg-[#EC5A49] hover:bg-[#F26655] text-[#141413] shadow-[0_3px_0_0_#873329] active:translate-y-[2px]'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Verifying...' : 'Submit Answer'}</span>
              </button>
            </div>

            {/* Solved Movies Mini-History */}
            <div className="pt-4 border-t border-white/[0.08]">
              <span className="font-mono-code text-[10px] uppercase tracking-wider text-[#8E8A82] block mb-2">
                MATCH SOLVE LOG ({room.solvedHistory.length})
              </span>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {room.solvedHistory.length === 0 ? (
                  <p className="text-xs text-[#5C5852] italic">
                    No films solved yet. First to answer gets the point!
                  </p>
                ) : (
                  room.solvedHistory.slice().reverse().map((rec, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1.5 rounded-lg bg-[#141414] border border-white/5 flex items-center justify-between text-xs"
                    >
                      <span className="text-white font-medium truncate max-w-[170px]">
                        {rec.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono-code font-bold ${
                          rec.solvedByPlayerId === myPlayerId
                            ? 'text-[#EC5A49]'
                            : 'text-[#C2B6EF]'
                        }`}
                      >
                        {rec.solvedByPlayerId === myPlayerId ? '+1 You' : '+1 Opponent'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Leave Confirmation Dialog */}
      {confirmLeave && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1B] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-cinema text-2xl text-white">FORFEIT MATCH?</h3>
            <p className="text-xs text-[#9A948A] mt-2">
              If you leave now, the match will end and your opponent will be awarded victory by forfeit.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="py-2.5 rounded-xl bg-[#282827] text-white hover:bg-[#333332] text-xs font-mono-code uppercase cursor-pointer"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={handleForfeitAndExit}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono-code uppercase font-bold cursor-pointer"
              >
                Forfeit &amp; Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Clue Lightbox Modal */}
      {isExpanded && currentSceneUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative max-w-6xl w-full aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentSceneUrl}
              alt="Scene expanded"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/80 hover:bg-black border border-white/15 text-white flex items-center justify-center cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
