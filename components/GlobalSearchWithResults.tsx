import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalSearchBar from './GlobalSearchBar';
import { globalSearch, GlobalSearchResult } from '../services/globalSearchService';
import { useLanguage } from '../i18n';

interface Props {
  searching: boolean;
  searchResults: GlobalSearchResult[];
  setSearching: (b: boolean) => void;
  setSearchResults: (r: GlobalSearchResult[]) => void;
}

const GlobalSearchWithResults: React.FC<Props> = ({ searching, searchResults, setSearching, setSearchResults }) => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const handleGlobalSearch = async (query: string) => {
    setSearching(true);
    const results = await globalSearch(query);
    setSearchResults(results);
    setSearching(false);
  };
  const handleResultClick = (res: GlobalSearchResult) => {
    if (res.type === 'customer') navigate('/customers');
    else if (res.type === 'contract') navigate('/contracts');
    else if (res.type === 'building') navigate('/properties');
  };
  return (
    <div className="mb-4">
      <GlobalSearchBar onSearch={handleGlobalSearch} />
      {searching && <div className="text-emerald-600">Searching...</div>}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mt-2 max-w-xl mx-auto">
          <div className="font-bold mb-2 text-emerald-800">Search Results</div>
          <ul>
            {searchResults.map(res => (
              <li key={res.type + res.id} className="py-2 border-b last:border-b-0 cursor-pointer hover:bg-emerald-50 px-2 rounded" onClick={() => handleResultClick(res)}>
                <span className="font-semibold">{res.label}</span> <span className="text-xs text-slate-500">[{res.type}]</span>
                {res.details && <span className="ml-2 text-slate-400">{res.details}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GlobalSearchWithResults;