import { AmlakCell, AmlakWorksheet } from '../types';
import { normalizeCellAddress } from './spreadsheetAddress';
import { evaluateFormula, FormulaValue } from './spreadsheetFormulaEngine';

function primitiveValue(value: FormulaValue): string | number | boolean | null {
  if (Array.isArray(value)) return value.map(v => primitiveValue(v)).join(',');
  return value;
}

export function inferCellValue(raw: string): Pick<AmlakCell, 'value' | 'formula' | 'type' | 'error'> {
  const text = String(raw ?? '');
  if (!text.trim()) return { value: null, type: 'empty' };
  if (text.trim().startsWith('=')) return { formula: text.trim(), value: null, type: 'formula' };
  if (/^(true|false)$/i.test(text.trim())) return { value: /^true$/i.test(text.trim()), type: 'boolean' };
  const n = Number(text.replace(/,/g, ''));
  if (Number.isFinite(n) && text.trim() !== '') return { value: n, type: 'number' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) return { value: text.trim(), type: 'date' };
  return { value: text, type: 'text' };
}

export function setWorksheetCell(sheet: AmlakWorksheet, address: string, raw: string): AmlakWorksheet {
  const normalized = normalizeCellAddress(address);
  const nextCells = { ...sheet.cells };
  if (!String(raw ?? '').trim()) {
    delete nextCells[normalized];
  } else {
    nextCells[normalized] = {
      ...(nextCells[normalized] || { address: normalized }),
      address: normalized,
      raw,
      ...inferCellValue(raw),
    };
  }
  return recalcWorksheet({
    ...sheet,
    cells: nextCells,
    updatedAt: Date.now(),
  });
}

export function recalcWorksheet(sheet: AmlakWorksheet): AmlakWorksheet {
  const sourceCells = sheet.cells || {};
  const nextCells: Record<string, AmlakCell> = {};
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const evaluateCell = (addressLike: string): FormulaValue => {
    const address = normalizeCellAddress(addressLike);
    const source = sourceCells[address];
    if (!source) return null;
    if (visited.has(address)) return nextCells[address]?.value ?? null;
    if (visiting.has(address)) {
      nextCells[address] = {
        ...source,
        address,
        value: '#CYCLE!',
        type: 'error',
        error: 'Circular reference',
      };
      visited.add(address);
      return '#CYCLE!';
    }

    visiting.add(address);
    const inferred = inferCellValue(source.raw);
    let evaluated: AmlakCell = {
      ...source,
      address,
      ...inferred,
    };

    if (inferred.formula) {
      try {
        const value = evaluateFormula(inferred.formula, { getCellValue: evaluateCell });
        const primitive = primitiveValue(value);
        if (primitive === '#CYCLE!') {
          evaluated = {
            ...evaluated,
            value: primitive,
            type: 'error',
            error: 'Circular reference',
          };
        } else {
        evaluated = {
          ...evaluated,
          value: primitive,
          type: typeof primitive === 'number' ? 'number' : 'formula',
          error: undefined,
        };
        }
      } catch (error: any) {
        evaluated = {
          ...evaluated,
          value: '#ERROR!',
          type: 'error',
          error: error?.message || 'Formula error',
        };
      }
    }

    visiting.delete(address);
    visited.add(address);
    nextCells[address] = evaluated;
    return evaluated.value ?? null;
  };

  Object.keys(sourceCells).forEach(evaluateCell);
  return {
    ...sheet,
    cells: nextCells,
    updatedAt: Date.now(),
  };
}
