import React, { useMemo, useState } from 'react';
import { AmlakWorksheet } from '../types';
import { cellAddress, indexToColLabel, parseCellAddress } from '../utils/spreadsheetAddress';

interface Props {
  sheet: AmlakWorksheet;
  activeAddress: string;
  onActiveAddressChange: (address: string) => void;
  onChangeCell: (address: string, raw: string) => void;
  onChangeCells: (updates: Array<{ address: string; raw: string }>) => void;
}

function displayCellValue(raw: string, value: unknown, editing: boolean): string {
  if (editing) return raw || '';
  if (String(raw || '').trim().startsWith('=')) return value == null ? '' : String(value);
  return raw || '';
}

const AmlakSpreadsheetGrid: React.FC<Props> = ({
  sheet,
  activeAddress,
  onActiveAddressChange,
  onChangeCell,
  onChangeCells,
}) => {
  const [editingAddress, setEditingAddress] = useState<string>('');
  const columns = useMemo(
    () => Array.from({ length: sheet.colCount }, (_, i) => ({ index: i + 1, label: indexToColLabel(i + 1) })),
    [sheet.colCount],
  );
  const rows = useMemo(() => Array.from({ length: sheet.rowCount }, (_, i) => i + 1), [sheet.rowCount]);

  const moveActive = (address: string, colDelta: number, rowDelta: number) => {
    const parsed = parseCellAddress(address);
    const col = Math.min(sheet.colCount, Math.max(1, parsed.col + colDelta));
    const row = Math.min(sheet.rowCount, Math.max(1, parsed.row + rowDelta));
    onActiveAddressChange(cellAddress(col, row));
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>, startAddress: string) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    const start = parseCellAddress(startAddress);
    const updates: Array<{ address: string; raw: string }> = [];
    text.replace(/\r/g, '').split('\n').filter((line, index, arr) => !(index === arr.length - 1 && line === '')).forEach((line, rowOffset) => {
      line.split('\t').forEach((raw, colOffset) => {
        const col = start.col + colOffset;
        const row = start.row + rowOffset;
        if (col <= sheet.colCount && row <= sheet.rowCount) updates.push({ address: cellAddress(col, row), raw });
      });
    });
    onChangeCells(updates);
  };

  return (
    <div className="overflow-auto border border-slate-200 rounded-2xl bg-white shadow-sm" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      <table className="border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 w-12 min-w-12 bg-slate-100 border-b border-r border-slate-200" />
            {columns.map(col => (
              <th
                key={col.label}
                className="min-w-32 h-8 bg-slate-100 border-b border-r border-slate-200 text-slate-500 font-black"
                style={{ width: sheet.columnWidths?.[col.label] || 128 }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row}>
              <th className="sticky left-0 z-10 w-12 min-w-12 h-8 bg-slate-100 border-b border-r border-slate-200 text-slate-500 font-black">
                {row}
              </th>
              {columns.map(col => {
                const address = cellAddress(col.index, row);
                const cell = sheet.cells[address];
                const active = address === activeAddress;
                const editing = editingAddress === address;
                const posted = !!cell?.posting?.postedTransactionId;
                return (
                  <td
                    key={address}
                    className={`h-8 border-b border-r border-slate-200 p-0 ${
                      active ? 'outline outline-2 outline-emerald-500 outline-offset-[-2px]' : ''
                    } ${posted ? 'bg-emerald-50' : cell?.type === 'error' ? 'bg-rose-50' : 'bg-white'}`}
                  >
                    <input
                      value={displayCellValue(cell?.raw || '', cell?.value, editing)}
                      title={cell?.error || cell?.posting?.postedTransactionId || address}
                      onFocus={() => {
                        onActiveAddressChange(address);
                        setEditingAddress(address);
                      }}
                      onBlur={() => setEditingAddress('')}
                      onChange={e => onChangeCell(address, e.target.value)}
                      onPaste={e => handlePaste(e, address)}
                      onKeyDown={e => {
                        if (e.ctrlKey && e.key.toLowerCase() === 'd') {
                          e.preventDefault();
                          const above = sheet.cells[cellAddress(col.index, Math.max(1, row - 1))];
                          if (above) onChangeCell(address, above.raw || '');
                          return;
                        }
                        if (e.key === 'ArrowRight' && !editing) moveActive(address, 1, 0);
                        if (e.key === 'ArrowLeft' && !editing) moveActive(address, -1, 0);
                        if (e.key === 'ArrowDown') moveActive(address, 0, 1);
                        if (e.key === 'ArrowUp') moveActive(address, 0, -1);
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          moveActive(address, e.shiftKey ? -1 : 1, 0);
                        }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setEditingAddress('');
                          moveActive(address, 0, e.shiftKey ? -1 : 1);
                        }
                      }}
                      className={`w-full h-8 px-2 bg-transparent outline-none font-medium ${
                        cell?.type === 'number' ? 'text-right tabular-nums' : 'text-left'
                      } ${cell?.type === 'error' ? 'text-rose-700' : posted ? 'text-emerald-800' : 'text-slate-800'}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AmlakSpreadsheetGrid;
