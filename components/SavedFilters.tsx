import React, { useEffect, useState } from 'react';
import { fmtDateTime } from '../utils/dateFormat';
import { useLanguage } from '../i18n';

interface SavedFilter { name: string; filters: any; createdAt: number }

interface Props {
  namespace: string; // key namespace, e.g. 'contracts' or 'history'
  getCurrent: () => any;
  apply: (f: any) => void;
  compact?: boolean;
}

const storageKey = (ns: string) => `savedFilters:${ns}`;

const SavedFilters: React.FC<Props> = ({ namespace, getCurrent, apply, compact }) => {
  const [items, setItems] = useState<SavedFilter[]>([]);
  const { t, isRTL } = useLanguage();

  const [open, setOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(namespace));
      if (raw) setItems(JSON.parse(raw));
    } catch (e) { setItems([]); }
  }, [namespace]);

  const save = () => {
    if (!showSaveInput) {
      setShowSaveInput(true);
      return;
    }
    const name = saveName.trim();
    if (!name) return;
    const filters = getCurrent();
    const next = [{ name, filters, createdAt: Date.now() }, ...items].slice(0, 25);
    localStorage.setItem(storageKey(namespace), JSON.stringify(next));
    setItems(next);
    setSaveName('');
    setShowSaveInput(false);
    setOpen(false);
  };

  const load = (it: SavedFilter) => {
    apply(it.filters);
    setOpen(false);
    setShowSaveInput(false);
    setSaveName('');
  };

  const remove = (idx: number) => {
    const next = items.slice(); next.splice(idx, 1);
    localStorage.setItem(storageKey(namespace), JSON.stringify(next));
    setItems(next);
  };

  return (
    <div className={`relative ${compact ? 'inline-block' : 'inline-flex items-center gap-2'}`}> 
      <button onClick={() => setOpen(v => !v)} className="px-3 py-2 rounded-xl border bg-white text-sm flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
        {!compact && <span className="text-xs font-bold">Saved</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-white border rounded-lg shadow-lg z-40 p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold">Saved Filters</div>
            <div className="flex items-center gap-2">
              <button onClick={save} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded">{t('common.save')}</button>
              <button onClick={() => { setOpen(false); setShowSaveInput(false); setSaveName(''); }} className="text-xs px-2 py-1 rounded">{t('common.close')}</button>
            </div>
          </div>
          {showSaveInput && (
            <div className="mb-2">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Short name"
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
          )}
          <div className="max-h-48 overflow-auto">
            {items.length === 0 && <div className="text-xs text-slate-400 p-2">No saved filters</div>}
            {items.map((it, idx) => (
              <div key={it.createdAt} className="flex items-center justify-between gap-2 p-2 hover:bg-slate-50 rounded">
                <div className="flex-1">
                  <div className="text-sm font-bold truncate">{it.name}</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(it.createdAt)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => load(it)} className="px-2 py-1 text-xs rounded bg-white border">Load</button>
                  <button onClick={() => remove(idx)} className="px-2 py-1 text-xs rounded bg-rose-50 text-rose-600">Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedFilters;
