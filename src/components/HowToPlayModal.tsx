import React from 'react';
import { X } from 'lucide-react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-md bg-[#181818] border border-white/15 rounded-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close how to play modal"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="font-cinema text-2xl text-white tracking-wider mb-4">
          RULES
        </h2>

        <div className="space-y-2 mb-6">
          {[
            { shot: 1, pts: '1000 pts' },
            { shot: 2, pts: '800 pts' },
            { shot: 3, pts: '600 pts' },
            { shot: 4, pts: '400 pts' },
            { shot: 5, pts: '200 pts' },
          ].map((item) => (
            <div
              key={item.shot}
              className="px-4 py-2.5 bg-[#141414] rounded border border-white/5 flex items-center justify-between text-sm"
            >
              <span className="text-neutral-300 font-medium">Scene {item.shot}</span>
              <span className="text-white font-semibold tabular-nums">{item.pts}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-sm transition-colors cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
