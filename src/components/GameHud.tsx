import React from 'react';
import { GameMode, MovieFilters } from '../types/movie';
import {
  SlidersHorizontal,
  BarChart2,
  HelpCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { isFilterActive } from '../data/filterOptions';

interface GameHudProps {
  score: number;
  scoreYield: number;
  streak: number;
  mode: GameMode;
  currentRound: number;
  totalRounds: number;
  timeRemaining?: number;
  soundEnabled: boolean;
  filters?: MovieFilters;
  onOpenFilters?: () => void;
  onOpenStats?: () => void;
  onOpenHowToPlay?: () => void;
  onToggleSound: () => void;
  onPause: () => void;
  onRestart: () => void;
  onQuitToTitle?: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  score,
  scoreYield,
  mode,
  currentRound,
  timeRemaining,
  soundEnabled,
  filters,
  onOpenFilters,
  onOpenStats,
  onOpenHowToPlay,
  onToggleSound,
  onQuitToTitle,
}) => {
  const hasActiveFilters = filters ? isFilterActive(filters) : false;
  const modeTitle = mode === 'speedrun' ? 'Fast & Furious' : "Director's Cut";

  return (
    <div className="w-full select-none">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-white/[0.08] bg-[#141413]">
        <div className="max-w-[1380px] mx-auto px-6 sm:px-10 h-[72px] flex items-center justify-between">
          {/* Left: Brand & Tagline */}
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onQuitToTitle}
              className="flex items-center gap-2.5 cursor-pointer group"
              aria-label="Return to CineClue Home"
            >
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
              <span className="font-cinema text-[28px] tracking-[0.03em] text-[#EC5A49] leading-none group-hover:opacity-90 transition-opacity">
                CINECLUE
              </span>
            </button>

            <span className="hidden md:inline-block font-mono-code text-[11px] tracking-[0.18em] text-[#8E8A82] uppercase">
              WATCHED IT? PROVE IT.
            </span>
          </div>

          {/* Right: Navigation Controls */}
          <nav className="flex items-center gap-5 sm:gap-7 text-[15px] font-medium text-[#FDF5E1]">
            {onOpenFilters && (
              <button
                type="button"
                onClick={onOpenFilters}
                className="flex items-center gap-2 hover:text-[#EC5A49] transition-colors cursor-pointer whitespace-nowrap"
                aria-label="Cinema filters"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#C9C3B8]" />
                <span>Filters{hasActiveFilters ? ' •' : ''}</span>
              </button>
            )}

            {onOpenStats && (
              <button
                type="button"
                onClick={onOpenStats}
                className="flex items-center gap-2 hover:text-[#EC5A49] transition-colors cursor-pointer whitespace-nowrap"
                aria-label="View career game statistics"
              >
                <BarChart2 className="w-4 h-4 text-[#C9C3B8]" />
                <span>Stats</span>
              </button>
            )}

            {onOpenHowToPlay && (
              <button
                type="button"
                onClick={onOpenHowToPlay}
                className="flex items-center gap-2 hover:text-[#EC5A49] transition-colors cursor-pointer whitespace-nowrap"
                aria-label="How to play guide"
              >
                <HelpCircle className="w-4 h-4 text-[#C9C3B8]" />
                <span>Rules</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleSound}
              className="w-11 h-10 rounded-xl bg-[#1A1A19] border border-white/[0.1] hover:border-white/25 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
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

      {/* Sub-Header Row: Mode Title & Score HUD */}
      <div className="max-w-[1380px] mx-auto w-full px-6 sm:px-10 pt-7 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        {/* Left: Now Guessing Kicker + Mode Heading */}
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EC5A49] inline-block" />
            <span className="font-mono-code text-[11px] tracking-[0.16em] text-[#EC5A49] uppercase font-medium">
              NOW GUESSING / #{currentRound}
            </span>
          </div>
          <h1 className="font-cinema text-[44px] sm:text-[54px] text-[#FDF5E1] leading-none tracking-[0.015em] mt-1.5">
            {modeTitle}
          </h1>
        </div>

        {/* Right: Timer (Speedrun), Total Score, and Playing For Pill */}
        <div className="flex items-center gap-6 sm:gap-7">
          {mode === 'speedrun' && timeRemaining !== undefined && (
            <div className="text-right">
              <div className="font-mono-code text-[10px] tracking-[0.16em] text-[#EC5A49] uppercase">
                TIME LEFT
              </div>
              <div
                className={`font-cinema text-[34px] leading-none mt-1 tabular-nums ${
                  timeRemaining <= 5 ? 'text-[#EC5A49]' : 'text-[#FDF5E1]'
                }`}
              >
                {timeRemaining}s
              </div>
            </div>
          )}

          <div className="text-right">
            <div className="font-mono-code text-[10px] tracking-[0.16em] text-[#8E8A82] uppercase">
              TOTAL SCORE
            </div>
            <div className="font-cinema text-[34px] text-[#FDF5E1] leading-none mt-1 tabular-nums">
              {score.toLocaleString()}
            </div>
          </div>

          {/* Playing For Pill Card */}
          <div className="rounded-2xl bg-[#241715] border border-[#EC5A49]/85 px-5 py-3 flex items-center gap-3.5 min-w-[190px]">
            {/* 4-point Sparkle with mini plus */}
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 text-[#EC5A49] shrink-0"
              fill="none"
            >
              <path
                d="M11 3L12.8 9.2L19 11L12.8 12.8L11 19L9.2 12.8L3 11L9.2 9.2L11 3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M19 3V7M17 5H21"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>

            <div>
              <div className="font-mono-code text-[10px] tracking-[0.16em] text-[#EC5A49] uppercase leading-none">
                PLAYING FOR
              </div>
              <div className="font-cinema text-[28px] sm:text-[30px] text-[#FDF5E1] leading-none tracking-[0.02em] mt-1.5 tabular-nums">
                +{scoreYield} PTS
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
