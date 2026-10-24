import React, { useState, useEffect } from 'react';
import { Movie } from '../types/movie';
import { playProjectorClick } from '../utils/audio';
import { Lock, Minimize2 } from 'lucide-react';

interface ClueReelProps {
  movie: Movie;
  revealedTiers: number; // 1 to 5 screenshots
  onRevealNextTier: () => void;
  onRevealAnswer?: () => void;
  isSolved: boolean;
  isRoundOver?: boolean;
  scoreYield: number;
  unlockedLetters: Set<string>;
  onUnlockLetter: () => void;
  availableLetterCount: number;
}

export const ClueReel: React.FC<ClueReelProps> = ({
  movie,
  revealedTiers,
  isSolved,
  isRoundOver = false,
}) => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Sync activeTab whenever a new screenshot tier is unlocked
  useEffect(() => {
    setActiveTab(Math.min(revealedTiers, 5));
  }, [revealedTiers]);

  // Reset failed image state and preload all 5 screenshots when movie changes
  useEffect(() => {
    setFailedImages({});
    if (movie.screenshots && movie.screenshots.length > 0) {
      movie.screenshots.forEach((url) => {
        if (url) {
          const img = new Image();
          img.src = url;
        }
      });
    }
  }, [movie.id, movie.screenshots]);

  // Allow keyboard 1-5 to switch between unlocked screenshots when not typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 5 && num <= revealedTiers) {
        playProjectorClick();
        setActiveTab(num);
      } else if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [revealedTiers, isExpanded]);

  const screenshotsList = movie.screenshots || [];
  const currentScreenshotUrl = screenshotsList[activeTab - 1] || null;
  const hasValidImage = Boolean(currentScreenshotUrl && !failedImages[activeTab]);

  return (
    <div className="w-full flex flex-col select-none">
      {/* Main Scene Card */}
      <div className="w-full rounded-[20px] bg-[#1A1A19] border border-white/[0.08] overflow-hidden">
        {/* Card Header Bar */}
        <div className="px-5 h-11 flex items-center justify-between border-b border-white/[0.06] bg-[#1A1A19]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#EC5A49] inline-block" />
            <span className="font-mono-code text-[12px] tracking-[0.14em] text-[#E6DFD3] uppercase">
              SCENE {String(activeTab).padStart(2, '0')} / 05
            </span>
          </div>

          <span className="font-mono-code text-[11px] tracking-[0.16em] text-[#8E8A82] uppercase">
            A FEW FRAMES. ONE FILM.
          </span>
        </div>

        {/* 16:9 Scene Image Viewport */}
        <div className="relative w-full aspect-video bg-[#10100F] overflow-hidden">
          {hasValidImage ? (
            <>
              <img
                key={`${movie.id}-shot-${activeTab}`}
                src={currentScreenshotUrl!}
                alt={`Scene ${activeTab}`}
                referrerPolicy="no-referrer"
                onError={() =>
                  setFailedImages((prev) => ({
                    ...prev,
                    [activeTab]: true,
                  }))
                }
                className="w-full h-full object-cover select-none block"
                draggable={false}
              />

              {/* Top-Right Fullscreen Expand Button */}
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="absolute top-3.5 right-3.5 w-9 h-9 rounded-lg bg-[#0D0D0C]/85 hover:bg-black border border-white/10 text-[#FDF5E1] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Expand scene screenshot"
              >
                <svg
                  viewBox="0 0 18 18"
                  className="w-4 h-4 text-[#FDF5E1]"
                  fill="none"
                >
                  <path
                    d="M11 3H15V7M15 3L10.5 7.5M7 15H3V11M3 15L7.5 10.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {(isSolved || isRoundOver) && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-5 py-4 flex items-end justify-between">
                  <div>
                    <div className="font-cinema text-2xl tracking-wide text-[#FDF5E1] leading-none">
                      {movie.title} ({movie.year})
                    </div>
                    <div className="text-xs text-[#C2BCB0] mt-1">
                      {movie.director}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#151514]">
              {activeTab === 1 && (
                <>
                  <div className="text-4xl sm:text-5xl my-3 tracking-widest">
                    {movie.emojiCryptogram}
                  </div>
                  <p className="text-xs text-[#9A948A] max-w-md">
                    {movie.minimalistArt.description}
                  </p>
                </>
              )}
              {activeTab === 2 && (
                <blockquote className="text-lg sm:text-xl text-[#FDF5E1] italic max-w-lg my-2">
                  &ldquo;{movie.tagline.prompt}&rdquo;
                </blockquote>
              )}
              {activeTab === 3 && (
                <div className="max-w-lg my-2">
                  <p className="text-xs text-[#9A948A] mb-1">
                    {movie.quote.speakerRole}
                  </p>
                  <blockquote className="text-base sm:text-lg text-[#FDF5E1] italic">
                    &ldquo;{movie.quote.dialogue}&rdquo;
                  </blockquote>
                </div>
              )}
              {activeTab === 4 && (
                <div className="grid grid-cols-3 gap-2 w-full max-w-lg my-2">
                  {movie.castDossier.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#20201F] text-left"
                    >
                      <div className="text-xs text-[#EC5A49] font-bold">
                        {c.actorInitials}
                      </div>
                      <div className="text-xs text-[#FDF5E1] mt-0.5">
                        {c.archetype}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 5 && (
                <div className="max-w-lg my-2 text-xs text-[#C2BCB0] space-y-1">
                  <p className="text-[#FDF5E1] font-semibold">
                    {movie.boxOfficeTrivia.oscars}
                  </p>
                  <p className="text-[#9A948A]">
                    {movie.boxOfficeTrivia.secretTrivia}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Footer Bar: Scene Buttons 1..5 + Scene Status Text */}
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 bg-[#1A1A19] border-t border-white/[0.06]">
          {/* Left: 5 Scene Selector Buttons */}
          <div className="flex items-center gap-2.5">
            {[1, 2, 3, 4, 5].map((step) => {
              const isStepUnlocked = step <= revealedTiers;
              const isStepActive = step === activeTab;

              return (
                <button
                  key={step}
                  type="button"
                  disabled={!isStepUnlocked}
                  onClick={() => {
                    if (isStepUnlocked) {
                      playProjectorClick();
                      setActiveTab(step);
                    }
                  }}
                  aria-label={`Scene ${step}`}
                  className={`h-11 rounded-xl font-mono-code text-[13px] tabular-nums transition-all flex items-center justify-center ${
                    isStepActive
                      ? 'min-w-[46px] px-3.5 bg-[#EC5A49] text-[#141413] font-bold cursor-pointer'
                      : isStepUnlocked
                      ? 'min-w-[46px] px-3.5 bg-[#242422] hover:bg-[#2E2E2B] border border-white/[0.1] text-[#FDF5E1] font-medium cursor-pointer'
                      : 'min-w-[52px] px-3.5 bg-[#1D1D1C] border border-white/[0.08] text-[#7A756E] gap-1.5 cursor-not-allowed'
                  }`}
                >
                  <span>{step}</span>
                  {!isStepUnlocked && (
                    <Lock className="w-3 h-3 text-[#6E6A63] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Scene Progress & Prompt */}
          <div className="text-right">
            <div className="font-mono-code text-[11px] tracking-[0.14em] text-[#D7D0C3] uppercase">
              {revealedTiers} OF 5 SCENES
            </div>
            <div className="text-[13px] text-[#8E8A82] mt-0.5">
              Need another angle? Unlock the next scene.
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tip Callout Below Scene Card */}
      <div className="mt-5 px-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Film Strip Icon */}
          <svg
            viewBox="0 0 20 20"
            className="w-5 h-5 text-[#EC5A49] shrink-0"
            fill="none"
          >
            <rect
              x="2.5"
              y="3"
              width="15"
              height="14"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M6.5 3V17M13.5 3V17M2.5 7.5H6.5M13.5 7.5H17.5M2.5 12.5H6.5M13.5 12.5H17.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>

          <div>
            <div className="text-[14px] font-semibold text-[#FDF5E1] leading-snug">
              Trust your movie brain.
            </div>
            <div className="text-[13px] text-[#8E8A82] mt-0.5">
              Look closely. Every scene is a clue, and every hint costs points.
            </div>
          </div>
        </div>

        <span className="hidden sm:inline-block font-mono-code text-[11px] tracking-[0.16em] text-[#6E6A63] uppercase whitespace-nowrap">
          TAKE YOUR TIME.
        </span>
      </div>

      {/* Fullscreen Scene Lightbox Modal */}
      {isExpanded && hasValidImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative max-w-6xl w-full aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentScreenshotUrl!}
              alt={`Scene ${activeTab} expanded`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/80 hover:bg-black border border-white/15 text-[#FDF5E1] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Minimize scene screenshot"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
