import React from 'react';
import { GameStats } from '../types/movie';
import { X } from 'lucide-react';

interface StatsModalProps {
  stats: GameStats;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ stats, onClose }) => {
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  const maxClueCount = Math.max(
    1,
    stats.clueDistribution.clue1,
    stats.clueDistribution.clue2,
    stats.clueDistribution.clue3,
    stats.clueDistribution.clue4,
    stats.clueDistribution.clue5,
    stats.clueDistribution.clue6
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-md bg-[#181818] border border-white/15 rounded-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close stats modal"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="font-cinema text-2xl text-white tracking-wider mb-5">
          STATS
        </h2>

        {/* 4 Core Stat Tiles */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="p-3 bg-[#141414] rounded border border-white/5 text-center">
            <div className="text-xl font-semibold text-white tabular-nums">
              {stats.gamesPlayed}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">Played</div>
          </div>

          <div className="p-3 bg-[#141414] rounded border border-white/5 text-center">
            <div className="text-xl font-semibold text-white tabular-nums">
              {winRate}%
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">Win %</div>
          </div>

          <div className="p-3 bg-[#141414] rounded border border-white/5 text-center">
            <div className="text-xl font-semibold text-[#E50914] tabular-nums">
              {stats.currentStreak}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">Streak</div>
          </div>

          <div className="p-3 bg-[#141414] rounded border border-white/5 text-center">
            <div className="text-xl font-semibold text-white tabular-nums">
              {stats.bestStreak}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">Best</div>
          </div>
        </div>

        {/* Distribution */}
        <div className="mb-6">
          <div className="space-y-2 text-xs">
            {[1, 2, 3, 4, 5].map((tier) => {
              const key = `clue${tier}` as keyof typeof stats.clueDistribution;
              const count = stats.clueDistribution[key] || 0;
              const pct = Math.round((count / maxClueCount) * 100);

              return (
                <div key={tier} className="flex items-center gap-3">
                  <span className="w-4 text-neutral-400 text-right tabular-nums">{tier}</span>
                  <div className="flex-1 bg-[#141414] rounded h-5 overflow-hidden">
                    <div
                      className={`h-full flex items-center justify-end pr-2 text-[11px] font-semibold tabular-nums ${
                        count > 0 ? 'bg-[#E50914] text-white' : 'bg-transparent text-neutral-600'
                      }`}
                      style={{ width: `${Math.max(10, pct)}%` }}
                    >
                      {count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total Points */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-sm">
          <span className="text-neutral-400">Total Score</span>
          <span className="font-semibold text-white tabular-nums">
            {stats.totalScore.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
