import React from 'react';

interface Props {
  activeAddress: string;
  rawValue: string;
  evaluatedValue: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}

const AmlakFormulaBar: React.FC<Props> = ({ activeAddress, rawValue, evaluatedValue, onChange, onCommit }) => {
  return (
    <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-2xl px-3 py-2 shadow-sm">
      <div className="w-20 px-2 py-1 rounded-lg bg-slate-100 text-xs font-black text-slate-700 text-center">
        {activeAddress || 'A1'}
      </div>
      <div className="text-sm font-black text-emerald-700">fx</div>
      <input
        value={rawValue}
        onChange={e => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommit();
        }}
        className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder="Type a value or formula, e.g. =SUM(H2:H20)"
      />
      <div className="hidden md:block max-w-52 truncate text-xs font-semibold text-slate-500">
        {evaluatedValue}
      </div>
    </div>
  );
};

export default AmlakFormulaBar;
