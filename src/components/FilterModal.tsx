import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { MovieFilters } from '../types/movie';
import { MAJOR_COUNTRIES, DECADE_OPTIONS } from '../data/filterOptions';
import { playProjectorClick } from '../utils/audio';

interface FilterModalProps {
  currentFilters: MovieFilters;
  onApplyFilters: (filters: MovieFilters) => void;
  onClose: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  currentFilters,
  onApplyFilters,
  onClose,
}) => {
  const [selectedCountries, setSelectedCountries] = useState<string[]>(currentFilters.countries);
  const [selectedDecades, setSelectedDecades] = useState<string[]>(currentFilters.decades);

  const toggleCountry = (code: string) => {
    playProjectorClick();
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleDecade = (id: string) => {
    playProjectorClick();
    setSelectedDecades((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleResetAll = () => {
    playProjectorClick();
    setSelectedCountries([]);
    setSelectedDecades([]);
  };

  const handleSaveAndApply = () => {
    playProjectorClick();
    onApplyFilters({
      countries: selectedCountries,
      decades: selectedDecades,
    });
    onClose();
  };

  const handleClose = () => {
    onApplyFilters({
      countries: selectedCountries,
      decades: selectedDecades,
    });
    onClose();
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.stopPropagation();
        handleSaveAndApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [selectedCountries, selectedDecades]);

  const activeCount = selectedCountries.length + selectedDecades.length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={handleClose}
    >
      <div 
        className="w-full max-w-xl bg-[#181818] border border-white/15 rounded-lg p-6 shadow-2xl relative max-h-[90vh] flex flex-col justify-between overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close Filter Dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="font-cinema text-2xl text-white tracking-wider mb-4 shrink-0">
          FILTERS
        </h2>

        <div className="flex-1 overflow-y-auto pr-1 space-y-6 select-none">
          {/* Countries */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Country
              </h3>
              {selectedCountries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCountries([])}
                  className="text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MAJOR_COUNTRIES.map((country) => {
                const isSelected = selectedCountries.includes(country.code);
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => toggleCountry(country.code)}
                    className={`p-2.5 rounded border text-left transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#262626] border-[#E50914] text-white'
                        : 'bg-[#141414] border-white/10 text-neutral-300 hover:bg-[#202020]'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base leading-none shrink-0">{country.flag}</span>
                      <span className="text-xs truncate">{country.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#E50914] shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Decades */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Decade
              </h3>
              {selectedDecades.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDecades([])}
                  className="text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DECADE_OPTIONS.map((decade) => {
                const isSelected = selectedDecades.includes(decade.id);
                return (
                  <button
                    key={decade.id}
                    type="button"
                    onClick={() => toggleDecade(decade.id)}
                    className={`p-2.5 rounded border text-left transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#262626] border-[#E50914] text-white'
                        : 'bg-[#141414] border-white/10 text-neutral-300 hover:bg-[#202020]'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className="text-xs font-medium">{decade.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#E50914] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-white/10 shrink-0 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleResetAll}
            className="px-4 py-2.5 rounded bg-[#262626] hover:bg-[#333333] text-neutral-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleSaveAndApply}
            className="px-6 py-2.5 rounded bg-[#EC5A49] hover:bg-[#F26655] text-[#141413] font-bold text-xs transition-colors cursor-pointer shadow-[0_3px_0_0_#873329]"
          >
            {activeCount > 0 ? `Apply Filters (${activeCount})` : 'Apply (All Films)'}
          </button>
        </div>
      </div>
    </div>
  );
};
