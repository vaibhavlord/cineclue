import React, { useState, useEffect } from 'react';
import { Movie } from '../types/movie';
import { playProjectorClick } from '../utils/audio';
import { Lock, Minimize2, Film, RefreshCw } from 'lucide-react';

interface ClueReelProps {
  movie?: Movie | null;
  imageUrls?: string[];
  revealedTiers: number; // 1 to 5 screenshots
  onRevealNextTier: () => void;
  onRevealAnswer?: () => void;
  isSolved: boolean;
  isRoundOver?: boolean;
  scoreYield: number;
  unlockedLetters?: Set<string>;
  onUnlockLetter?: () => void;
  availableLetterCount?: number;
}

export const ClueReel: React.FC<ClueReelProps> = ({
  movie,
  imageUrls,
  revealedTiers,
  isSolved,
  isRoundOver = false,
}) => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Sync activeTab whenever a new screenshot tier is unlocked
  useEffect(() => {
    setActiveTab(Math.min(revealedTiers, 5));
  }, [revealedTiers]);

  const screenshotsList = imageUrls && imageUrls.length > 0 ? imageUrls : movie?.screenshots || [];

  // Reset image state and preload all 5 screenshots in background without displaying early
  useEffect(() => {
    setFailedImages({});
    setLoadedImages({});
    if (screenshotsList.length > 0) {
      screenshotsList.forEach((url) => {
        if (url) {
          const img = new Image();
          img.src = url;
        }
      });
    }
  }, [movie?.id, imageUrls]);

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

  const currentScreenshotUrl = screenshotsList[activeTab - 1] || null;
  const hasValidImage = Boolean(currentScreenshotUrl && !failedImages[activeTab]);
  const isImageLoading = Boolean(hasValidImage && !loadedImages[activeTab]);

  return (
    <div className="w-full flex flex-col select-none">
      {/* Main Scene Card */}
      <div className="w-full rounded-[20px] bg-[#1A1A19] border border-white/[0.08] overflow-hidden">
        {/* Card Header Bar */}
        <div className="px-5 h-11 flex items-center justify-between border-b border-white/[0.06] bg-[#1A1A19]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#EC5A49] inline-block animate-pulse" />
            <span className="font-mono-code text-[12px] tracking-[0.14em] text-[#E6DFD3] uppercase">
              CLUE {String(activeTab).padStart(2, '0')} / 05
            </span>
          </div>

          <span className="font-mono-code text-[11px] tracking-[0.16em] text-[#8E8A82] uppercase">
            {5 - revealedTiers > 0
              ? `${revealedTiers} OF 5 REVEALED · ${5 - revealedTiers} REMAINING`
              : 'ALL 5 CLUES REVEALED'}
          </span>
        </div>

        {/* 16:9 Scene Image Viewport */}
        <div className="relative w-full aspect-video bg-[#10100F] overflow-hidden">
          {/* Loading Skeleton */}
          {isImageLoading && (
            <div className="absolute inset-0 z-10 bg-[#121211] flex flex-col items-center justify-center animate-pulse">
              <Film className="w-8 h-8 text-[#EC5A49]/50 mb-2.5" />
              <span className="font-mono-code text-[11px] tracking-[0.14em] text-[#7A756E] uppercase">
                LOADING CLUE FRAME {activeTab} / 05...
              </span>
            </div>
          )}

          {hasValidImage ? (
            <>
              <img
                key={`clue-frame-${activeTab}-${currentScreenshotUrl}`}
                src={currentScreenshotUrl!}
                alt={`Movie clue scene ${activeTab}`}
                referrerPolicy="no-referrer"
                onLoad={() =>
                  setLoadedImages((prev) => ({
                    ...prev,
                    [activeTab]: true,
                  }))
                }
                onError={() =>
                  setFailedImages((prev) => ({
                    ...prev,
                    [activeTab]: true,
                  }))
                }
                className={`w-full h-full object-cover select-none block transition-opacity duration-300 ${
                  isImageLoading ? 'opacity-0' : 'opacity-100'
                }`}
                draggable={false}
              />

              {/* Top-Right Fullscreen Expand Button */}
              {!isImageLoading && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="absolute top-3.5 right-3.5 w-9 h-9 rounded-lg bg-[#0D0D0C]/85 hover:bg-black border border-white/10 text-[#FDF5E1] flex items-center justify-center transition-colors cursor-pointer z-20"
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
              )}

              {/* Revealed Movie Info Bar when round ends */}
              {(isSolved || isRoundOver) && movie && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-5 py-4 flex items-end justify-between z-20">
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
              <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
                <Film className="w-6 h-6 text-[#EC5A49]" />
              </div>
              <div className="font-cinema text-xl text-[#FDF5E1] uppercase tracking-wide">
                CLUE FRAME {activeTab}
              </div>
              <p className="text-xs text-[#8E8A82] max-w-sm mt-1">
                Frame image could not be loaded from TMDB. Try reloading this frame or inspecting other scenes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFailedImages((prev) => ({ ...prev, [activeTab]: false }));
                  setLoadedImages((prev) => ({ ...prev, [activeTab]: false }));
                }}
                className="mt-3.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-[#FDF5E1] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Loading Frame</span>
              </button>
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
