import React from 'react';
import { MovieFilters } from '../types/movie';
import { formatFilterSummary } from '../data/filterOptions';
import { SlidersHorizontal, RotateCcw, Sparkles, Home } from 'lucide-react';

interface ExhaustedPoolModalProps {
  currentFilters: MovieFilters;
  onClearFilters: () => void;
  onOpenFilters: () => void;
  onResetSeen: () => void;
  onQuitToTitle?: () => void;
}

export const ExhaustedPoolModal: React.FC<ExhaustedPoolModalProps> = ({
  currentFilters,
  onClearFilters,
  onOpenFilters,
  onResetSeen,
  onQuitToTitle,
}) => {
  const activeSummary = formatFilterSummary(currentFilters);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#181818] border border-white/15 rounded-lg p-6 sm:p-7 shadow-2xl text-center select-none animate-in fade-in zoom-in-95 duration-200">
        <div className="inline-block w-8 h-1 bg-[#EC5A49] mb-3" />

        <h2 className="font-cinema text-2xl sm:text-3xl text-white tracking-wider">
          NO UNUSED MOVIES FOUND
        </h2>

        <div className="my-3 px-3 py-1.5 inline-block bg-[#141414] rounded border border-white/10">
          <p className="font-mono-code text-[11px] tracking-[0.12em] text-[#EC5A49] uppercase font-semibold">
            {activeSummary}
          </p>
        </div>

        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed my-4">
          All movies matching your active filter combination have already appeared in this session,
          or no eligible movies exist. How would you like to continue?
        </p>

        <div className="space-y-2.5 pt-2">
          {/* Primary Action: Clear Filters & Keep Playing */}
          <button
            type="button"
            onClick={onClearFilters}
            className="w-full py-3 rounded bg-[#EC5A49] hover:bg-[#F26655] text-[#141413] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Clear Filters & Continue</span>
          </button>

          {/* Secondary Action: Change / Adjust Filters */}
          <button
            type="button"
            onClick={onOpenFilters}
            className="w-full py-3 rounded bg-[#262626] hover:bg-[#333333] text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer border border-white/10"
          >
            <SlidersHorizontal className="w-4 h-4 text-neutral-300" />
            <span>Change Filters</span>
          </button>

          {/* Tertiary Action: Reset Seen History to replay this filter pool */}
          <button
            type="button"
            onClick={onResetSeen}
            className="w-full py-2.5 rounded bg-transparent hover:bg-white/5 border border-white/15 text-neutral-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Played Movies for this Filter</span>
          </button>

          {/* Return to Title */}
          {onQuitToTitle && (
            <button
              type="button"
              onClick={onQuitToTitle}
              className="w-full py-2 text-neutral-500 hover:text-neutral-300 text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer pt-1"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return to Title</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
