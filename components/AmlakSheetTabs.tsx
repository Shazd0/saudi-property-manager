import React from 'react';
import { Plus } from 'lucide-react';
import { AmlakWorksheet } from '../types';

interface Props {
  sheets: AmlakWorksheet[];
  activeSheetId?: string;
  onSelect: (sheetId: string) => void;
  onAdd: () => void;
  onRename: (sheetId: string, name: string) => void;
}

const AmlakSheetTabs: React.FC<Props> = ({ sheets, activeSheetId, onSelect, onAdd, onRename }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-200 bg-slate-50 px-3 py-2">
      {sheets.map(sheet => {
        const active = sheet.id === activeSheetId;
        return (
          <button
            key={sheet.id}
            type="button"
            onClick={() => onSelect(sheet.id)}
            onDoubleClick={() => {
              const next = window.prompt('Rename sheet', sheet.name);
              if (next?.trim()) onRename(sheet.id, next.trim());
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black border transition ${
              active
                ? 'bg-white text-emerald-700 border-emerald-300 shadow-sm'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-white'
            }`}
            title="Double-click to rename"
          >
            {sheet.name}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
      >
        <Plus size={14} />
        Sheet
      </button>
    </div>
  );
};

export default AmlakSheetTabs;
