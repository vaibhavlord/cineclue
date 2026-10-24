import React, { useEffect, useState } from 'react';
import { GameMode, MovieFilters } from '../types/movie';
import {
  SlidersHorizontal,
  BarChart2,
  HelpCircle,
  Volume2,
  VolumeX,
  Check,
  Zap,
  Flame,
  Users,
  Trophy,
} from 'lucide-react';
import { playProjectorClick } from '../utils/audio';
import { isFilterActive } from '../data/filterOptions';

interface TitleScreenProps {
  onStartGame: (mode: GameMode) => void;
  onOpenMultiplayer: () => void;
  onOpenStats: () => void;
  onOpenHowToPlay: () => void;
  onOpenTmdb: () => void;
  onOpenFilters: () => void;
  currentFilters: MovieFilters;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isModalOpen?: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenMultiplayer,
  onOpenStats,
  onOpenHowToPlay,
  onOpenFilters,
  currentFilters,
  soundEnabled,
  onToggleSound,
  isModalOpen = false,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode | 'multiplayer'>('campaign');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isModalOpen) {
        if (selectedMode === 'multiplayer') {
          onOpenMultiplayer();
        } else {
          onStartGame(selectedMode);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartGame, onOpenMultiplayer, selectedMode, isModalOpen]);

  const isDirectorCut = selectedMode === 'campaign';
  const isFastFurious = selectedMode === 'speedrun';
  const isMultiplayer = selectedMode === 'multiplayer';
  const hasActiveFilters = isFilterActive(currentFilters);

  return (
    <div className="min-h-screen w-full bg-[#141413] text-[#FDF5E1] flex flex-col justify-between select-none">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-white/[0.08]">
        <div className="max-w-[1380px] mx-auto px-6 sm:px-10 h-[72px] flex items-center justify-between">
          {/* Brand & Tagline */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              {/* Custom Clapperboard Brand Icon */}
              <svg
                viewBox="0 0 28 28"
                className="w-6 h-6 text-[#EC5A49] shrink-0"
                fill="none"
              >
                <rect
                  x="3"
                  y="12"
                  width="22"
                  height="13"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <g transform="rotate(-12 3 11)">
                  <rect
                    x="3"
                    y="6"
                    width="22"
                    height="5"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 6L6.5 11M15 6L13.5 11M22 6L20.5 11"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>
              </svg>
              <span className="font-cinema text-[28px] tracking-[0.03em] text-[#EC5A49] leading-none">
                CINECLUE
              </span>
            </div>

            <span className="hidden md:inline-block font-mono-code text-[11px] tracking-[0.18em] text-[#8E8A82] uppercase">
              WATCHED IT? PROVE IT.
            </span>
          </div>

          {/* Right Navigation Controls */}
          <nav className="flex items-center gap-4 sm:gap-6 text-[15px] font-medium text-[#FDF5E1]">
            <button
              type="button"
              onClick={onOpenMultiplayer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EC5A49]/15 border border-[#EC5A49]/35 text-[#EC5A49] hover:bg-[#EC5A49]/25 transition-colors cursor-pointer text-xs sm:text-[14px] font-semibold whitespace-nowrap"
              aria-label="1v1 Online Multiplayer"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>1v1 Duel</span>
            </button>

            <button
              type="button"
              onClick={onOpenFilters}
              className="flex items-center gap-2 hover:text-[#EC5A49] transition-colors cursor-pointer whitespace-nowrap"
              aria-label="Cinema Filters"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#C9C3B8]" />
              <span>Filters{hasActiveFilters ? ' •' : ''}</span>
            </button>

            <button
              type="button"
              onClick={onOpenStats}
              className="flex items-center gap-2 hover:text-[#EC5A49] transition-colors cursor-pointer whitespace-nowrap"
              aria-label="View career game statistics"
            >
              <BarChart2 className="w-4 h-4 text-[#C9C3B8]" />
              <span>Stats</span>
            </button>

            <button
              type="button"
              onClick={onOpenHowToPlay}
              className="flex items-center gap-2 hover:text-[#EC5A49] transition-colors cursor-pointer whitespace-nowrap"
              aria-label="How to play guide"
            >
              <HelpCircle className="w-4 h-4 text-[#C9C3B8]" />
              <span>Rules</span>
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              className="w-11 h-10 rounded-xl bg-[#1A1A19] border border-white/[0.1] hover:border-white/25 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-[#FDF5E1]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EAF18A]" />
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-[#EC5A49]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EC5A49]" />
                </>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-6 sm:px-10 py-6 sm:py-8 flex flex-col justify-between">
        {/* Hero Split Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 items-center gap-6 lg:gap-4 my-auto">
          {/* Left Hero Column */}
          <div className="lg:col-span-7 flex flex-col items-start">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#EC5A49] inline-block" />
              <span className="font-mono-code text-xs tracking-[0.2em] text-[#D7D0C3] uppercase font-medium">
                THE FILM TRIVIA GAME
              </span>
            </div>

            <h1 className="font-cinema uppercase text-[68px] sm:text-[96px] xl:text-[108px] leading-[0.94] tracking-[0.015em] select-none">
              <span className="block text-[#FDF5E1]">SEEN IT?</span>
              <span className="block text-[#EC5A49] mt-1">PROVE IT.</span>
            </h1>

            <p className="mt-5 text-[#C2BCB0] text-base sm:text-[19px] font-normal">
              A few frames. One film. Time to put your movie brain to work.
            </p>
          </div>

          {/* Right Hero Column: Popcorn Mascot & Badge */}
          <div className="lg:col-span-5 flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-[430px]">
              <img
                src="/assets/popcorn-mascot.png"
                alt="CineClue Popcorn Mascot wearing 3D glasses with Movie Night ticket and film strip"
                className="w-full h-auto object-contain block"
              />
            </div>
          </div>
        </section>

        {/* Bottom Feature Selector & CTA Block */}
        <section className="mt-6 sm:mt-8">
          {/* Section Header Row */}
          <div className="flex items-center justify-between mb-3.5">
            <span className="font-mono-code text-xs sm:text-[13px] font-semibold tracking-[0.16em] text-[#FDF5E1] uppercase">
              CHOOSE YOUR FEATURE
            </span>
            <span className="text-xs sm:text-[14px] text-[#9A948A]">
              Solo speedruns or live head-to-head battles.
            </span>
          </div>

          {/* Mode Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Card 1: Director's Cut */}
            <button
              type="button"
              onClick={() => {
                playProjectorClick();
                setSelectedMode('campaign');
              }}
              aria-label="Director's Cut Campaign Mode"
              className={`group relative rounded-[20px] p-6 sm:p-7 text-left transition-all cursor-pointer overflow-hidden flex flex-col justify-between min-h-[245px] ${
                isDirectorCut
                  ? 'bg-gradient-to-br from-[#33201C] via-[#2C1C19] to-[#231715] border-2 border-[#EC5A49] shadow-[0_5px_0_0_#823328]'
                  : 'bg-[#20201F] hover:bg-[#262625] border border-white/[0.1] shadow-[0_4px_0_0_#0D0D0C]'
              }`}
            >
              {/* Top Row: Kicker & Radio Indicator */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {/* Mini film strip icon */}
                  <svg
                    viewBox="0 0 16 16"
                    className="w-3.5 h-3.5 text-[#EC5A49] shrink-0"
                    fill="currentColor"
                  >
                    <path d="M2 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H2zm1 2h2v2H3V4zm0 3h2v2H3V7zm0 3h2v2H3v-2zm8-6h2v2h-2V4zm0 3h2v2h-2V7zm0 3h2v2h-2v-2z" />
                  </svg>
                  <span className="font-mono-code text-[11px] font-semibold tracking-[0.14em] text-[#EC5A49] uppercase">
                    THE ORIGINAL
                  </span>
                </div>

                {isDirectorCut ? (
                  <span className="w-6 h-6 rounded-full bg-[#EC5A49] text-[#141413] flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border border-white/25 shrink-0" />
                )}
              </div>

              {/* Card Body Content */}
              <div className="relative z-10 pr-28 sm:pr-32 my-2">
                <h2 className="font-cinema text-[36px] sm:text-[42px] text-[#FDF5E1] leading-none tracking-[0.02em]">
                  Director&apos;s Cut
                </h2>
                <p className="font-mono-code text-[14px] text-[#EC5A49] mt-2 font-medium">
                  5 Scenes &middot; 5 Guesses
                </p>
                <p className="text-[14px] sm:text-[15px] text-[#B8B1A6] leading-relaxed mt-2.5 max-w-[330px]">
                  The slow burn. Study the scenes and name that film. No clock,
                  just instinct.
                </p>
              </div>

              {/* Bottom Status Line */}
              <div className="h-5 flex items-center">
                {isDirectorCut ? (
                  <div className="flex items-center gap-1.5 font-mono-code text-[10px] font-semibold tracking-[0.16em] text-[#EC5A49] uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EC5A49]" />
                    <span>READY TO ROLL</span>
                  </div>
                ) : (
                  <span className="font-mono-code text-[10px] tracking-[0.16em] text-[#6E6A63] uppercase">
                    CLICK TO SELECT
                  </span>
                )}
              </div>

              {/* Right Medallion: Clapperboard Circle + Sparkle */}
              <div className="pointer-events-none absolute right-6 bottom-6 flex flex-col items-end">
                {/* 4-point Lime Sparkle */}
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-[#EAF18A] -mb-1 mr-1"
                  fill="none"
                >
                  <path
                    d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>

                <div className="w-[116px] h-[116px] rounded-full bg-[#532B22]/90 flex items-center justify-center">
                  {/* Tilted Hinged Clapperboard Vector */}
                  <svg
                    viewBox="0 0 64 64"
                    className="w-16 h-16 text-[#EC5A49]"
                    fill="none"
                  >
                    <g transform="rotate(-10 32 36)">
                      <rect
                        x="13"
                        y="29"
                        width="38"
                        height="23"
                        rx="4"
                        stroke="currentColor"
                        strokeWidth="2.4"
                      />
                      <g transform="rotate(-18 13 27)">
                        <rect
                          x="13"
                          y="19"
                          width="38"
                          height="8"
                          rx="2.5"
                          stroke="currentColor"
                          strokeWidth="2.4"
                        />
                        <path
                          d="M22 19L19 27M34 19L31 27M46 19L43 27"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        />
                      </g>
                    </g>
                  </svg>
                </div>
              </div>
            </button>

            {/* Card 2: Fast & Furious */}
            <button
              type="button"
              onClick={() => {
                playProjectorClick();
                setSelectedMode('speedrun');
              }}
              aria-label="Fast & Furious 15s Blitz Mode"
              className={`group relative rounded-[20px] p-6 sm:p-7 text-left transition-all cursor-pointer overflow-hidden flex flex-col justify-between min-h-[245px] ${
                isFastFurious
                  ? 'bg-gradient-to-br from-[#282438] via-[#221F30] to-[#1B1924] border-2 border-[#C2B6EF] shadow-[0_5px_0_0_#594F82]'
                  : 'bg-[#20201F] hover:bg-[#262625] border border-white/[0.1] shadow-[0_4px_0_0_#0D0D0C]'
              }`}
            >
              {/* Top Row: Kicker & Radio Indicator */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#C2B6EF] fill-[#C2B6EF] shrink-0" />
                  <span className="font-mono-code text-[11px] font-semibold tracking-[0.14em] text-[#C2B6EF] uppercase">
                    AGAINST THE CLOCK
                  </span>
                </div>

                {isFastFurious ? (
                  <span className="w-6 h-6 rounded-full bg-[#C2B6EF] text-[#141413] flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border border-white/25 shrink-0" />
                )}
              </div>

              {/* Card Body Content */}
              <div className="relative z-10 pr-28 sm:pr-32 my-2">
                <h2 className="font-cinema text-[36px] sm:text-[42px] text-[#FDF5E1] leading-none tracking-[0.02em]">
                  Fast &amp; Furious
                </h2>
                <p className="font-mono-code text-[14px] text-[#C2B6EF] mt-2 font-medium">
                  15s Timer
                </p>
                <p className="text-[14px] sm:text-[15px] text-[#B8B1A6] leading-relaxed mt-2.5 max-w-[330px]">
                  The adrenaline cut. Beat the clock before your movie brain
                  goes blank.
                </p>
              </div>

              {/* Bottom Status Line */}
              <div className="h-5 flex items-center">
                {isFastFurious && (
                  <div className="flex items-center gap-1.5 font-mono-code text-[10px] font-semibold tracking-[0.16em] text-[#C2B6EF] uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C2B6EF]" />
                    <span>READY TO ROLL</span>
                  </div>
                )}
              </div>

              {/* Right Medallion: Stopwatch Circle + Sparkle */}
              <div className="pointer-events-none absolute right-6 bottom-6 flex flex-col items-end">
                {/* 4-point Lavender Sparkle */}
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-[#C2B6EF] -mb-1 mr-0"
                  fill="none"
                >
                  <path
                    d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>

                <div className="w-[116px] h-[116px] rounded-full bg-[#33303E] flex items-center justify-center">
                  {/* Minimal Stopwatch Vector */}
                  <svg
                    viewBox="0 0 64 64"
                    className="w-16 h-16 text-[#C2B6EF]"
                    fill="none"
                  >
                    <path
                      d="M25 12L39 14"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="32"
                      cy="36"
                      r="17"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M32 36L40 31"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </button>

            {/* Card 3: 1v1 Online Duel */}
            <button
              type="button"
              onClick={() => {
                playProjectorClick();
                setSelectedMode('multiplayer');
              }}
              aria-label="1v1 Online Multiplayer Mode"
              className={`group relative rounded-[20px] p-6 sm:p-7 text-left transition-all cursor-pointer overflow-hidden flex flex-col justify-between min-h-[245px] ${
                isMultiplayer
                  ? 'bg-gradient-to-br from-[#382618] via-[#2D1F14] to-[#22170F] border-2 border-[#EAF18A] shadow-[0_5px_0_0_#757A33]'
                  : 'bg-[#20201F] hover:bg-[#262625] border border-white/[0.1] shadow-[0_4px_0_0_#0D0D0C]'
              }`}
            >
              {/* Top Row: Kicker & Radio Indicator */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#EAF18A] fill-[#EAF18A] shrink-0" />
                  <span className="font-mono-code text-[11px] font-semibold tracking-[0.14em] text-[#EAF18A] uppercase">
                    LIVE MULTIPLAYER
                  </span>
                </div>

                {isMultiplayer ? (
                  <span className="w-6 h-6 rounded-full bg-[#EAF18A] text-[#141413] flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border border-white/25 shrink-0" />
                )}
              </div>

              {/* Card Body Content */}
              <div className="relative z-10 pr-28 sm:pr-32 my-2">
                <h2 className="font-cinema text-[36px] sm:text-[42px] text-[#FDF5E1] leading-none tracking-[0.02em]">
                  1v1 Online Duel
                </h2>
                <p className="font-mono-code text-[14px] text-[#EAF18A] mt-2 font-medium">
                  60s Speed Duel &bull; Live Code
                </p>
                <p className="text-[14px] sm:text-[15px] text-[#B8B1A6] leading-relaxed mt-2.5 max-w-[330px]">
                  Real-time head-to-head. Same movie, same clues. First buzzer to submit wins the point.
                </p>
              </div>

              {/* Bottom Status Line */}
              <div className="h-5 flex items-center">
                {isMultiplayer && (
                  <div className="flex items-center gap-1.5 font-mono-code text-[10px] font-semibold tracking-[0.16em] text-[#EAF18A] uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EAF18A]" />
                    <span>READY TO ROLL</span>
                  </div>
                )}
              </div>

              {/* Right Medallion: Trophy Circle */}
              <div className="pointer-events-none absolute right-6 bottom-6 flex flex-col items-end">
                <div className="w-[116px] h-[116px] rounded-full bg-[#42391F] flex items-center justify-center">
                  <Trophy className="w-14 h-14 text-[#EAF18A]" />
                </div>
              </div>
            </button>
          </div>

          {/* Primary Play Action & Secondary Filters Button Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mt-5">
            <button
              type="button"
              data-start="true"
              onClick={() => {
                if (isMultiplayer) {
                  onOpenMultiplayer();
                } else {
                  onStartGame(selectedMode as GameMode);
                }
              }}
              aria-label="Start Game"
              className="sm:col-span-9 h-[66px] rounded-[16px] bg-[#EC5A49] hover:bg-[#F26655] active:translate-y-[2px] text-[#141413] shadow-[0_5px_0_0_#873329] flex items-center justify-center gap-3 transition-all cursor-pointer px-6"
            >
              {/* Outline Play Triangle */}
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-[#141413] shrink-0"
                fill="none"
              >
                <path
                  d="M6 4.5L19 12L6 19.5V4.5Z"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-cinema text-[32px] tracking-[0.03em] leading-none text-[#141413]">
                PLAY
              </span>
              <span className="text-[16px] font-semibold text-[#141413] tracking-[-0.01em]">
                &mdash; {isDirectorCut ? "Director's Cut" : isFastFurious ? 'Fast & Furious' : '1v1 Online Duel'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenFilters}
              className={`sm:col-span-3 h-[66px] rounded-[16px] border flex items-center justify-center gap-2.5 text-[16px] font-semibold transition-all cursor-pointer ${
                hasActiveFilters
                  ? 'bg-[#2B201E] border-[#EC5A49] text-[#FDF5E1] shadow-[0_4px_0_0_#823328]'
                  : 'bg-[#20201F] hover:bg-[#282827] border-white/[0.1] text-[#FDF5E1] shadow-[0_4px_0_0_#0D0D0C]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-[#FDF5E1]" />
              <span>Filters{hasActiveFilters ? ' •' : ''}</span>
            </button>
          </div>

          {/* Bottom Micro Footer Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-5 pt-1 text-xs">
            <span className="font-mono-code text-[11px] tracking-[0.16em] text-[#8E8A82] uppercase">
              ALL GENRES. ALL ERAS. ALL YOU.
            </span>

            <div className="flex items-center gap-2 text-[#8E8A82] text-[12px]">
              <span>Ready when you are.</span>
              <kbd className="px-2 py-0.5 rounded bg-[#1C1C1B] border border-white/[0.12] font-mono-code text-[10px] tracking-[0.08em] text-[#C9C3B8] inline-flex items-center gap-1">
                <span>ENTER</span>
                <svg
                  viewBox="0 0 12 12"
                  className="w-2.5 h-2.5 text-[#C9C3B8]"
                  fill="none"
                >
                  <path
                    d="M9.5 2.5V6.5C9.5 7.05228 9.05228 7.5 8.5 7.5H2.5M2.5 7.5L5 5M2.5 7.5L5 10"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </kbd>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
