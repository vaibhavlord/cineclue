import type { CountryOption, DecadeOption, MovieFilters } from '../types/movie.ts';

export const MAJOR_COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
];

export const DECADE_OPTIONS: DecadeOption[] = [
  { id: 'classic', label: '1960s & Prior', sublabel: 'Golden Age Classics (Pre-1970)', startYear: 1920, endYear: 1969 },
  { id: '1970s', label: '1970s', sublabel: 'New Hollywood & Auteur Boom (1970–1979)', startYear: 1970, endYear: 1979 },
  { id: '1980s', label: '1980s', sublabel: 'Blockbuster Golden Era (1980–1989)', startYear: 1980, endYear: 1989 },
  { id: '1990s', label: '1990s', sublabel: 'Indie Revolution & 90s Classics (1990–1999)', startYear: 1990, endYear: 1999 },
  { id: '2000s', label: '2000s', sublabel: 'Digital Millennium & Epics (2000–2009)', startYear: 2000, endYear: 2009 },
  { id: '2010s', label: '2010s', sublabel: 'Modern Masterpieces & Visionaries (2010–2019)', startYear: 2010, endYear: 2019 },
  { id: '2020s', label: '2020s', sublabel: 'Contemporary Cinema (2020–Present)', startYear: 2020, endYear: 2029 },
];

export const DEFAULT_FILTERS: MovieFilters = {
  countries: [],
  decades: [],
};

export function isFilterActive(filters: MovieFilters): boolean {
  return filters.countries.length > 0 || filters.decades.length > 0;
}

export function formatFilterSummary(filters: MovieFilters): string {
  if (!isFilterActive(filters)) {
    return 'All Cinema & All Eras';
  }

  const parts: string[] = [];

  if (filters.countries.length > 0) {
    if (filters.countries.length === 1) {
      const match = MAJOR_COUNTRIES.find((c) => c.code === filters.countries[0]);
      parts.push(`${match ? `${match.flag} ${match.name}` : filters.countries[0]}`);
    } else {
      const flags = filters.countries
        .map((code) => MAJOR_COUNTRIES.find((c) => c.code === code)?.flag || code)
        .slice(0, 3)
        .join(' ');
      parts.push(`${flags} (${filters.countries.length} countries)`);
    }
  }

  if (filters.decades.length > 0) {
    if (filters.decades.length === 1) {
      const match = DECADE_OPTIONS.find((d) => d.id === filters.decades[0]);
      parts.push(match ? match.label : filters.decades[0]);
    } else {
      parts.push(`${filters.decades.length} Decades`);
    }
  }

  return parts.join(' • ');
}
