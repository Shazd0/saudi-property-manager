// GlobalSearchBar.tsx
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '../i18n';

interface GlobalSearchBarProps {
  onSearch: (query: string) => void;
}

const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onSearch }) => {
  const { t, isRTL } = useLanguage();

  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto mb-4 flex min-w-0 w-full max-w-full items-center gap-2 sm:max-w-xl">
      <input
        type="text"
        className="min-w-0 flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
        placeholder="Search customers, contracts, properties..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Global search"
      />
      <button type="submit" className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
        <Search size={20} />
      </button>
    </form>
  );
};

export default GlobalSearchBar;
