import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, X, Volume2, Receipt } from 'lucide-react';
import SoundService from '../services/soundService';
import { ExpenseCategory } from '../types';
import { getTransactions, getBuildings, getCustomers, getContracts, getUsers, getOccupancyStats, getTasks, getVendors } from '../services/firestoreService';
import { useLanguage } from '../i18n';

// ─── Route map ──────────────────────────────────────────────────────────────
interface RouteMapping {
  route: string;
  keywords: string[];
  keywordsAr: string[];
  label: string;
  labelAr: string;
}

const ROUTE_MAP: RouteMapping[] = [
  { route: '/',                    keywords: ['dashboard', 'home', 'main', 'overview'],                              keywordsAr: ['الرئيسية', 'لوحة', 'الملخص'],             label: 'Dashboard',        labelAr: 'لوحة التحكم' },
  { route: '/contracts',           keywords: ['contract', 'contracts', 'lease', 'agreement'],                        keywordsAr: ['عقد', 'عقود', 'العقود', 'ايجار'],         label: 'Contracts',        labelAr: 'العقود' },
  { route: '/entry',               keywords: ['entry', 'add entry', 'new entry', 'new transaction'],                 keywordsAr: ['إضافة', 'قيد', 'معاملة'],                 label: 'Add Entry',        labelAr: 'إضافة قيد' },
  { route: '/history',             keywords: ['history', 'transactions', 'records', 'ledger'],                       keywordsAr: ['السجل', 'المعاملات', 'التاريخ'],          label: 'Transactions',     labelAr: 'المعاملات' },
  { route: '/customers',           keywords: ['customer', 'customers', 'tenants', 'tenant', 'client'],               keywordsAr: ['العملاء', 'عميل', 'مستأجر', 'مستأجرين'], label: 'Customers',        labelAr: 'العملاء' },
  { route: '/properties',          keywords: ['property', 'properties', 'building', 'buildings'],                    keywordsAr: ['العقارات', 'عقار', 'مبنى', 'مباني'],      label: 'Properties',       labelAr: 'العقارات' },
  { route: '/directory',           keywords: ['directory', 'building directory', 'units'],                           keywordsAr: ['الدليل', 'وحدات'],                        label: 'Directory',        labelAr: 'الدليل' },
  { route: '/tasks',               keywords: ['task', 'tasks', 'to do', 'todo'],                                    keywordsAr: ['المهام', 'مهمة'],                          label: 'Tasks',            labelAr: 'المهام' },
  { route: '/calendar',            keywords: ['calendar', 'schedule', 'date', 'events'],                             keywordsAr: ['التقويم', 'جدول', 'مواعيد'],              label: 'Calendar',         labelAr: 'التقويم' },
  { route: '/monitoring',          keywords: ['monitoring', 'monitor', 'analytics', 'stats'],                        keywordsAr: ['المراقبة', 'تحليلات', 'إحصائيات'],        label: 'Monitoring',       labelAr: 'المراقبة' },
  { route: '/vendors',             keywords: ['vendor', 'vendors', 'supplier', 'suppliers'],                         keywordsAr: ['الموردين', 'مورد'],                        label: 'Vendors',          labelAr: 'الموردين' },
  { route: '/stocks',              keywords: ['stock', 'stocks', 'inventory', 'warehouse'],                          keywordsAr: ['المخزون', 'مخزون', 'مستودع'],             label: 'Stock Management', labelAr: 'إدارة المخزون' },
  { route: '/transfers',           keywords: ['transfer', 'transfers', 'treasury'],                                  keywordsAr: ['التحويلات', 'تحويل', 'الخزينة'],          label: 'Treasury',         labelAr: 'الخزينة' },
  { route: '/borrowings',          keywords: ['borrowing', 'borrowings', 'loan', 'loans', 'debt'],                   keywordsAr: ['القروض', 'قرض', 'استعارة'],               label: 'Borrowings',       labelAr: 'القروض' },
  { route: '/staff',               keywords: ['staff', 'portfolio', 'staff portfolio', 'team'],                      keywordsAr: ['الموظفين', 'فريق'],                        label: 'Staff Portfolio',  labelAr: 'ملف الموظفين' },
  { route: '/vat-report',          keywords: ['vat', 'tax', 'vat report', 'tax report'],                             keywordsAr: ['الضريبة', 'ضريبة', 'تقرير الضريبة'],     label: 'VAT Report',       labelAr: 'تقرير الضريبة' },
  { route: '/reports',             keywords: ['report', 'reports', 'summary'],                                       keywordsAr: ['التقارير', 'تقرير'],                       label: 'Reports',          labelAr: 'التقارير' },
  { route: '/registry',            keywords: ['car', 'cars', 'registry', 'car registry', 'vehicle'],                 keywordsAr: ['السيارات', 'سيارة', 'مركبة'],             label: 'Car Registry',     labelAr: 'سجل السيارات' },
  { route: '/approvals',           keywords: ['approval', 'approvals', 'approve', 'pending'],                        keywordsAr: ['الموافقات', 'موافقة'],                     label: 'Approvals',        labelAr: 'الموافقات' },
  { route: '/settings',            keywords: ['setting', 'settings', 'preferences', 'profile'],                      keywordsAr: ['الإعدادات', 'إعدادات', 'الملف الشخصي'],  label: 'Settings',         labelAr: 'الإعدادات' },
  { route: '/admin/employees',     keywords: ['employee', 'employees', 'manage staff', 'hr'],                        keywordsAr: ['الموظفين', 'موظف', 'إدارة الموظفين'],    label: 'Employee Manager', labelAr: 'إدارة الموظفين' },
  { route: '/admin/backup',        keywords: ['backup', 'backups', 'local backup'],                                  keywordsAr: ['النسخ الاحتياطي', 'نسخة'],                label: 'Backup',           labelAr: 'النسخ الاحتياطي' },
  { route: '/admin/cloud-backup',  keywords: ['cloud', 'cloud backup', 'google drive'],                              keywordsAr: ['سحابي', 'نسخ سحابي'],                     label: 'Cloud Backup',     labelAr: 'النسخ السحابي' },
  { route: '/help',                keywords: ['help', 'support', 'guide', 'faq'],                                    keywordsAr: ['المساعدة', 'مساعدة', 'دعم'],              label: 'Help',             labelAr: 'المساعدة' },
  { route: '/about',               keywords: ['about', 'info', 'information', 'version'],                            keywordsAr: ['حول', 'معلومات', 'عن'],                   label: 'About',            labelAr: 'حول' },
];

// ─── Action keyword patterns ────────────────────────────────────────────────
const ACTION_PATTERNS = [
  /(?:open|go\s+to|show|navigate\s+to|take\s+me\s+to|switch\s+to|display)\s+(?:the\s+)?(.+)/i,
  /(.+)\s+(?:page|tab|section|screen)/i,
  /(?:افتح|اذهب\s+إلى|اعرض|انتقل\s+إلى|خذني\s+إلى)\s+(.+)/i,
  /(.+)\s+(?:صفحة|تبويب|قسم)/i,
];

function matchRoute(text: string): RouteMapping | null {
  const lower = text.toLowerCase().trim();

  for (const pat of ACTION_PATTERNS) {
    const m = lower.match(pat);
    if (m && m[1]) {
      const target = m[1].trim();
      for (const r of ROUTE_MAP) {
        if (r.keywords.some(k => target.includes(k)) || r.keywordsAr.some(k => target.includes(k))) return r;
      }
    }
  }

  for (const r of ROUTE_MAP) {
    if (r.keywords.some(k => lower.includes(k)) || r.keywordsAr.some(k => lower.includes(k))) return r;
  }
  return null;
}

// ─── TTS ────────────────────────────────────────────────────────────────────
function speak(text: string, lang: string = 'en-US'): Promise<void> {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang; utter.rate = 1.05; utter.pitch = 1; utter.volume = 0.8;
    const safety = setTimeout(resolve, 8000);
    utter.onend = () => { clearTimeout(safety); resolve(); };
    utter.onerror = () => { clearTimeout(safety); resolve(); };
    window.speechSynthesis.speak(utter);
  });
}

// ─── Expense helpers ────────────────────────────────────────────────────────
type ConvStep = 'none' | 'ask_amount' | 'ask_category' | 'ask_description' | 'ask_confirm';

interface PendingExpense {
  amount: number;
  category: string;
  categoryLabel: string;
  description: string;
}

const EMPTY_EXPENSE: PendingExpense = { amount: 0, category: '', categoryLabel: '', description: '' };

const CATEGORY_MAP = [
  { value: ExpenseCategory.GENERAL,        label: 'General',        keywords: ['general', 'other', 'general expense'] },
  { value: ExpenseCategory.MAINTENANCE,    label: 'Maintenance',    keywords: ['maintenance', 'repair', 'fix', 'fixing', 'plumbing', 'ac'] },
  { value: ExpenseCategory.UTILITIES,      label: 'Utilities',      keywords: ['utility', 'utilities', 'electric', 'electricity', 'water', 'bill', 'bills', 'power'] },
  { value: ExpenseCategory.HEAD,           label: 'Head Office',    keywords: ['head office', 'head', 'office'] },
  { value: ExpenseCategory.SALARY,         label: 'Salary',         keywords: ['salary', 'salaries', 'wage', 'wages', 'pay'] },
  { value: ExpenseCategory.VENDOR_PAYMENT, label: 'Vendor Payment', keywords: ['vendor', 'supplier', 'vendor payment'] },
  { value: ExpenseCategory.PROPERTY_RENT,  label: 'Property Rent',  keywords: ['rent', 'property rent', 'rental'] },
  { value: ExpenseCategory.BORROWING,      label: 'Borrowing',      keywords: ['borrow', 'borrowing', 'loan'] },
];

function isExpenseIntent(text: string): boolean {
  return /(?:add|create|new|record|make|enter|log)\s+(?:an?\s+)?expense/i.test(text)
    || /expense\s+\d/i.test(text)
    || /(?:أضف|سجل)\s+(?:مصروف|مصاريف)/i.test(text);
}

function extractAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, '').replace(/sar|riyal|riyals|rial|rials/gi, '').trim();
  const m = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const n = parseFloat(m[1]);
    if (n > 0 && n < 100000000) return n;
  }
  return null;
}

function matchCategory(text: string): { value: string; label: string } | null {
  const lower = text.toLowerCase().trim();
  for (const cat of CATEGORY_MAP) {
    if (cat.keywords.some(k => lower.includes(k))) return { value: cat.value, label: cat.label };
  }
  return null;
}

// ─── Smart Q&A engine ───────────────────────────────────────────────────────
interface QARule {
  patterns: RegExp[];
  handler: (text: string, user: any) => Promise<string>;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; }
function yearStart() { return `${new Date().getFullYear()}-01-01`; }
function fmt(n: number) { return n.toLocaleString('en-SA', { maximumFractionDigits: 0 }); }

const QA_RULES: QARule[] = [
  // ── Income / revenue questions ──
  {
    patterns: [
      /(?:how\s+much|what(?:'s|\s+is)|total)\s+(?:income|revenue|rent|collection|money)\s+(?:today|this\s+month|this\s+year|last\s+month|total)/i,
      /(?:income|revenue|rent|collection)\s+(?:today|this\s+month|this\s+year|last\s+month|total)/i,
      /(?:today(?:'s)?|this\s+month(?:'s)?|this\s+year(?:'s)?)\s+(?:income|revenue|rent|collection)/i,
    ],
    handler: async (text) => {
      const lower = text.toLowerCase();
      const txs: any[] = await getTransactions();
      const income = txs.filter((t: any) => t.type === 'INCOME' && t.status !== 'REJECTED' && !(t as any).deleted);
      let filtered: any[];
      let period: string;
      if (/today/i.test(lower)) {
        const today = todayStr();
        filtered = income.filter(t => t.date === today);
        period = 'today';
      } else if (/last\s+month/i.test(lower)) {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        const lm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        filtered = income.filter(t => t.date?.startsWith(lm));
        period = 'last month';
      } else if (/this\s+year/i.test(lower)) {
        const yy = yearStart().slice(0, 4);
        filtered = income.filter(t => t.date?.startsWith(yy));
        period = 'this year';
      } else {
        const ms = monthStart().slice(0, 7);
        filtered = income.filter(t => t.date?.startsWith(ms));
        period = 'this month';
      }
      const total = filtered.reduce((s, t) => s + (t.amount || 0), 0);
      return `Total income ${period} is ${fmt(total)} SAR from ${filtered.length} transactions.`;
    }
  },
  // ── Expense questions ──
  {
    patterns: [
      /(?:how\s+much|what(?:'s|\s+is)|total)\s+(?:expense|expenses|spending|spent)\s+(?:today|this\s+month|this\s+year|last\s+month|total)/i,
      /(?:expense|expenses|spending|spent)\s+(?:today|this\s+month|this\s+year|last\s+month|total)/i,
      /(?:today(?:'s)?|this\s+month(?:'s)?|this\s+year(?:'s)?)\s+(?:expense|expenses|spending)/i,
    ],
    handler: async (text) => {
      const lower = text.toLowerCase();
      const txs: any[] = await getTransactions();
      const expenses = txs.filter((t: any) => t.type === 'EXPENSE' && t.status !== 'REJECTED' && !(t as any).deleted);
      let filtered: any[];
      let period: string;
      if (/today/i.test(lower)) {
        filtered = expenses.filter(t => t.date === todayStr()); period = 'today';
      } else if (/last\s+month/i.test(lower)) {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        filtered = expenses.filter(t => t.date?.startsWith(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)); period = 'last month';
      } else if (/this\s+year/i.test(lower)) {
        filtered = expenses.filter(t => t.date?.startsWith(yearStart().slice(0, 4))); period = 'this year';
      } else {
        filtered = expenses.filter(t => t.date?.startsWith(monthStart().slice(0, 7))); period = 'this month';
      }
      const total = filtered.reduce((s, t) => s + (t.amount || 0), 0);
      return `Total expenses ${period}: ${fmt(total)} SAR across ${filtered.length} entries.`;
    }
  },
  // ── Profit / net income ──
  {
    patterns: [
      /(?:profit|net\s+income|earnings)\s*(?:today|this\s+month|this\s+year)?/i,
      /(?:how\s+much|what(?:'s|\s+is))\s+(?:the\s+)?(?:profit|net\s+income|net\s+balance)/i,
    ],
    handler: async (text) => {
      const lower = text.toLowerCase();
      const txs: any[] = await getTransactions();
      const valid = txs.filter((t: any) => t.status !== 'REJECTED' && !(t as any).deleted);
      let period: string;
      let filter: (t: any) => boolean;
      if (/today/i.test(lower)) {
        const today = todayStr(); filter = (t) => t.date === today; period = 'today';
      } else if (/this\s+year/i.test(lower)) {
        const yy = yearStart().slice(0, 4); filter = (t) => t.date?.startsWith(yy); period = 'this year';
      } else {
        const ms = monthStart().slice(0, 7); filter = (t) => t.date?.startsWith(ms); period = 'this month';
      }
      const filt = valid.filter(filter);
      const income = filt.filter(t => t.type === 'INCOME').reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const expense = filt.filter(t => t.type === 'EXPENSE').reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const net = income - expense;
      return `${period}: Income ${fmt(income)}, Expenses ${fmt(expense)}, Net ${net >= 0 ? '+' : ''}${fmt(net)} SAR.`;
    }
  },
  // ── How many customers / tenants ──
  {
    patterns: [
      /(?:how\s+many|count|total|number\s+of)\s+(?:customer|customers|tenant|tenants|client|clients)/i,
    ],
    handler: async () => {
      const customers: any[] = await getCustomers();
      return `You have ${customers.length} customers.`;
    }
  },
  // ── How many buildings ──
  {
    patterns: [
      /(?:how\s+many|count|total|number\s+of)\s+(?:building|buildings|property|properties)/i,
    ],
    handler: async () => {
      const buildings: any[] = await getBuildings();
      const totalUnits = buildings.reduce((s: number, b: any) => s + (b.units?.length || 0), 0);
      return `You have ${buildings.length} buildings with ${totalUnits} total units.`;
    }
  },
  // ── Occupancy / vacancy ──
  {
    patterns: [
      /(?:occupancy|vacancy|vacant\s+unit|occupied)\s*(?:rate|units|percentage|%)?/i,
      /(?:how\s+many|count)\s+(?:vacant|empty|occupied|available)\s+(?:unit|units|room|rooms)/i,
    ],
    handler: async () => {
      const stats = await getOccupancyStats();
      const vacant = stats.totalUnits - stats.occupiedUnits;
      return `Occupancy: ${stats.occupiedUnits} of ${stats.totalUnits} units occupied (${stats.percentage}%). ${vacant} vacant.`;
    }
  },
  // ── How many contracts ──
  {
    patterns: [
      /(?:how\s+many|count|total|number\s+of)\s+(?:contract|contracts|lease|leases|active\s+contract)/i,
    ],
    handler: async () => {
      const contracts: any[] = await getContracts();
      const active = contracts.filter((c: any) => c.status === 'Active');
      const expired = contracts.filter((c: any) => c.status === 'Expired' || c.endDate < todayStr());
      return `${contracts.length} total contracts: ${active.length} active, ${expired.length} expired.`;
    }
  },
  // ── Expiring contracts ──
  {
    patterns: [
      /(?:expiring|expire|renewal|renew|due)\s+(?:contract|contracts|soon|this\s+month)/i,
      /(?:contract|contracts)\s+(?:expiring|expire|renewal|due)/i,
    ],
    handler: async () => {
      const contracts: any[] = await getContracts();
      const today = todayStr();
      const d30 = new Date(); d30.setDate(d30.getDate() + 30);
      const limit = d30.toISOString().split('T')[0];
      const expiring = contracts.filter((c: any) => c.status === 'Active' && c.endDate >= today && c.endDate <= limit);
      return expiring.length > 0
        ? `${expiring.length} contract${expiring.length > 1 ? 's' : ''} expiring within 30 days.`
        : 'No contracts expiring in the next 30 days.';
    }
  },
  // ── How many employees / staff ──
  {
    patterns: [
      /(?:how\s+many|count|total|number\s+of)\s+(?:employee|employees|staff|workers?|team)/i,
    ],
    handler: async () => {
      const users: any[] = await getUsers();
      const staff = users.filter((u: any) => u.role === 'EMPLOYEE' || u.role === 'ENGINEER');
      return `You have ${staff.length} staff members and ${users.length} total users.`;
    }
  },
  // ── How many vendors ──
  {
    patterns: [
      /(?:how\s+many|count|total|number\s+of)\s+(?:vendor|vendors|supplier|suppliers)/i,
    ],
    handler: async () => {
      const vendors: any[] = await getVendors();
      return `You have ${vendors.length} vendors.`;
    }
  },
  // ── Pending tasks ──
  {
    patterns: [
      /(?:how\s+many|count|any|pending|open)\s+(?:task|tasks|to\s*do|todos)/i,
      /(?:task|tasks)\s+(?:pending|open|remaining|left)/i,
    ],
    handler: async (_text, user) => {
      const tasks: any[] = await getTasks(user?.id);
      const pending = tasks.filter((t: any) => !t.completed && !(t as any).deleted);
      const overdue = pending.filter((t: any) => t.dueDate && t.dueDate < todayStr());
      return pending.length > 0
        ? `${pending.length} pending task${pending.length > 1 ? 's' : ''}${overdue.length > 0 ? `, ${overdue.length} overdue` : ''}.`
        : 'No pending tasks. All clear!';
    }
  },
  // ── Overdue payments ──
  {
    patterns: [
      /(?:overdue|late|unpaid|outstanding|pending)\s+(?:payment|payments|rent|rents|dues)/i,
      /(?:who|which\s+tenant)\s+(?:hasn't|has\s+not|didn't|owes|owe)/i,
    ],
    handler: async () => {
      const contracts: any[] = await getContracts();
      const txs: any[] = await getTransactions();
      const active = contracts.filter((c: any) => c.status === 'Active');
      let overdueCount = 0;
      let overdueAmount = 0;
      for (const c of active) {
        const payments = txs.filter((t: any) => t.contractId === c.id && t.type === 'INCOME' && t.status !== 'REJECTED');
        const paid = payments.reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const remaining = (c.totalAmount || 0) - paid;
        if (remaining > 100) { overdueCount++; overdueAmount += remaining; }
      }
      return overdueCount > 0
        ? `${overdueCount} contracts with outstanding balances totaling ${fmt(overdueAmount)} SAR.`
        : 'No outstanding balances. All contracts are up to date!';
    }
  },
];

async function answerQuestion(text: string, user: any): Promise<string | null> {
  for (const rule of QA_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(text)) {
        try {
          return await rule.handler(text, user);
        } catch (err) {
          console.error('VoiceAssistant Q&A error:', err);
          return 'Sorry, I had trouble fetching that data. Please try again.';
        }
      }
    }
  }
  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────
type AssistantState = 'idle' | 'listening' | 'processing' | 'responding' | 'error';
interface VoiceAssistantProps {
  user: any;
  defaultShowPanel?: boolean;
  hideTrigger?: boolean;
  onClose?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// TAP-TO-TALK VOICE ASSISTANT
// Supports: Navigation ("open contracts") + Expense entry ("add expense")
// Multi-step conversation for expenses: amount → category → description → confirm
// ═══════════════════════════════════════════════════════════════════════════
const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ user, defaultShowPanel, hideTrigger, onClose }) => {
  const navigate = useNavigate();

  const [state, setState] = useState<AssistantState>('idle');
  const { t, isRTL } = useLanguage();

  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showPanel, setShowPanel] = useState(defaultShowPanel ?? false)
  const [convStep, setConvStepState] = useState<ConvStep>('none');
  const [expenseDisplay, setExpenseDisplay] = useState<PendingExpense>({ ...EMPTY_EXPENSE });

  // ── Drag state ───────────────────────────────────────────────────────────
  const FAB_SIZE = 56; // w-14 = 3.5rem = 56px
  const loadSavedPos = (): { x: number; y: number } => {
    try {
      const raw = localStorage.getItem('voice-fab-pos');
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.x === 'number' && typeof p.y === 'number') return p;
      }
    } catch {}
    return { x: window.innerWidth - FAB_SIZE - 20, y: window.innerHeight - FAB_SIZE - 80 };
  };
  const [fabPos, setFabPos] = useState(loadSavedPos);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0, moved: false });
  const fabPosRef = useRef(fabPos);
  const fabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { fabPosRef.current = fabPos; }, [fabPos]);

  const cmdRecRef  = useRef<any>(null);
  const timerRef   = useRef<any>(null);
  const mountedRef = useRef(true);
  const navigateRef = useRef(navigate);
  const convStepRef = useRef<ConvStep>('none');
  const expenseRef = useRef<PendingExpense>({ ...EMPTY_EXPENSE });
  const processCommandRef = useRef<(text: string) => void>(() => {});

  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSupported = !!SpeechRecognition;

  // ── Helpers to sync refs + state ─────────────────────────────────────────
  const setStep = useCallback((s: ConvStep) => {
    convStepRef.current = s;
    setConvStepState(s);
  }, []);

  const updateExpense = useCallback((d: Partial<PendingExpense>) => {
    expenseRef.current = { ...expenseRef.current, ...d };
    setExpenseDisplay({ ...expenseRef.current });
  }, []);

  const resetConversation = useCallback(() => {
    convStepRef.current = 'none';
    expenseRef.current = { ...EMPTY_EXPENSE };
    setConvStepState('none');
    setExpenseDisplay({ ...EMPTY_EXPENSE });
  }, []);

  // ── Stop everything ──────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    clearTimeout(timerRef.current);
    try { cmdRecRef.current?.abort(); } catch {}
    window.speechSynthesis?.cancel();
  }, []);

  // ── Dismiss panel ────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    stopAll();
    resetConversation();
    setShowPanel(false);
    setState('idle');
    setTranscript('');
    setFeedback('');
  }, [stopAll, resetConversation]);

  // ── Start listening for mic input ────────────────────────────────────────
  const startCommandListener = useCallback(() => {
    if (!isSupported) return;
    try { cmdRecRef.current?.abort(); } catch {}

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    cmdRecRef.current = rec;

    timerRef.current = setTimeout(() => {
      try { rec.abort(); } catch {}
      if (!mountedRef.current) return;
      setFeedback("I didn't catch that. Tap the mic to try again.");
      setState('error');
      setTimeout(() => { if (mountedRef.current) dismiss(); }, 2500);
    }, 12000);

    rec.onresult = (e: any) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript;
      if (mountedRef.current) setTranscript(text);
      if (last.isFinal) {
        gotResult = true;
        clearTimeout(timerRef.current);
        processCommandRef.current(text);
      }
    };

    let gotResult = false;

    rec.onerror = (e: any) => {
      gotResult = true;
      clearTimeout(timerRef.current);
      if (!mountedRef.current) return;
      if (e.error === 'not-allowed') {
        setFeedback('Microphone permission denied. Please allow mic access.');
      } else if (e.error === 'no-speech') {
        setFeedback("I didn't hear anything. Tap the mic to try again.");
      } else if (e.error === 'aborted') {
        return; // intentional abort, ignore
      } else {
        setFeedback('Mic error: ' + e.error);
      }
      setState('error');
      setTimeout(() => { if (mountedRef.current) dismiss(); }, 2500);
    };

    rec.onend = () => {
      if (gotResult || !mountedRef.current) return;
      // Recognition ended without final result or error — handle gracefully
      clearTimeout(timerRef.current);
      setFeedback("I didn't catch that. Tap the mic to try again.");
      setState('error');
      setTimeout(() => { if (mountedRef.current) dismiss(); }, 2500);
    };

    setTimeout(() => {
      try { rec.start(); } catch (err) {
        console.error('VoiceAssistant: start failed', err);
        if (mountedRef.current) {
          setFeedback('Could not start microphone.');
          setState('error');
          setTimeout(() => dismiss(), 2000);
        }
      }
    }, 300);
  }, [isSupported, SpeechRecognition, dismiss]);

  // ── Speak then re-listen (for multi-step conversation) ───────────────────
  const continueListening = useCallback(async (message: string) => {
    if (!mountedRef.current) return;
    setState('responding');
    setFeedback(message);
    await speak(message);
    if (mountedRef.current) {
      setState('listening');
      setFeedback('Listening...');
      startCommandListener();
    }
  }, [startCommandListener]);

  // ── Navigate to entry form with pre-filled expense data ──────────────────
  const fillExpenseForm = useCallback(async () => {
    const exp = expenseRef.current;
    const today = new Date().toISOString().split('T')[0];

    resetConversation();
    setState('responding');
    setFeedback(`Opening entry form: ${exp.amount.toLocaleString()} SAR for ${exp.categoryLabel}`);
    SoundService.play('submit');
    await speak(`Opening entry form with ${exp.amount} riyals for ${exp.categoryLabel}. Review and save.`);

    navigateRef.current('/entry', {
      state: {
        voiceExpense: {
          amount: exp.amount,
          category: exp.category,
          description: exp.description || '',
          date: today,
        },
      },
    });

    setTimeout(() => { if (mountedRef.current) dismiss(); }, 600);
  }, [resetConversation, dismiss]);

  // ── Process a voice command (navigation + expense flow) ──────────────────
  const processCommand = useCallback(async (text: string) => {
    if (!mountedRef.current) return;
    setState('processing');
    setFeedback('Processing...');

    const step = convStepRef.current;
    const lower = text.toLowerCase().trim();

    // ── Cancel at any conversation step ──
    if (step !== 'none' && /\b(cancel|stop|never\s*mind|forget|abort)\b/i.test(lower)) {
      resetConversation();
      setState('responding');
      setFeedback('Cancelled.');
      await speak('Cancelled.');
      setTimeout(() => { if (mountedRef.current) dismiss(); }, 1500);
      return;
    }

    switch (step) {
      // ────────────────────────────────────────────────────────────────────
      case 'none': {
        // Check expense intent first
        if (isExpenseIntent(lower)) {
          const amount = extractAmount(text);
          const cat = matchCategory(text);
          if (amount) updateExpense({ amount });
          if (cat) updateExpense({ category: cat.value, categoryLabel: cat.label });

          if (!amount) {
            setStep('ask_amount');
            await continueListening('Sure, adding an expense. What is the amount?');
          } else if (!cat) {
            setStep('ask_category');
            await continueListening(`${amount.toLocaleString()} SAR. What category? Maintenance, utilities, general, salary, or others?`);
          } else {
            setStep('ask_description');
            await continueListening(`${amount.toLocaleString()} for ${cat.label}. Any description? Say skip if none.`);
          }
          return;
        }

        // Check income intent → open entry form
        if (/(?:add|create|new|record)\s+(?:an?\s+)?income/i.test(lower)) {
          setState('responding');
          setFeedback('Opening entry form for income...');
          SoundService.play('submit');
          await speak('Opening the entry form for income.');
          navigateRef.current('/entry');
          setTimeout(() => { if (mountedRef.current) dismiss(); }, 800);
          return;
        }

        // Smart Q&A — answer data questions
        const answer = await answerQuestion(text, user);
        if (answer) {
          setState('responding');
          setFeedback(answer);
          SoundService.play('submit');
          await speak(answer);
          setTimeout(() => { if (mountedRef.current) dismiss(); }, 5000);
          return;
        }

        // Navigation
        const matched = matchRoute(text);
        if (matched) {
          setState('responding');
          setFeedback(`Opening ${matched.label}...`);
          SoundService.play('submit');
          await speak(`Opening ${matched.label}`);
          navigateRef.current(matched.route);
          setTimeout(() => { if (mountedRef.current) dismiss(); }, 800);
        } else {
          setState('responding');
          setFeedback(`Sorry, I didn't understand "${text}". Try "Open contracts", "Add expense", or "How much income this month?".`);
          await speak("Sorry, I didn't understand that. Try asking about income, expenses, or occupancy.");
          setTimeout(() => { if (mountedRef.current) dismiss(); }, 2000);
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      case 'ask_amount': {
        const amount = extractAmount(text);
        if (!amount) {
          await continueListening("I didn't catch the amount. Please say a number, like 500.");
          return;
        }
        updateExpense({ amount });
        setStep('ask_category');
        await continueListening(
          `${amount.toLocaleString()} SAR. What category? Maintenance, utilities, general, salary, head office, vendor, or property rent?`
        );
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      case 'ask_category': {
        const cat = matchCategory(text);
        if (!cat) {
          await continueListening('Which category? Maintenance, utilities, general, salary, head office, vendor, or property rent?');
          return;
        }
        updateExpense({ category: cat.value, categoryLabel: cat.label });
        setStep('ask_description');
        await continueListening(`Got it, ${cat.label}. Any description? Say skip if none.`);
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      case 'ask_description': {
        if (/\b(skip|no|none|nothing|no description)\b/i.test(lower)) {
          updateExpense({ description: '' });
        } else {
          updateExpense({ description: text });
        }
        setStep('ask_confirm');
        const exp = expenseRef.current;
        const summary = `${exp.amount.toLocaleString()} SAR for ${exp.categoryLabel}${exp.description ? ', ' + exp.description : ''}`;
        await continueListening(`Adding expense: ${summary}. Say confirm to open the form, or cancel.`);
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      case 'ask_confirm': {
        if (/\b(yes|confirm|save|correct|ok|okay|sure|do\s*it|go\s*ahead|yeah|yep|approved)\b/i.test(lower)) {
          await fillExpenseForm();
        } else if (/\b(no|cancel|wrong|stop|nope|discard)\b/i.test(lower)) {
          resetConversation();
          setState('responding');
          setFeedback('Cancelled.');
          await speak('Cancelled.');
          setTimeout(() => { if (mountedRef.current) dismiss(); }, 1500);
        } else {
          await continueListening('Say confirm to open the form, or cancel to discard.');
        }
        break;
      }
    }
  }, [continueListening, setStep, updateExpense, resetConversation, dismiss, fillExpenseForm, user]);

  // Keep ref in sync so startCommandListener always calls the latest processCommand
  processCommandRef.current = processCommand;

  // ── Activate assistant ───────────────────────────────────────────────────
  const activate = useCallback(async () => {
    stopAll();
    resetConversation();
    setState('listening');
    setShowPanel(true);
    setTranscript('');
    setFeedback('Listening... Say "Open contracts", "Add expense", or ask a question');

    await speak('How can I help?');
    if (mountedRef.current) {
      startCommandListener();
    }
  }, [stopAll, resetConversation, startCommandListener]);

  // ── Keyboard shortcut: Ctrl+Shift+A ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        activate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activate]);

  // ── Drag handlers ────────────────────────────────────────────────────────
  const clampPos = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - FAB_SIZE;
    const maxY = window.innerHeight - FAB_SIZE;
    return { x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) };
  }, []);

  const snapToEdge = useCallback((x: number, y: number) => {
    const midX = (window.innerWidth - FAB_SIZE) / 2;
    const snappedX = x < midX ? 8 : window.innerWidth - FAB_SIZE - 8;
    const pos = clampPos(snappedX, y);
    setFabPos(pos);
    try { localStorage.setItem('voice-fab-pos', JSON.stringify(pos)); } catch {}
  }, [clampPos]);

  const onDragStart = useCallback((clientX: number, clientY: number) => {
    const pos = fabPosRef.current;
    dragRef.current = { startX: clientX, startY: clientY, origX: pos.x, origY: pos.y, moved: false };
    setDragging(true);
  }, []);

  const onDragMove = useCallback((clientX: number, clientY: number) => {
    const d = dragRef.current;
    const dx = clientX - d.startX;
    const dy = clientY - d.startY;
    if (!d.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return; // dead zone
    d.moved = true;
    const pos = clampPos(d.origX + dx, d.origY + dy);
    setFabPos(pos);
  }, [clampPos]);

  const onDragEnd = useCallback(() => {
    setDragging(false);
    if (dragRef.current.moved) {
      const cur = fabPosRef.current;
      snapToEdge(cur.x, cur.y);
    }
  }, [snapToEdge]);

  // Mouse events
  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => { e.preventDefault(); onDragMove(e.clientX, e.clientY); };
    const onMouseUp = () => onDragEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [dragging, onDragMove, onDragEnd]);

  // Touch events
  useEffect(() => {
    if (!dragging) return;
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onDragMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchEnd = () => onDragEnd();
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => { window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd); };
  }, [dragging, onDragMove, onDragEnd]);

  // Keep in bounds on window resize
  useEffect(() => {
    const onResize = () => setFabPos(prev => clampPos(prev.x, prev.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPos]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => () => { mountedRef.current = false; stopAll(); }, [stopAll]);

  if (!isSupported) return null;

  const isActive = showPanel;
  const inExpenseFlow = convStep !== 'none';

  // ── Quick-tap handler ────────────────────────────────────────────────────
  const tapCommand = (cmd: string) => {
    try { cmdRecRef.current?.abort(); } catch {}
    clearTimeout(timerRef.current);
    setTranscript(cmd);
    processCommandRef.current(cmd);
  };

  return (
    <>
      {/* ── Floating draggable mic button ── */}
      {!hideTrigger && (
        <button
          ref={fabRef}
          onMouseDown={(e) => { e.preventDefault(); onDragStart(e.clientX, e.clientY); }}
          onTouchStart={(e) => { onDragStart(e.touches[0].clientX, e.touches[0].clientY); }}
          onClick={(e) => { if (dragRef.current.moved) { e.preventDefault(); return; } activate(); }}
          title={'Tap to speak to Amlak Assistant\nDrag to move\nCtrl+Shift+A'}
          className={`
            voice-assistant-fab
            fixed z-[9998] flex items-center justify-center
            w-14 h-14 rounded-full shadow-lg
            bg-emerald-600 text-white shadow-emerald-500/40 hover:bg-emerald-500
            ${dragging ? 'scale-110 shadow-2xl cursor-grabbing' : 'hover:scale-110 active:scale-95 cursor-grab'}
            ${isActive ? 'scale-0 pointer-events-none' : 'scale-100'}
          `}
          style={{
            left: fabPos.x,
            top: fabPos.y,
            transition: dragging ? 'none' : 'transform 0.3s, box-shadow 0.3s, left 0.3s ease-out, top 0.3s ease-out',
            touchAction: 'none',
          }}
        >
          <Mic size={22} />
        </button>
      )}

      {/* ── Assistant panel ── */}
      {showPanel && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center voice-assistant-backdrop" onClick={() => { dismiss(); onClose?.(); }}>
          <div className="voice-assistant-panel bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md mx-auto p-6 pb-8 relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={dismiss} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10">
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <div className={`
                inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 transition-colors
                ${state === 'listening'  ? 'bg-emerald-100 voice-ring-active' : ''}
                ${state === 'processing' ? 'bg-amber-100' : ''}
                ${state === 'responding' ? 'bg-blue-100' : ''}
                ${state === 'error'      ? 'bg-red-100' : ''}
                ${state === 'idle'       ? 'bg-slate-100' : ''}
              `}>
                {state === 'listening'  && <Mic size={36} className="text-emerald-600 animate-pulse" />}
                {state === 'processing' && <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />}
                {state === 'responding' && <Volume2 size={36} className="text-blue-600" />}
                {state === 'error'      && <MicOff size={36} className="text-red-500" />}
                {state === 'idle'       && <Mic size={36} className="text-slate-400" />}
              </div>
              <h3 className="text-lg font-bold text-emerald-900">Amlak Assistant</h3>
              <p className="text-xs text-emerald-600 mt-1">
                {state === 'listening'  && 'Listening...'}
                {state === 'processing' && 'Thinking...'}
                {state === 'responding' && 'Responding...'}
                {state === 'error'      && 'Something went wrong'}
                {state === 'idle'       && 'Ready'}
              </p>
            </div>

            {/* Waveform */}
            {state === 'listening' && (
              <div className="flex items-center justify-center gap-1 mb-4 h-8">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="w-1 bg-emerald-500 rounded-full voice-bar" style={{ animationDelay: `${i * 0.1}s`, height: '100%' }} />
                ))}
              </div>
            )}

            {/* Expense progress (shown during multi-step flow) */}
            {inExpenseFlow && (
              <div className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt size={14} className="text-amber-600" />
                  <p className="text-xs text-amber-700 font-bold">Adding Expense</p>
                </div>
                <div className="space-y-1 text-sm text-amber-900">
                  {expenseDisplay.amount > 0 && (
                    <p>Amount: <strong>{expenseDisplay.amount.toLocaleString()} SAR</strong></p>
                  )}
                  {expenseDisplay.categoryLabel && (
                    <p>Category: <strong>{expenseDisplay.categoryLabel}</strong></p>
                  )}
                  {expenseDisplay.description && (
                    <p>Description: <strong>{expenseDisplay.description}</strong></p>
                  )}
                </div>
                {/* Step progress dots */}
                <div className="flex items-center gap-1.5 mt-2">
                  {['Amount', 'Category', 'Description', 'Confirm'].map((label, i) => {
                    const steps: ConvStep[] = ['ask_amount', 'ask_category', 'ask_description', 'ask_confirm'];
                    const stepIdx = steps.indexOf(convStep);
                    const done = i < stepIdx || (i === stepIdx && false);
                    const active = i === stepIdx;
                    return (
                      <div key={label} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${done ? 'bg-emerald-500' : active ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className={`text-[10px] ${active ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>{label}</span>
                        {i < 3 && <span className="text-slate-300 text-[10px] mx-0.5">→</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Transcript */}
            {transcript && (
              <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-200">
                <p className="text-xs text-slate-500 font-semibold mb-1">You said:</p>
                <p className="text-sm text-slate-800 font-medium">{transcript}</p>
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`rounded-xl p-3 mb-4 border text-sm font-medium
                ${state === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}
              `}>
                {feedback}
              </div>
            )}

            {/* Category quick-tap buttons (shown when asking for category) */}
            {convStep === 'ask_category' && (
              <div className="mt-2 mb-3">
                <p className="text-xs text-slate-500 font-semibold mb-2">Tap a category:</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_MAP.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => tapCommand(cat.label)}
                      className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full font-medium hover:bg-amber-200 transition-colors"
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm/Cancel buttons (shown when asking for confirmation) */}
            {convStep === 'ask_confirm' && (
              <div className="flex gap-3 mt-2 mb-3">
                <button
                  onClick={() => tapCommand('confirm')}
                  className="flex-1 text-sm bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-500 transition-colors"
                >
                  ✓ Open Form
                </button>
                <button
                  onClick={() => tapCommand('cancel')}
                  className="flex-1 text-sm bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
                >
                  ✕ Cancel
                </button>
              </div>
            )}

            {/* Quick suggestions (shown only when NOT in expense flow) */}
            {!inExpenseFlow && (
              <div className="mt-2">
                <p className="text-xs text-slate-500 font-semibold mb-2">Or tap a command:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { cmd: 'Add expense', style: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
                    { cmd: 'Income this month', style: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                    { cmd: 'Expenses this month', style: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                    { cmd: 'Occupancy rate', style: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                    { cmd: 'Pending tasks', style: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                    { cmd: 'Open contracts', style: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
                    { cmd: 'Go to dashboard', style: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
                    { cmd: 'Show customers', style: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
                  ].map(({ cmd, style }) => (
                    <button
                      key={cmd}
                      onClick={() => tapCommand(cmd)}
                      className={`text-xs ${style} px-3 py-1.5 rounded-full font-medium transition-colors`}
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-3 text-center">
                  Keyboard shortcut: <kbd className="bg-slate-200 px-1 rounded text-[10px]">Ctrl+Shift+A</kbd>
                </p>
              </div>
            )}

            {/* Cancel hint during expense flow */}
            {inExpenseFlow && convStep !== 'ask_confirm' && convStep !== 'ask_category' && (
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                Say <strong>"cancel"</strong> to abort
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceAssistant;
