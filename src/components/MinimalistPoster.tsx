import React from 'react';
import { MinimalistArt } from '../types/movie';

interface MinimalistPosterProps {
  title: string;
  year: number;
  director: string;
  art: MinimalistArt;
  isSolved?: boolean;
  posterUrl?: string | null;
}

export const MinimalistPoster: React.FC<MinimalistPosterProps> = ({
  title,
  year,
  director,
  art,
  isSolved = false,
  posterUrl,
}) => {
  const renderArtGraphic = (symbol: string, accent: string) => {
    switch (symbol) {
      case 'totem_spinner':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            <ellipse cx="50" cy="85" rx="35" ry="8" fill="rgba(0,0,0,0.5)" />
            {/* Spinning top */}
            <path d="M50 15 L52 35 L78 50 L50 82 L22 50 L48 35 Z" fill={accent} fillOpacity="0.85" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="50" cy="15" r="3" fill="#ffffff" />
            <path d="M25 50 Q50 65 75 50" stroke="#ffffff" strokeWidth="1" strokeDasharray="2 2" />
          </svg>
        );

      case 'matrix_pills':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Falling code lines in background */}
            <g opacity="0.4" stroke={accent} strokeWidth="1" strokeDasharray="3 4">
              <line x1="20" y1="5" x2="20" y2="95" />
              <line x1="40" y1="0" x2="40" y2="90" />
              <line x1="60" y1="10" x2="60" y2="100" />
              <line x1="80" y1="5" x2="80" y2="85" />
            </g>
            {/* Red pill */}
            <rect x="25" y="40" width="16" height="34" rx="8" transform="rotate(-25 33 57)" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
            {/* Blue pill */}
            <rect x="58" y="40" width="16" height="34" rx="8" transform="rotate(25 66 57)" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        );

      case 'amber_mosquito':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Amber pebble */}
            <path
              d="M50 12 C75 12 88 35 84 65 C80 88 58 92 42 90 C22 88 12 70 16 42 C19 20 32 12 50 12 Z"
              fill={accent}
              fillOpacity="0.8"
              stroke="#fbbf24"
              strokeWidth="2"
            />
            {/* Mosquito silhouette inside amber */}
            <g fill="#291605">
              <ellipse cx="50" cy="50" rx="3.5" ry="8" />
              <circle cx="50" cy="40" r="3" />
              <line x1="50" y1="38" x2="44" y2="30" stroke="#291605" strokeWidth="1" />
              <path d="M47 48 Q32 38 35 48" stroke="#291605" strokeWidth="1" />
              <path d="M53 48 Q68 38 65 48" stroke="#291605" strokeWidth="1" />
              <path d="M48 54 L38 68" stroke="#291605" strokeWidth="1" />
              <path d="M52 54 L62 68" stroke="#291605" strokeWidth="1" />
            </g>
          </svg>
        );

      case 'ocean_heart':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Blue diamond heart */}
            <path
              d="M50 82 L20 48 C10 35 22 18 36 24 C44 28 48 35 50 38 C52 35 56 28 64 24 C78 18 90 35 80 48 Z"
              fill={accent}
              stroke="#e0f2fe"
              strokeWidth="2"
            />
            {/* Diamond facet highlights */}
            <path d="M50 38 L50 82 M20 48 L80 48 M36 24 L50 48 L64 24" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
          </svg>
        );

      case 'joker_card':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Scorched card */}
            <rect x="26" y="16" width="48" height="68" rx="4" fill="#18181b" stroke="#71717a" strokeWidth="1.5" />
            <path d="M26 16 L40 16 L35 28 Z" fill="#450a0a" />
            {/* Bat smile insignia */}
            <path d="M35 55 Q50 72 65 55 Q50 62 35 55 Z" fill={accent} />
            <circle cx="42" cy="44" r="2.5" fill="#ef4444" />
            <circle cx="58" cy="44" r="2.5" fill="#ef4444" />
          </svg>
        );

      case 'delorean_fire':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Clock tower face */}
            <circle cx="50" cy="30" r="16" stroke="#94a3b8" strokeWidth="2" fill="#0f172a" />
            <line x1="50" y1="30" x2="50" y2="20" stroke="#f59e0b" strokeWidth="2" />
            <line x1="50" y1="30" x2="58" y2="30" stroke="#f59e0b" strokeWidth="1.5" />
            {/* Twin fire tracks */}
            <path d="M32 90 L44 52" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            <path d="M68 90 L56 52" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            <path d="M30 92 L42 54" stroke="#fde047" strokeWidth="1.5" />
            <path d="M70 92 L58 54" stroke="#fde047" strokeWidth="1.5" />
          </svg>
        );

      case 'gargantua_blackhole':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Accretion disk halo */}
            <ellipse cx="50" cy="50" rx="44" ry="12" stroke="#f59e0b" strokeWidth="4" opacity="0.8" />
            <ellipse cx="50" cy="50" rx="40" ry="24" stroke="#fbbf24" strokeWidth="2" opacity="0.5" />
            {/* Pitch black event horizon */}
            <circle cx="50" cy="50" r="18" fill="#000000" stroke="#ffffff" strokeWidth="1" />
          </svg>
        );

      case 'briefcase_glow':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Golden radial aura */}
            <circle cx="50" cy="52" r="30" fill="#f59e0b" fillOpacity="0.25" filter="blur(6px)" />
            {/* Briefcase */}
            <rect x="25" y="44" width="50" height="34" rx="3" fill="#27272a" stroke="#d4d4d8" strokeWidth="1.5" />
            {/* Briefcase handle */}
            <path d="M42 44 V36 H58 V44" stroke="#d4d4d8" strokeWidth="2" fill="none" />
            {/* Glowing lock */}
            <circle cx="40" cy="56" r="3" fill="#fbbf24" />
            <circle cx="60" cy="56" r="3" fill="#fbbf24" />
          </svg>
        );

      case 'noface_mask':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Black cowl */}
            <path d="M25 88 C25 40 40 20 50 20 C60 20 75 40 75 88 Z" fill="#09090b" />
            {/* Mask */}
            <ellipse cx="50" cy="50" rx="16" ry="22" fill="#fafafa" stroke="#e4e4e7" strokeWidth="1" />
            {/* Mask marks */}
            <path d="M48 36 H52 M48 64 H52" stroke="#581c87" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="44" cy="46" rx="2" ry="3" fill="#09090b" />
            <ellipse cx="56" cy="46" rx="2" ry="3" fill="#09090b" />
            <path d="M46 58 Q50 61 54 58" stroke="#09090b" strokeWidth="1.5" fill="none" />
          </svg>
        );

      case 'carpet_maze':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Hexagonal Overlook pattern */}
            <g stroke={accent} strokeWidth="2.5" opacity="0.9">
              <polygon points="50,15 75,30 75,60 50,75 25,60 25,30" />
              <polygon points="50,25 65,34 65,56 50,65 35,56 35,34" fill="#991b1b" fillOpacity="0.4" />
              <line x1="50" y1="15" x2="50" y2="0" />
              <line x1="75" y1="60" x2="90" y2="70" />
              <line x1="25" y1="60" x2="10" y2="70" />
            </g>
          </svg>
        );

      case 'marigold_bridge':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Guitar neck */}
            <path d="M50 20 L50 85" stroke="#f59e0b" strokeWidth="3" />
            <circle cx="50" cy="65" r="14" fill="#78350f" stroke="#fbbf24" strokeWidth="2" />
            <circle cx="50" cy="65" r="5" fill="#1c1917" />
            {/* Marigold petals */}
            <circle cx="36" cy="78" r="3" fill="#f59e0b" />
            <circle cx="64" cy="78" r="3.5" fill="#fbbf24" />
            <circle cx="42" cy="88" r="3" fill="#ea580c" />
            <circle cx="58" cy="88" r="3" fill="#f59e0b" />
          </svg>
        );

      case 'trinity_flash':
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            {/* Boiling explosion core */}
            <circle cx="50" cy="45" r="28" fill="#ffedd5" />
            <circle cx="50" cy="45" r="35" stroke="#ea580c" strokeWidth="3" strokeDasharray="4 3" opacity="0.8" />
            {/* Fedora hat silhouette */}
            <path d="M30 80 Q50 72 70 80 L66 74 Q50 70 34 74 Z" fill="#18181b" />
            <ellipse cx="50" cy="80" rx="26" ry="3" fill="#18181b" />
          </svg>
        );

      default:
        // Generic film reel icon
        return (
          <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="38" stroke={accent} strokeWidth="3" />
            <circle cx="50" cy="50" r="14" stroke="#ffffff" strokeWidth="2" fill="#0f172a" />
            <circle cx="32" cy="38" r="6" fill={accent} />
            <circle cx="68" cy="38" r="6" fill={accent} />
            <circle cx="50" cy="72" r="6" fill={accent} />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative w-full max-w-[280px] sm:max-w-[320px] aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10 p-5 flex flex-col justify-between select-none bg-gradient-to-b ${art.primaryBg}`}
      data-testid="minimalist-poster"
    >
      {/* TMDB Poster Background if provided */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt={isSolved ? title : 'Mystery film poster'}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
            isSolved
              ? 'filter-none opacity-90 scale-100'
              : 'filter blur-md brightness-50 opacity-40 scale-105'
          }`}
        />
      )}

      {/* Film grain vignette */}
      <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black/85 pointer-events-none" />

      {/* Top Header Watermark */}
      <div className="relative z-10 flex justify-between items-start text-[11px] font-mono tracking-widest uppercase text-white/50">
        <span>{posterUrl ? 'TMDB ARCHIVE' : 'CINE-SPECIMEN'}</span>
        <span>{year}</span>
      </div>

      {/* Center Symbolic Artwork */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto transition-transform duration-300 hover:scale-105">
        {!posterUrl && renderArtGraphic(art.themeSymbol, art.accentColor)}
        <div className="mt-3 text-center bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur-xs">
          <p className="text-xs font-mono text-white/80 max-w-[240px] leading-relaxed">
            {art.description}
          </p>
        </div>
      </div>

      {/* Bottom Identity Block (Obscured or Revealed) */}
      <div className="relative z-10 pt-3 border-t border-white/10 text-center">
        {isSolved ? (
          <div>
            <h3 className="font-cinema text-lg tracking-wider text-amber-400 font-bold uppercase drop-shadow">
              {title}
            </h3>
            <p className="text-[11px] text-white/60 font-mono tracking-wider">
              DIRECTED BY {director.toUpperCase()}
            </p>
          </div>
        ) : (
          <div>
            <div className="h-5 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-ping" />
              <span className="text-[11px] tracking-widest font-mono text-amber-300/80 uppercase">
                CLUE #4: MINIMALIST REEL
              </span>
            </div>
            <p className="text-[10px] text-white/40 tracking-wider font-mono">
              DIRECTED BY [REDACTED]
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
