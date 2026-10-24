import React, { useEffect } from 'react';
import { RoomState } from '../types/multiplayer';
import confetti from 'canvas-confetti';
import { Trophy, Film, ArrowRight, RotateCcw, Home, Award } from 'lucide-react';
import { playProjectorClick, playCorrectGuessFanfare, playLosingMusic } from '../utils/audio';

interface MultiplayerGameOverModalProps {
  room: RoomState;
  myPlayerId: string;
  onPlayAgain: () => void;
  onReturnToMenu: () => void;
}

export const MultiplayerGameOverModal: React.FC<MultiplayerGameOverModalProps> = ({
  room,
  myPlayerId,
  onPlayAgain,
  onReturnToMenu,
}) => {
  const isWinner = room.winnerId === myPlayerId;
  const isTie = room.isTie;
  const isAbandoned = room.status === 'abandoned';

  const playersList = Object.values(room.players);
  const myPlayer = room.players[myPlayerId] || { name: 'You', score: 0 };
  const opponent = playersList.find((p) => p.id !== myPlayerId) || {
    name: 'Opponent',
    score: 0,
  };

  useEffect(() => {
    if (isWinner) {
      playCorrectGuessFanfare();
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#EC5A49', '#EAF18A', '#C2B6EF', '#FFFFFF'],
      });
    } else if (!isTie) {
      playLosingMusic();
    }
  }, [isWinner, isTie]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#1C1C1B] border border-white/10 rounded-[24px] max-w-lg w-full p-6 sm:p-8 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Outcome Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 bg-[#262625] border border-white/10">
            {isWinner ? (
              <Trophy className="w-8 h-8 text-[#EAF18A]" />
            ) : isTie ? (
              <Award className="w-8 h-8 text-[#C2B6EF]" />
            ) : (
              <Film className="w-8 h-8 text-[#EC5A49]" />
            )}
          </div>

          <span className="font-mono-code text-[11px] uppercase tracking-widest text-[#8E8A82] block">
            {isAbandoned ? 'MATCH CONCLUDED VIA FORFEIT' : '60-SECOND MATCH COMPLETED'}
          </span>

          <h2 className="font-cinema text-5xl sm:text-6xl text-white tracking-wider uppercase mt-1">
            {isAbandoned
              ? isWinner
                ? 'OPPONENT FORFEITED'
                : 'MATCH ABANDONED'
              : isWinner
              ? 'VICTORY!'
              : isTie
              ? "IT'S A DRAW!"
              : 'DEFEAT'}
          </h2>

          <p className="text-xs text-[#9A948A] mt-1 max-w-xs mx-auto">
            {isAbandoned
              ? room.abandonedReason || 'A player disconnected from the battle.'
              : isWinner
              ? 'Outstanding cinematic deduction! You claimed the high score.'
              : isTie
              ? 'An even match! Both cinephiles finished with identical scores.'
              : 'Close duel! Hone your cinema instincts and challenge again.'}
          </p>
        </div>

        {/* Head-to-Head Final Scores Card */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#141414] border border-white/10 mb-6">
          {/* You */}
          <div
            className={`p-4 rounded-xl flex flex-col items-center text-center transition-colors ${
              isWinner ? 'bg-[#EC5A49]/15 border border-[#EC5A49]/40' : 'bg-[#1C1C1B]'
            }`}
          >
            <span className="text-[11px] font-mono-code uppercase text-[#8E8A82]">
              {myPlayer.name} (You)
            </span>
            <span className="font-cinema text-5xl text-white my-1 tabular-nums">
              {myPlayer.score}
            </span>
            <span className="text-xs text-[#EC5A49] font-mono-code">
              {myPlayer.score} {myPlayer.score === 1 ? 'film solved' : 'films solved'}
            </span>
          </div>

          {/* Opponent */}
          <div
            className={`p-4 rounded-xl flex flex-col items-center text-center transition-colors ${
              !isWinner && !isTie && !isAbandoned
                ? 'bg-[#C2B6EF]/15 border border-[#C2B6EF]/40'
                : 'bg-[#1C1C1B]'
            }`}
          >
            <span className="text-[11px] font-mono-code uppercase text-[#8E8A82]">
              {opponent.name}
            </span>
            <span className="font-cinema text-5xl text-white my-1 tabular-nums">
              {opponent.score}
            </span>
            <span className="text-xs text-[#C2B6EF] font-mono-code">
              {opponent.score} {opponent.score === 1 ? 'film solved' : 'films solved'}
            </span>
          </div>
        </div>

        {/* Solved Films Breakdown */}
        {room.solvedHistory.length > 0 && (
          <div className="mb-6">
            <span className="font-mono-code text-[10px] uppercase tracking-wider text-[#8E8A82] block mb-2">
              SOLVED FILMS BREAKDOWN
            </span>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {room.solvedHistory.map((rec, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-white font-medium truncate block">
                      {rec.title} ({rec.year})
                    </span>
                  </div>
                  <span
                    className={`font-mono-code text-[11px] font-bold shrink-0 ${
                      rec.solvedByPlayerId === myPlayerId
                        ? 'text-[#EC5A49]'
                        : 'text-[#C2B6EF]'
                    }`}
                  >
                    Solved by {rec.solvedByPlayerId === myPlayerId ? 'You' : rec.solvedByPlayerName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              playProjectorClick();
              onPlayAgain();
            }}
            className="h-12 rounded-xl bg-[#EC5A49] hover:bg-[#F26655] text-[#141413] font-cinema text-xl uppercase tracking-wider transition-all shadow-[0_3px_0_0_#873329] active:translate-y-[2px] flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playProjectorClick();
              onReturnToMenu();
            }}
            className="h-12 rounded-xl bg-[#282827] hover:bg-[#333332] text-white border border-white/10 font-cinema text-xl uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
