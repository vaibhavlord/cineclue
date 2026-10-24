import React, { useState, useRef, useEffect } from 'react';
import { POPULAR_TITLES_CATALOG } from '../data/movies';
import { GuessRecord, Movie } from '../types/movie';
import { Search, Check, X, Flag } from 'lucide-react';
import { playProjectorClick, playClueRevealSound } from '../utils/audio';

interface GuessInputProps {
  movie: Movie;
  guesses: GuessRecord[];
  maxGuesses: number;
  onMakeGuess: (title: string) => void;
  onGiveUp: () => void;
  isGameOver: boolean;
  unlockedLetters: Set<string>;
  revealedTiers: number;
  onRevealNextTier: () => void;
  onUnlockLetter: () => void;
  availableLetterCount: number;
}

export const GuessInput: React.FC<GuessInputProps> = ({
  movie,
  guesses,
  maxGuesses,
  onMakeGuess,
  onGiveUp,
  isGameOver,
  unlockedLetters,
  revealedTiers,
  onRevealNextTier,
  onUnlockLetter,
  availableLetterCount,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [tmdbSuggestions, setTmdbSuggestions] = useState<
    Array<{ title: string; year: number; genres: string[] }>
  >([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setTmdbSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/tmdb/search?q=${encodeURIComponent(searchTerm.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results)) {
            const mapped = data.results.map((m: any) => ({
              title: m.title,
              year: m.year,
              genres: [],
            }));
            setTmdbSuggestions(mapped);
          }
        }
      } catch {
        // Fallback silently to offline catalog
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredSuggestions = React.useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    const query = searchTerm.toLowerCase().trim();
    const local = POPULAR_TITLES_CATALOG.filter((item) =>
      item.title.toLowerCase().includes(query)
    );

    const combined = [...local];
    for (const t of tmdbSuggestions) {
      if (
        !combined.some(
          (item) => item.title.toLowerCase() === t.title.toLowerCase()
        )
      ) {
        combined.push(t);
      }
    }
    return combined.slice(0, 7);
  }, [searchTerm, tmdbSuggestions]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredSuggestions]);

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

  const handleSubmit = (titleToSubmit?: string) => {
    const finalTitle = titleToSubmit || searchTerm;
    if (!finalTitle.trim() || isGameOver) return;
    playProjectorClick();
    onMakeGuess(finalTitle.trim());
    setSearchTerm('');
    setIsOpenDropdown(false);
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
      e.stopPropagation();
      if (isOpenDropdown && filteredSuggestions[highlightedIndex]) {
        handleSubmit(filteredSuggestions[highlightedIndex].title);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      setIsOpenDropdown(false);
    }
  };

  const hasTypedGuess = Boolean(searchTerm.trim()) && !isGameOver;

  // Render character slots for movie.title
  const titleCharacters = movie.title.split('');

  return (
    <div className="w-full h-full rounded-[20px] bg-[#1A1A19] border border-white/[0.08] p-6 sm:p-7 flex flex-col select-none">
      {/* Kicker & Title */}
      <div>
        <div className="font-mono-code text-[11px] tracking-[0.16em] text-[#EC5A49] uppercase font-medium">
          SEEN IT? PROVE IT.
        </div>

        <h2 className="font-cinema text-[42px] sm:text-[46px] text-[#FDF5E1] leading-[0.95] tracking-[0.02em] uppercase mt-2">
          NAME THAT FILM.
        </h2>

        <p className="text-[14px] text-[#9A948A] mt-2">
          One title. Five chances. Make them count.
        </p>
      </div>

      {/* Movie Title Letter Blanks Row */}
      <div
        className="mt-6 mb-3 flex flex-wrap items-end gap-x-2 gap-y-2.5 min-h-[24px]"
        aria-label="Movie title letter blanks"
      >
        {titleCharacters.map((char, idx) => {
          const upper = char.toUpperCase();
          if (char === ' ') {
            return <span key={idx} className="inline-block w-3" />;
          }
          const isAlphaNum = /[A-Z0-9]/.test(upper);
          if (!isAlphaNum) {
            return (
              <span
                key={idx}
                className="font-mono-code text-xs text-[#8E8A82] leading-none pb-0.5"
              >
                {char}
              </span>
            );
          }
          const isRevealed = isGameOver || unlockedLetters.has(upper);
          return isRevealed ? (
            <span
              key={idx}
              className="font-mono-code text-[13px] font-bold text-[#FDF5E1] border-b-2 border-[#EC5A49] min-w-[11px] text-center leading-none pb-0.5"
            >
              {upper}
            </span>
          ) : (
            <span
              key={idx}
              className="inline-block w-[11px] h-[2px] bg-[#9A948A] rounded-full"
            />
          );
        })}
      </div>

      {/* 5 Guesses Progress Bars & Counter Row */}
      <div className="flex items-center justify-between mt-1.5 mb-5">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: maxGuesses }).map((_, idx) => {
            const isUsed = idx < guesses.length;
            return (
              <span
                key={idx}
                className={`w-6 h-1 rounded-full transition-colors ${
                  isUsed ? 'bg-[#EC5A49]' : 'bg-[#4A4843]'
                }`}
              />
            );
          })}
        </div>

        <div className="font-mono-code text-[11px] tracking-[0.12em] text-[#8E8A82] uppercase tabular-nums">
          {guesses.length} / {maxGuesses} GUESSES
        </div>
      </div>

      {/* Search Input & GUESS Button Row */}
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-[#8E8A82]" />
            </div>
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
              placeholder="Guess the movie..."
              className="w-full h-[50px] pl-10 pr-3.5 rounded-xl bg-[#141413] border border-white/[0.08] focus:border-[#EC5A49]/70 text-[14px] text-[#FDF5E1] placeholder-[#7A756E] focus:outline-none transition-colors"
              aria-label="Guess movie title"
              disabled={isGameOver}
            />
          </div>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!hasTypedGuess}
            className={`h-[50px] px-5 rounded-xl flex items-center justify-center gap-2 transition-all shrink-0 ${
              hasTypedGuess
                ? 'bg-[#EC5A49] hover:bg-[#F26655] text-[#141413] cursor-pointer'
                : 'bg-[#30302E] text-[#7A756E] cursor-not-allowed'
            }`}
            aria-label="Submit movie guess"
          >
            <span className="font-cinema text-[22px] tracking-[0.04em] leading-none">
              GUESS
            </span>
            <svg
              viewBox="0 0 14 14"
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
            >
              <path
                d="M11 3V7.5C11 8.32843 10.3284 9 9.5 9H3M3 9L5.5 6.5M3 9L5.5 11.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {isOpenDropdown && filteredSuggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full mt-1.5 bg-[#161615] border border-white/[0.12] rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/[0.06]"
          >
            {filteredSuggestions.map((item, idx) => (
              <button
                type="button"
                key={`${item.title}-${item.year}`}
                onClick={() => handleSubmit(item.title)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm transition-colors cursor-pointer ${
                  idx === highlightedIndex
                    ? 'bg-[#262523] text-[#FDF5E1]'
                    : 'text-[#C2BCB0] hover:bg-[#20201E]'
                }`}
                aria-label={`Select ${item.title} (${item.year})`}
              >
                <span className="font-medium text-[#FDF5E1] truncate">
                  {item.title}
                </span>
                {item.year > 0 && (
                  <span className="font-mono-code text-xs text-[#8E8A82] tabular-nums ml-3 shrink-0">
                    {item.year}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Helper Caption below Input */}
      <div className="text-[12px] text-[#7A756E] text-center mt-3.5">
        Enter a movie title to make your guess.
      </div>

      {/* Previous Guesses History (if any) */}
      {guesses.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {guesses.map((guess, idx) => (
            <div
              key={idx}
              className="px-3.5 py-2 rounded-xl bg-[#141413] border border-white/[0.07] flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {guess.isCorrect ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-[#EC5A49] shrink-0" />
                )}
                <span className="font-medium text-[#FDF5E1] truncate">
                  {guess.title}
                </span>
                {guess.year > 0 && (
                  <span className="text-[#7A756E] tabular-nums shrink-0">
                    ({guess.year})
                  </span>
                )}
              </div>

              {!guess.isCorrect && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#8E8A82] shrink-0">
                  {guess.year > 0 && (
                    <span>
                      {guess.yearRelation === 'earlier'
                        ? 'Newer ↑'
                        : guess.yearRelation === 'later'
                        ? 'Older ↓'
                        : 'Exact Year'}
                    </span>
                  )}
                  {guess.genreMatches.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[110px]">
                        {guess.genreMatches.join(', ')}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-white/[0.07] my-5" />

      {/* Need a Clue Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono-code text-[11px] tracking-[0.14em] text-[#9A948A] uppercase">
            NEED A CLUE?
          </span>
          <span className="text-[12px] text-[#7A756E]">
            A little help. A few points.
          </span>
        </div>

        {/* Clue Button 1: Letters (-50 pts) */}
        <button
          type="button"
          onClick={onUnlockLetter}
          disabled={isGameOver || availableLetterCount === 0}
          aria-label="Unlock 1 letter in movie title"
          className="w-full h-[54px] rounded-xl bg-[#161615] hover:bg-[#1F1F1D] border border-white/[0.1] px-4 flex items-center justify-between transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <div className="flex items-center">
            <span className="font-sans text-[13px] font-bold text-[#9A948A]">
              Aa
            </span>
            <span className="text-[15px] font-semibold text-[#FDF5E1] ml-3">
              Letters
            </span>
          </div>

          <span className="font-mono-code text-[12px] text-[#9A948A]">
            -50 pts
          </span>
        </button>

        {/* Clue Button 2: Next Scene (-200 pts ->) */}
        {revealedTiers < 5 ? (
          <button
            type="button"
            onClick={() => {
              playClueRevealSound();
              onRevealNextTier();
            }}
            disabled={isGameOver}
            aria-label={`Reveal next screenshot: Scene ${revealedTiers + 1}`}
            className="w-full h-[54px] rounded-xl bg-[#2B1B18] hover:bg-[#35211D] border border-[#EC5A49]/85 px-4 flex items-center justify-between mt-3 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <div className="flex items-center">
              <svg
                viewBox="0 0 18 18"
                className="w-4 h-4 text-[#EC5A49] shrink-0"
                fill="none"
              >
                <rect
                  x="2"
                  y="2.5"
                  width="14"
                  height="13"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M5.5 2.5V15.5M12.5 2.5V15.5M2 6.5H5.5M12.5 6.5H16M2 11.5H5.5M12.5 11.5H16"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[15px] font-semibold text-[#EC5A49] ml-3">
                Next Scene
              </span>
            </div>

            <span className="font-mono-code text-[12px] text-[#EC5A49] flex items-center gap-2">
              <span>-200 pts</span>
              <span>&rarr;</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onGiveUp}
            disabled={isGameOver}
            aria-label="Reveal movie name after all 5 scenes"
            className="w-full h-[54px] rounded-xl bg-[#2B1B18] hover:bg-[#35211D] border border-[#EC5A49]/85 px-4 flex items-center justify-between mt-3 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <div className="flex items-center">
              <svg
                viewBox="0 0 18 18"
                className="w-4 h-4 text-[#EC5A49] shrink-0"
                fill="none"
              >
                <rect
                  x="2"
                  y="2.5"
                  width="14"
                  height="13"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M5.5 2.5V15.5M12.5 2.5V15.5M2 6.5H5.5M12.5 6.5H16M2 11.5H5.5M12.5 11.5H16"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[15px] font-semibold text-[#EC5A49] ml-3">
                Reveal Answer
              </span>
            </div>

            <span className="font-mono-code text-[12px] text-[#EC5A49] flex items-center gap-2">
              <span>All 5 Scenes</span>
              <span>&rarr;</span>
            </span>
          </button>
        )}
      </div>

      {/* Bottom Give Up Row */}
      <div className="mt-5 pt-1 flex items-center justify-between">
        <span className="text-[13px] text-[#6E6A63]">Not your scene?</span>

        <button
          type="button"
          onClick={onGiveUp}
          disabled={isGameOver}
          className="text-[13px] font-medium text-[#9A948A] hover:text-[#EC5A49] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          aria-label="Give up and reveal movie"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Give Up</span>
        </button>
      </div>
    </div>
  );
};
