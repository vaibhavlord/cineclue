import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, ExternalLink, Key, RefreshCw, Sparkles, Film } from 'lucide-react';

interface TmdbInfoModalProps {
  onClose: () => void;
}

export const TmdbInfoModal: React.FC<TmdbInfoModalProps> = ({ onClose }) => {
  const [status, setStatus] = useState<{
    connected: boolean;
    liveTmdb?: boolean;
    groqAi?: boolean;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tmdb/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus({ connected: false, message: 'Could not connect to server status endpoint.' });
      }
    } catch {
      setStatus({ connected: false, message: 'Server unreachable.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
          aria-label="Close TMDB modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/30">
            <Film className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h2 className="font-cinema text-xl sm:text-2xl font-bold text-white uppercase tracking-wider">
              TMDB & Groq AI Cinema Engine
            </h2>
            <p className="text-xs font-mono text-slate-400">
              Live Film Catalog • Groq AI Curated Selection
            </p>
          </div>
        </div>

        {/* Current Connection Status Banner */}
        <div
          className={`p-4 rounded-2xl border mb-5 flex items-start gap-3 ${
            status?.connected
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
          }`}
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin shrink-0 mt-0.5" />
          ) : status?.connected ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          )}

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
                {loading
                  ? 'Checking Connection...'
                  : status?.connected
                  ? status?.groqAi
                    ? 'TMDB & Groq AI Connected'
                    : 'TMDB Connected & Active'
                  : 'Not Connected Yet'}
              </h4>
              <button
                onClick={checkStatus}
                disabled={loading}
                className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 underline cursor-pointer"
              >
                Refresh
              </button>
            </div>
            <p className="text-xs mt-1 leading-relaxed opacity-90 font-sans">
              {status?.message || 'Verifying cinema engine configuration...'}
            </p>

            {status?.groqAi && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/60 border border-emerald-400/30 text-[11px] font-mono text-emerald-300">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Groq AI Active: Curating iconic films for your filters</span>
              </div>
            )}
          </div>
        </div>

        {/* What TMDB Unlocks */}
        <div className="mb-5">
          <h3 className="text-xs font-mono text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>What TMDB Connects:</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5">
              <span className="font-bold text-white block font-mono">🌟 Infinite Film Library</span>
              <span className="text-slate-400 text-[11px]">Access to 800,000+ films from every decade and cinema genre.</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5">
              <span className="font-bold text-white block font-mono">🖼️ HD Theatrical Posters</span>
              <span className="text-slate-400 text-[11px]">Real movie artwork revealed when you solve or inspect clues.</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5">
              <span className="font-bold text-white block font-mono">🔍 Global Autocomplete</span>
              <span className="text-slate-400 text-[11px]">Search virtually any film ever made directly in the deduction bar.</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5">
              <span className="font-bold text-white block font-mono">👥 Real Cast & Gross</span>
              <span className="text-slate-400 text-[11px]">Live cast rosters, actual box office numbers, and trivia records.</span>
            </div>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="mb-6">
          <h3 className="text-xs font-mono text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-sky-400" />
            <span>How to Connect Your TMDB Key in 3 Minutes:</span>
          </h3>

          <ol className="space-y-3 text-xs font-mono text-slate-300">
            <li className="p-3 bg-slate-950/70 rounded-xl border border-white/5 flex gap-2.5 items-start">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">1</span>
              <div>
                <p className="font-bold text-white">Create a free TMDB account</p>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Sign up for free at{' '}
                  <a
                    href="https://www.themoviedb.org/signup"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 underline inline-flex items-center gap-0.5"
                  >
                    themoviedb.org/signup <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </li>

            <li className="p-3 bg-slate-950/70 rounded-xl border border-white/5 flex gap-2.5 items-start">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">2</span>
              <div>
                <p className="font-bold text-white">Request a free Developer API Key</p>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Navigate to{' '}
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 underline inline-flex items-center gap-0.5"
                  >
                    Settings &gt; API <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  and generate an API Key (select "Developer").
                </p>
              </div>
            </li>

            <li className="p-3 bg-slate-950/70 rounded-xl border border-white/5 flex gap-2.5 items-start">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">3</span>
              <div>
                <p className="font-bold text-white">Add TMDB_API_KEY to AI Studio</p>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  In AI Studio, open the <strong>Secrets</strong> panel (or edit your local <code>.env</code> file) and create:
                </p>
                <div className="mt-1.5 p-2 rounded-lg bg-black/60 border border-white/10 text-amber-300 text-[11px] select-all">
                  TMDB_API_KEY="your_api_key_here"
                </div>
              </div>
            </li>
          </ol>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider transition-colors"
        >
          Close & Back to Game
        </button>
      </div>
    </div>
  );
};
