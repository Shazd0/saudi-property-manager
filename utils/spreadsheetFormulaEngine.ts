import { expandCellRange, isCellAddress, normalizeCellAddress } from './spreadsheetAddress';

export type FormulaPrimitive = string | number | boolean | null;
export type FormulaValue = FormulaPrimitive | FormulaValue[];

export interface FormulaContext {
  getCellValue(address: string): FormulaValue;
}

type TokenType =
  | 'number'
  | 'string'
  | 'identifier'
  | 'operator'
  | 'paren'
  | 'comma'
  | 'colon'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS = new Set(['+', '-', '*', '/', '^', '&', '=', '<>', '<', '>', '<=', '>=']);

function tokenize(input: string): Token[] {
  const src = input.trim().replace(/^=/, '');
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let value = '';
      i++;
      while (i < src.length && src[i] !== quote) {
        value += src[i++];
      }
      if (src[i] !== quote) throw new Error('Unclosed string');
      i++;
      tokens.push({ type: 'string', value });
      continue;
    }
    if (/\d|\./.test(ch)) {
      let value = '';
      while (i < src.length && /[\d.]/.test(src[i])) value += src[i++];
      if (!/^\d+(\.\d+)?$|^\.\d+$/.test(value)) throw new Error(`Invalid number: ${value}`);
      tokens.push({ type: 'number', value });
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let value = '';
      while (i < src.length && /[A-Za-z0-9_.$]/.test(src[i])) value += src[i++];
      tokens.push({ type: 'identifier', value });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (OPERATORS.has(two)) {
      tokens.push({ type: 'operator', value: two });
      i += 2;
      continue;
    }
    if (OPERATORS.has(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon', value: ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected token: ${ch}`);
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

function flatten(value: FormulaValue): FormulaPrimitive[] {
  if (Array.isArray(value)) return value.flatMap(flatten);
  return [value];
}

export function asNumber(value: FormulaValue): number {
  if (Array.isArray(value)) return asNumber(value[0] ?? 0);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value == null || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: FormulaValue): string {
  if (Array.isArray(value)) return asText(value[0] ?? '');
  if (value == null) return '';
  return String(value);
}

function truthy(value: FormulaValue): boolean {
  if (Array.isArray(value)) return value.some(truthy);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return !!String(value || '').trim();
}

function compareValues(left: FormulaValue, op: string, right: FormulaValue): boolean {
  const lText = asText(left);
  const rText = asText(right);
  const lNum = Number(lText);
  const rNum = Number(rText);
  const comparableAsNumber = Number.isFinite(lNum) && Number.isFinite(rNum);
  const l = comparableAsNumber ? lNum : lText.toLowerCase();
  const r = comparableAsNumber ? rNum : rText.toLowerCase();
  if (op === '=') return l === r;
  if (op === '<>') return l !== r;
  if (op === '<') return l < r;
  if (op === '>') return l > r;
  if (op === '<=') return l <= r;
  if (op === '>=') return l >= r;
  return false;
}

class Parser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly context: FormulaContext,
  ) {}

  parse(): FormulaValue {
    const value = this.parseComparison();
    if (this.peek().type !== 'eof') throw new Error(`Unexpected token: ${this.peek().value}`);
    return value;
  }

  private peek(offset = 0): Token {
    return this.tokens[this.index + offset] || { type: 'eof', value: '' };
  }

  private take(): Token {
    return this.tokens[this.index++] || { type: 'eof', value: '' };
  }

  private match(type: TokenType, value?: string): boolean {
    const token = this.peek();
    if (token.type !== type) return false;
    if (value != null && token.value !== value) return false;
    this.index++;
    return true;
  }

  private parseComparison(): FormulaValue {
    let left = this.parseConcat();
    while (this.peek().type === 'operator' && ['=', '<>', '<', '>', '<=', '>='].includes(this.peek().value)) {
      const op = this.take().value;
      const right = this.parseConcat();
      left = compareValues(left, op, right);
    }
    return left;
  }

  private parseConcat(): FormulaValue {
    let left = this.parseAdditive();
    while (this.peek().type === 'operator' && this.peek().value === '&') {
      this.take();
      left = asText(left) + asText(this.parseAdditive());
    }
    return left;
  }

  private parseAdditive(): FormulaValue {
    let left = this.parseMultiplicative();
    while (this.peek().type === 'operator' && ['+', '-'].includes(this.peek().value)) {
      const op = this.take().value;
      const right = this.parseMultiplicative();
      left = op === '+' ? asNumber(left) + asNumber(right) : asNumber(left) - asNumber(right);
    }
    return left;
  }

  private parseMultiplicative(): FormulaValue {
    let left = this.parsePower();
    while (this.peek().type === 'operator' && ['*', '/'].includes(this.peek().value)) {
      const op = this.take().value;
      const right = this.parsePower();
      const divisor = asNumber(right);
      left = op === '*' ? asNumber(left) * divisor : divisor === 0 ? '#DIV/0!' : asNumber(left) / divisor;
    }
    return left;
  }

  private parsePower(): FormulaValue {
    let left = this.parseUnary();
    while (this.peek().type === 'operator' && this.peek().value === '^') {
      this.take();
      left = Math.pow(asNumber(left), asNumber(this.parseUnary()));
    }
    return left;
  }

  private parseUnary(): FormulaValue {
    if (this.peek().type === 'operator' && this.peek().value === '-') {
      this.take();
      return -asNumber(this.parseUnary());
    }
    if (this.peek().type === 'operator' && this.peek().value === '+') {
      this.take();
      return asNumber(this.parseUnary());
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaValue {
    const token = this.take();
    if (token.type === 'number') return Number(token.value);
    if (token.type === 'string') return token.value;
    if (token.type === 'paren' && token.value === '(') {
      const value = this.parseComparison();
      if (!this.match('paren', ')')) throw new Error('Missing closing parenthesis');
      return value;
    }
    if (token.type === 'identifier') {
      const id = token.value.toUpperCase();
      if (this.match('paren', '(')) {
        const args: FormulaValue[] = [];
        if (!this.match('paren', ')')) {
          do {
            args.push(this.parseComparison());
          } while (this.match('comma'));
          if (!this.match('paren', ')')) throw new Error(`Missing ) for ${id}`);
        }
        return callFunction(id, args);
      }
      if (isCellAddress(token.value)) {
        if (this.match('colon')) {
          const end = this.take();
          if (end.type !== 'identifier' || !isCellAddress(end.value)) throw new Error('Invalid range');
          return expandCellRange(`${token.value}:${end.value}`).map(address => this.context.getCellValue(address));
        }
        return this.context.getCellValue(normalizeCellAddress(token.value));
      }
      if (id === 'TRUE') return true;
      if (id === 'FALSE') return false;
      throw new Error(`Unknown name: ${token.value}`);
    }
    throw new Error(`Unexpected token: ${token.value || token.type}`);
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return '#VALUE!';
  return date.toISOString().slice(0, 10);
}

function callFunction(name: string, args: FormulaValue[]): FormulaValue {
  const values = args.flatMap(flatten);
  switch (name) {
    case 'SUM':
      return values.reduce((sum, value) => sum + asNumber(value), 0);
    case 'AVERAGE': {
      const nums = values.map(asNumber);
      return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
    }
    case 'MIN':
      return Math.min(...values.map(asNumber));
    case 'MAX':
      return Math.max(...values.map(asNumber));
    case 'COUNT':
      return values.filter(value => value !== null && value !== '' && Number.isFinite(Number(value))).length;
    case 'COUNTA':
      return values.filter(value => value !== null && value !== '').length;
    case 'IF':
      return truthy(args[0]) ? (args[1] ?? true) : (args[2] ?? false);
    case 'ROUND':
      return Number(asNumber(args[0]).toFixed(Math.max(0, Math.floor(asNumber(args[1])))));
    case 'ABS':
      return Math.abs(asNumber(args[0]));
    case 'TODAY':
      return todayIso();
    case 'DATE':
      return isoDate(asNumber(args[0]), asNumber(args[1]), asNumber(args[2]));
    default:
      throw new Error(`Unsupported formula: ${name}`);
  }
}

export function evaluateFormula(formula: string, context: FormulaContext): FormulaValue {
  if (!String(formula || '').trim()) return null;
  const parser = new Parser(tokenize(formula), context);
  return parser.parse();
}
