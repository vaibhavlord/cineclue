import React from 'react';
import { Movie } from '../types/movie';
import { Play, RotateCcw, Home, Share2, Check } from 'lucide-react';

interface StatusModalProps {
  status: 'won' | 'lost' | 'paused';
  movie: Movie;
  pointsEarned: number;
  cluesUsed: number;
  attemptsUsed: number;
  stars: 1 | 2 | 3;
  streak: number;
  isLastRound: boolean;
  onNextFilm: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  status,
  movie,
  pointsEarned,
  cluesUsed,
  streak,
  onNextFilm,
  onResume,
  onRestart,
  onQuitToTitle,
}) => {
  const [copiedShare, setCopiedShare] = React.useState(false);

  const handleShare = () => {
    const text =
      status === 'won'
        ? `CineClue: "${movie.title}" (${movie.year}) — ${cluesUsed}/5 scenes (+${pointsEarned} pts)\n${window.location.origin}`
        : `CineClue: "${movie.title}" (${movie.year})\n${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const [canAcceptKey, setCanAcceptKey] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCanAcceptKey(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [status]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canAcceptKey) return;
      if (e.key === 'Enter') {
        if (status === 'paused') {
          onResume();
        } else {
          onNextFilm();
        }
      } else if (e.key === 'Escape' && status === 'paused') {
        onResume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, canAcceptKey, onResume, onNextFilm]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      {/* PAUSED MODAL */}
      {status === 'paused' && (
        <div className="w-full max-w-sm bg-[#181818] border border-white/15 rounded-lg p-6 shadow-2xl text-center">
          <h2 className="font-cinema text-3xl text-white tracking-wider mb-6">
            PAUSED
          </h2>

          <div className="space-y-2.5">
            <button
              onClick={onResume}
              data-start="true"
              className="w-full py-3 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black text-black" />
              <span>Resume</span>
            </button>

            <button
              onClick={onRestart}
              className="w-full py-3 rounded bg-[#262626] hover:bg-[#333333] text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart</span>
            </button>

            <button
              onClick={onQuitToTitle}
              className="w-full py-3 rounded bg-transparent hover:bg-white/5 text-neutral-400 hover:text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
          </div>
        </div>
      )}

      {/* VICTORY OR FINAL 5-CLUE REVEAL MODAL */}
      {(status === 'won' || status === 'lost') && (
        <div className="w-full max-w-md bg-[#181818] border border-white/15 rounded-lg p-6 sm:p-7 shadow-2xl text-center">
          <div className="inline-block w-8 h-1 bg-[#E50914] mb-3" />

          <h2 className="font-cinema text-3xl sm:text-4xl text-white tracking-wider">
            {status === 'won' ? 'YOU KNOW THE BALL!' : 'FILM REVEALED'}
          </h2>

          {/* Movie Title Box */}
          <div className="my-5 p-4 bg-[#141414] rounded border border-white/10">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#E50914] mb-1">
              {status === 'won' ? 'AND THE BALL IS' : 'THE MOVIE WAS'}
            </div>
            <h3 className="font-cinema text-2xl sm:text-3xl text-white tracking-wide">
              {movie.title}
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              {movie.year} · {movie.director}
            </p>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-3 gap-2 my-5">
            <div className="p-3 bg-[#141414] rounded border border-white/5">
              <div className="text-[11px] text-neutral-400">Score</div>
              <div className="text-lg font-semibold text-white tabular-nums mt-0.5">
                +{pointsEarned}
              </div>
            </div>

            <div className="p-3 bg-[#141414] rounded border border-white/5">
              <div className="text-[11px] text-neutral-400">Scenes</div>
              <div className="text-lg font-semibold text-white tabular-nums mt-0.5">
                {status === 'won' ? `${cluesUsed}/5` : '5/5'}
              </div>
            </div>

            <div className="p-3 bg-[#141414] rounded border border-white/5">
              <div className="text-[11px] text-neutral-400">Streak</div>
              <div className="text-lg font-semibold text-[#E50914] tabular-nums mt-0.5">
                {streak}x
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-2.5 mt-6">
            <button
              data-start="true"
              onClick={onNextFilm}
              className="w-full py-3.5 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Play className="w-4 h-4 fill-black text-black" />
              <span>Next Movie</span>
            </button>

            <div className="flex gap-2">
              {status === 'lost' && (
                <button
                  onClick={onRestart}
                  className="flex-1 py-2.5 rounded bg-[#262626] hover:bg-[#333333] text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}

              <button
                onClick={handleShare}
                className="flex-1 py-2.5 rounded bg-[#262626] hover:bg-[#333333] text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
