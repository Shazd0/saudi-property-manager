import React, { useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectSearchProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const SelectSearch: React.FC<SelectSearchProps> = ({ options, value, onChange, placeholder, disabled, className }) => {
  const [search, setSearch] = useState('');
  const filtered = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`relative ${className || ''}`}>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="w-full px-3 py-2 border border-slate-300 rounded-t-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        disabled={disabled}
        onFocus={() => setSearch('')}
      />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border-t-0 border border-slate-300 rounded-b-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        disabled={disabled}
        size={Math.min(6, filtered.length || 1)}
        style={{ marginTop: -2 }}
      >
        {filtered.length === 0 && <option value="" disabled>No results</option>}
        {filtered.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

export default SelectSearch;
