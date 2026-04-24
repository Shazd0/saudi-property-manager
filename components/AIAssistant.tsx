/**
 * AIAssistant - Floating AI chatbot powered by Groq (Llama 3.3 70B).
 * Supports: English | Arabic | Malayalam | Hindi
 * Controls: understands app context + navigates to any page via [NAV:/route] tags.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, X, Send, Settings, Trash2, Minimize2, Maximize2, Sparkles, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../i18n';

// --- Types ---
interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

interface Props {
  currentUser?: any;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  onClose?: () => void;
}

// --- System prompt ---
const buildSystemPrompt = (userName: string, userRole: string) => `
You are "Amlak AI" — the expert built-in assistant for the Amlak Saudi Property Manager.
You have COMPLETE knowledge of every feature, field, button, and workflow in this app.
Current user: ${userName || 'Unknown'} | Role: ${userRole || 'Unknown'}

━━━ CORE BEHAVIOUR ━━━
For EVERY question about the app, you MUST:
1. Answer clearly (yes/no/how)
2. Say exactly WHERE to go and WHAT to click
3. End with [NAV:/route] to take them there automatically — NO asking permission, just do it

Trigger these automatic navigations:
"can I...?" / "where is...?" / "how do I...?" / "where can I...?" / "I want to..." / "show me..." / "open..." / "go to..." / "take me to..."

NEVER say "should I take you there?" — just include [NAV:/route] and go.

━━━ ALL PAGES & ROUTES ━━━

[/] DASHBOARD
- Overview: total income, expenses, net profit, cash & bank balances
- Building filter (multi-select), date range filter
- Contract status: Active / Expiring soon (90 days) / Expired counts
- Pending approvals count badge
- Monthly income/expense charts
- Quick action buttons: Add Entry, View History, Contracts, Reports
- Occupancy breakdown per building
- Collection performance stats

[/entry] ADD ENTRY (Income or Expense)
Income fields: date, building, unit, amount, VAT toggle, payment method (Cash/Bank/Cheque), bank name, cheque number, income category (Rental, Service Fee, Late Fee, Parking, etc.), contract auto-link, installment tracking, overpayment warning, VAT invoice generation, ZATCA QR code
Expense fields: category (General, Salary, Maintenance, Utilities, Borrowing, etc.), sub-category, recipient (Employee/Owner/Vendor/External), bonus/deduction, service agreement link, recurring flag, ref number
Special: Smart contract linking (auto-detects active contract when building+unit selected), installment balance tracking, carry-forward messaging for overpayments, stock deduction on sales

[/bulk-rent] BULK RENT ENTRY
- Select a building -> system loads all units with active contracts and outstanding balance
- Table: Unit, Customer, Expected Amount, Entered Amount (editable), Total Paid, Balance, Date (per-row), Payment Method (per-row), Bank (per-row)
- Select/deselect individual rows or all
- Preview total before submitting
- Submit all selected in one batch
- Admin/Manager entries go APPROVED immediately; Staff entries go PENDING
- Pre-fills expected installment amount per unit

[/contracts] CONTRACTS
Actions: Create, Edit, Finalize, Delete (to trash), Restore, Permanent Delete, Renew (auto-copies with new dates), Copy (duplicate template)
Views: FORM (entry/edit) / LIST (filters + search) / DETAILS (payment tracking)
Fields: Contract number (auto), building & unit (multi-unit), customer, period (months+days), from/to dates, annual rent, water fee, internet fee, office fee %, insurance fee, service fee, other add/deductions, upfront payment, total auto-calculated, installment count & amounts & dates, auto-payment flag, notes
Status: Active / Expiring (within 90 days) / Expired / Old
Filters: status, building, tenant, unit, date range, text search, deleted toggle

[/history] TRANSACTION HISTORY
- View complete ledger with status (Approved/Pending/Rejected)
- Actions: View Details, Edit Payment Method, Convert to VAT Invoice, Delete, Print/Export, Add Comment, Request Edit, Create Credit Note, Restore Stock
- Filters: date range, type (Income/Expense), building, payment method, status, customer/vendor/employee, text search, saved filter configs, show deleted toggle
- ZATCA QR code display for VAT invoices
- Approval workflow: staff submit modification requests, admin approves/rejects

[/monitoring] MONITORING
- Live financial KPI charts (Recharts)
- Income vs Expense trend lines
- Monthly breakdown charts
- Building comparison analytics
- Collection performance graphs

[/customers] CUSTOMERS
Actions: Add, Edit, Delete, Restore, Search/Filter, Import (Excel/PDF/CSV), Export to Excel, Upload photo
Fields: Name (Arabic + English), National ID or Iqama (Saudi validation), ID type, nationality, rating (1-5 stars), mobile (Saudi format 05XXXXXXXX), email, work address, national address (building#/street/district/city/postal code), VAT number (15 digits starting with 3), CR number (10 digits), email/SMS notification opt-in, blacklist flag, vehicle plates, room number, notes
Validation: Duplicate mobile/ID check, strict Saudi ID format, VAT format (15 digits starts with 3), CR format (10 digits starts with 1/2/7)
Auto-generates: Customer code (sequential)

[/properties] PROPERTIES / BUILDINGS
Actions: Add Building, Edit, Delete (trash), Restore, Restore All, Permanent Delete, Add Unit, Edit Unit, Delete Unit
Building fields: Name, Type (RESIDENTIAL / NON_RESIDENTIAL), VAT applicable (non-residential only), default bank account, IBAN
Unit fields: Unit name/number, default rent
Lease info (if building is leased): lease status, start/end dates, duration years, yearly/monthly rent, total contract rent, deposit given, landlord name, installment schedule, notes
Special: Cascade unit rename updates all linked contracts and transactions

[/directory] BUILDING DIRECTORY
- Public-facing unit availability listing
- Shows vacant/occupied status per unit
- Shareable link for property listings

[/calendar] CALENDAR
- Rent due dates
- Contract start/end events
- Task deadlines
- Visual monthly/weekly view

[/registry] CAR REGISTRY
- Add, edit, delete vehicle records
- Fields: plate number, owner (customer link), make, model, color, notes

[/approvals] APPROVAL CENTER (ADMIN/MANAGER only)
- Pending transactions needing approval
- Approve or Reject with comments
- Modification requests from staff
- Batch approve/reject
- Audit trail of approvals

[/vendors] VENDORS
- Add, edit, delete vendor records
- Fields: Name, VAT number, CR number, contact, service type, bank details
- Link to service agreements and expense transactions

[/service-agreements] SERVICE AGREEMENTS
- Contracts with vendors/contractors
- Fields: Vendor, service type, start/end dates, monthly value, payment schedule, notes

[/tasks] TASKS (Kanban Board)
- Columns: TODO, IN PROGRESS, DONE
- Add task -> goes to TODO
- Move between columns by clicking status buttons
- DONE tasks auto-delete after 2 seconds
- Fields: Title, Priority (auto-detected: HIGH for "urgent/leak/fire/broken", LOW for "cleaning/check", MEDIUM default)
- Admin sees all tasks; Staff sees only their own
- Task count badges per column

[/stocks] STOCK MANAGER
- Add item, Restock (increase qty), Issue/Sell (decrease qty), Delete item, View transaction log
- Fields: Item name, quantity, buying price, selling price, unit (pcs/box/bag)
- Issue modes: CONSUME (internal use) or SELL (generates revenue)
- ENGINEER role gets stocks-only access
- Transaction log: movement history, purpose, building/unit, customer, payment method

[/transfers] TRANSFERS
- Record bank transfers between accounts
- Fields: From bank, To bank, amount, date, reference, notes

[/borrowings] BORROWINGS / LOANS
- Track employee and external borrowings with repayments
- Types: BORROW, REPAYMENT, OPENING_BALANCE
- Per-employee: Total borrowed, Total repaid, Outstanding balance
- Admin/Manager: see all; Staff: see only their own

[/owner-portal] OWNER PORTAL
- Property owner view of their buildings
- Income/expense summaries per owner
- Net profit calculations

[/staff] STAFF PORTFOLIO (ADMIN/MANAGER only)
- Employee overview and portfolio assignments
- Performance tracking

[/chat] STAFF CHAT
- Internal team messaging
- Real-time communication between staff

[/sadad] SADAD
- Saudi bill payment system integration
- Generate SADAD payment references for tenants

[/ejar] EJAR
- Saudi Ministry of Housing rental platform integration
- Contract registration with Ejar

[/utilities] UTILITIES TRACKER
- Record and track electricity, water, gas meter readings per unit
- Fields: Building, Unit, Utility type, meter number, previous/current reading, date, rate, total cost (auto-calc), payment status
- Default rates: Electricity 0.18 SAR/kWh, Water 6.0 SAR/m3, Gas 0.75 SAR/unit
- Consumption = Current - Previous reading
- Filters: type, building, unit, meter#, date, payment status

[/security-deposits] SECURITY DEPOSITS
- Record tenant security deposits, deductions, and refunds per contract
- Deposit statuses: Held / Partially Refunded / Fully Refunded / Forfeited
- Deduction types: Damages, Unpaid Rent, Cleaning, Other
- Refund workflow: auto-calculates refundable = Deposit - Deductions - Already Refunded
- Dashboard: total held, total refunded, total deducted

[/whatsapp] WHATSAPP INTEGRATION
- Send WhatsApp messages to tenants
- Rent reminders and notifications

[/bank-reconciliation] BANK RECONCILIATION
- Import bank statements (CSV or manual entry)
- Auto-match statements to system transactions (amount tolerance 1 SAR, date within 3 days)
- Statuses: Matched / Unmatched / Disputed / Ignored
- Manual match/unmatch/dispute
- Dashboard: total statements, matched count, unmatched, discrepancies

[/nafath] NAFATH VERIFICATION
- Saudi national ID verification via Nafath service
- Verify tenant/customer identity

[/municipality-licenses] MUNICIPALITY LICENSES
- Track building licenses (rakhsa baladiya) with expiry alerts
- Fields: Building, License number, Type (Building Permit/Commercial/Safety/Operating), Issue date, Expiry date, Issuing authority, Cost, Reminder days, Status, Notes
- Status auto-updates: Active / Expiring Soon (within 30 days, shown amber) / Expired (shown red) / Renewal Pending / Suspended
- Alert system with color-coded expiry warnings and countdown

[/civil-defense] CIVIL DEFENSE COMPLIANCE
- Fire safety and civil defense certificate tracking
- Inspection records and compliance status

[/absher] ABSHER INTEGRATION
- Saudi Absher government platform integration
- Worker registration and verification

[/vat-report] VAT REPORT (ZATCA)
- Views: Sales (income with VAT) / Purchase (expense with VAT) / Combined
- Quick entry: Add Sales Invoice or Expense Invoice directly
- Fields shown: Customer/Vendor, Invoice#, Amount (excl. VAT), VAT (15%), Total (incl.), VAT number, date
- ZATCA QR code generation and display
- Company VAT pre-filled: 312610089400003
- Credit note creation (invoice reversal)
- VAT format: 15 digits starting with 3

[/accounting] ACCOUNTING MODULE
Tabs: Chart of Accounts / Journal Entries / General Ledger / Trial Balance / Income Statement / Balance Sheet / Cash Flow / Payables / Receivables / Budget vs Actual
Account codes: Assets 1000-1500, Liabilities 2000-2400, Equity 3000-3200, Revenue 4000-4200, Expenses 5000-5700
Export: PDF, Excel

[/reports] REPORTS
Tabs: Overview / Financial / Occupancy / Tenant / Expense / Salary / Building / Collection / Owner Expense
Features: Date presets (This Month/Last Month/Quarter/Year/Custom), building filter, owner filter, print, export Excel/PDF
Calculations: Monthly aggregations, net profit, collection rate %, outstanding balances, year-over-year comparison

[/help] HELP
- Full app documentation and user guides

[/about] ABOUT
- App version and info

[/settings] SETTINGS
Tabs: System (dark mode, compact UI, language, currency, company name, expense budget) / Opening Balances (cash/bank per building) / Bank Accounts (add/edit/delete IBAN) / Backup & Recovery (manual/auto backup, restore) / Offline Sync (export/import sync package) / Audit Log (all changes, filter by user/action/date) / Password Reset (Admin only) / Profile Photo / Screen Time Analytics

[/admin/employees] EMPLOYEES (ADMIN only)
- Add, edit, delete staff accounts
- Fields: Name, username, password, role (ADMIN/MANAGER/ACCOUNTANT/ENGINEER/VIEWER), phone, email, hire date
- Role assignment controls access across entire app

[/admin/backup] BACKUP (ADMIN only)
- Manual data backup and restore

[/admin/cloud-backup] CLOUD BACKUP (ADMIN only)
- Google Drive backup integration

[/admin/bulk-import] BULK IMPORT (ADMIN only)
- Import customers from Excel/CSV files

[/admin/books] BOOKS MANAGER (ADMIN only)
- Multi-book accounting (separate book sets for different entities)
- Switch between books

━━━ USER ROLES & ACCESS ━━━
ADMIN: Full access to everything including employee management, backups, approvals, bulk import, delete anything
MANAGER: Most access, approvals, staff portfolio — cannot manage employees or system backup
ACCOUNTANT: Financial pages (entry, history, reports, VAT, accounting) — no employee/building management
ENGINEER: Stock manager only (/stocks and /settings)
VIEWER: Read-only access to dashboard and reports

━━━ KEY BUSINESS RULES ━━━
- VAT in Saudi Arabia is 15% (required for non-residential commercial properties)
- ZATCA = Saudi tax authority electronic invoicing compliance
- Saudi VAT number format: 15 digits starting AND ending with 3
- Saudi CR number: 10 digits starting with 1, 2, or 7
- Saudi mobile: starts with 05, total 10 digits
- Income entries by non-admin go to PENDING status until admin/manager approves
- Security deposits are tracked separately from income (not counted as revenue until forfeited)
- Contracts can be ACTIVE, EXPIRING (within 90 days), EXPIRED, or OLD (archived)
- Installments: system tracks total paid vs total contract value per unit
- Overpayment: if payment exceeds remaining installment, a warning is shown and the excess is noted for carry-forward
- Buildings can be RESIDENTIAL (no VAT usually) or NON_RESIDENTIAL (VAT applicable if toggled)
- Each building can have separate cash and bank opening balances
- SADAD: Saudi payment system for automated bill collection from tenants
- Ejar: Saudi government platform for registering rental contracts officially
- Nafath: Saudi digital identity verification service

━━━ STEP-BY-STEP GUIDES ━━━

HOW TO ADD RENT PAYMENT:
1. Go to Entry (/entry)
2. Select "Income"
3. Choose building and unit — system auto-links active contract
4. Enter amount (system shows expected installment and remaining balance)
5. Select payment method and bank if needed
6. Click Save
Alternative for many units at once: use Bulk Rent Entry (/bulk-rent)

HOW TO CREATE A CONTRACT:
1. Go to Contracts (/contracts)
2. Click "New Contract"
3. Select customer (must exist in /customers first)
4. Select building and unit
5. Set dates: from date, contract period (months + days)
6. Enter rent amount, fees (water/internet/service), installment count
7. System auto-calculates total value and installment dates
8. Click Save

HOW TO ADD A NEW CUSTOMER:
1. Go to Customers (/customers)
2. Click "Add Customer"
3. Enter name (Arabic + English), national ID or Iqama, mobile (05XXXXXXXX format)
4. Optional: nationality, rating, email, address, VAT number, vehicles
5. Click Save — system auto-assigns customer code

HOW TO ADD A BUILDING:
1. Go to Properties (/properties)
2. Click "Add Building"
3. Enter building name and type (Residential or Non-Residential)
4. If Non-Residential: optionally enable VAT applicable
5. Add default bank account name and IBAN
6. Click Save, then add units inside the building

HOW TO RECORD AN EXPENSE:
1. Go to Entry (/entry)
2. Select "Expense"
3. Choose category (Salary/Maintenance/Utilities/General/etc.)
4. Choose sub-category if applicable
5. Select recipient (Employee, Vendor, Owner, or External)
6. Enter amount, date, payment method
7. Click Save

HOW TO GENERATE VAT INVOICE / ZATCA QR:
1. When adding an entry, toggle "VAT Invoice" on
2. System generates ZATCA-compliant QR code
3. Or go to /history, find any existing transaction, click "Convert to VAT"
4. Or go to /vat-report for dedicated VAT entry and report

HOW TO APPROVE A PENDING TRANSACTION:
1. Admin/Manager only
2. Go to Approvals (/approvals)
3. Find the pending transaction
4. Click Approve or Reject with optional comment
Or: from /history, filter by "Pending" status

HOW TO DO BULK RENT COLLECTION:
1. Go to /bulk-rent
2. Select building
3. System loads all units with outstanding balances
4. Review and adjust amounts per unit
5. Select rows to include
6. Click Preview, then Submit

HOW TO TRACK SECURITY DEPOSITS:
1. Go to /security-deposits
2. Click "Record Deposit" and link to a contract
3. Enter deposit amount and payment method
4. To deduct: click "Add Deduction" on the deposit record
5. To refund: click "Process Refund" — system calculates refundable amount

HOW TO TRACK UTILITY BILLS:
1. Go to /utilities
2. Click "Record Reading"
3. Select building, unit, utility type (Electricity/Water/Gas)
4. Enter current meter reading (system auto-fills previous reading)
5. System calculates consumption and cost at default rates
6. Mark as Paid or Unpaid

HOW TO RECONCILE BANK STATEMENTS:
1. Go to /bank-reconciliation
2. Import bank statement (paste CSV or add manually)
3. Click "Auto-match" for system to match transactions
4. Review unmatched items and manually match or dispute

HOW TO TRACK EMPLOYEE BORROWINGS:
1. Go to /entry and select Expense > Borrowing category
2. Or go to /borrowings to view the full borrowing tracker
3. Record BORROW transactions when money is given
4. Record REPAYMENT transactions when money is returned
5. Outstanding balance = Total Borrowed - Total Repaid

HOW TO MANAGE INVENTORY:
1. Go to /stocks
2. Add items with name, quantity, prices
3. Click "Restock" to add inventory (purchases)
4. Click "Issue" to consume internally or "Sell" to sell to customer
5. View transaction log for movement history

HOW TO TRACK MUNICIPALITY LICENSES:
1. Go to /municipality-licenses
2. Click "Add License" and enter building, license number, type, dates
3. Set reminder days (default 30 days before expiry)
4. System shows countdown and color-coded alerts: green=OK, amber=expiring soon, red=expired

━━━ NAVIGATION RULE ━━━
ALWAYS end every reply with [NAV:/route] when you know the right page.
Only ONE [NAV:...] tag per message, at the very end.
Never add explanatory text after the [NAV:...] tag.

━━━ LANGUAGE RULE ━━━
Detect user language and reply in the SAME language always.
- If Arabic -> reply fully in Arabic
- If Malayalam -> reply fully in Malayalam
- If Hindi -> reply fully in Hindi
- If English -> reply in English
Mixed input -> use the dominant language

━━━ TONE ━━━
Direct, helpful, action-oriented. Give the answer AND take them there. Use bullet points for steps. Keep it concise.
`;

// --- Quick suggestion chips ---
const QUICK_SUGGESTIONS = [
  { label: 'Can I edit a customer?',       emoji: '\u270F\uFE0F' },
  { label: 'Where can I add rent?',        emoji: '\uD83D\uDCB0' },
  { label: 'How do I add a contract?',     emoji: '\uD83D\uDCC4' },
  { label: 'Where is the VAT report?',     emoji: '\uD83D\uDCCA' },
  { label: 'Can I delete a transaction?',  emoji: '\uD83D\uDDD1\uFE0F' },
  { label: 'Where can I add a building?',  emoji: '\uD83C\uDFE2' },
];

// --- Groq API call ---
async function callGroq(apiKey: string, history: Message[], systemPrompt: string, userMessage: string): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
    { role: 'user', content: userMessage },
  ];
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 1024, temperature: 0.7 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '(No response)';
}

// --- Parse navigation command out of AI text ---
function extractNav(text: string): { clean: string; route: string | null } {
  const match = text.match(/\[NAV:(\/[^\]]*)\]/);
  if (!match) return { clean: text, route: null };
  return { clean: text.replace(match[0], '').trim(), route: match[1] };
}

// --- Local storage helpers ---
const LS_KEY_APIKEY  = 'amlak_ai_gemini_key';
const LS_KEY_HISTORY = 'amlak_ai_chat_history';

// Optionally seed from env on first run
(function seedGroq() {
  const envKey = (import.meta as any)?.env?.VITE_GROQ_API_KEY as string | undefined;
  if (!localStorage.getItem(LS_KEY_APIKEY) && envKey) {
    localStorage.setItem(LS_KEY_APIKEY, envKey);
  }
})();

function loadKey(): string { return localStorage.getItem(LS_KEY_APIKEY) || ''; }
function saveKey(k: string) { localStorage.setItem(LS_KEY_APIKEY, k); }
function loadHistory(): Message[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY_HISTORY) || '[]'); }
  catch { return []; }
}
function saveHistory(h: Message[]) {
  try { localStorage.setItem(LS_KEY_HISTORY, JSON.stringify(h.slice(-60))); }
  catch { /* ignore */ }
}

// --- Render markdown-lite (bold, line-breaks) ---
function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    return p.split('\n').map((line, j) => (
      <React.Fragment key={`${i}-${j}`}>
        {line}
        {j < p.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  });
}

// --- Main component ---
const AIAssistant: React.FC<Props> = ({ currentUser, defaultOpen, hideTrigger, onClose }) => {
  const navigate = useNavigate();
  const { t }    = useLanguage();

  const [open, setOpen]                   = useState(defaultOpen ?? false);
  const [minimized, setMinimized]         = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [apiKey, setApiKey]               = useState(loadKey);
  const [keyInput, setKeyInput]           = useState('');
  const [showKey, setShowKey]             = useState(false);
  const [messages, setMessages]           = useState<Message[]>(loadHistory);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const userName     = currentUser?.name || currentUser?.displayName || 'User';
  const userRole     = currentUser?.role || '';
  const systemPrompt = buildSystemPrompt(userName, userRole);
  const hasKey       = !!apiKey;

  useEffect(() => { saveHistory(messages); }, [messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => {
    if (open && !minimized && !showSettings) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, minimized, showSettings]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    if (!hasKey) { setShowSettings(true); return; }

    const userMsg: Message = { role: 'user', text: msg, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const raw = await callGroq(apiKey, messages, systemPrompt, msg);
      const { clean, route } = extractNav(raw);
      setMessages(prev => [...prev, { role: 'assistant', text: clean, timestamp: Date.now() }]);
      if (route) setTimeout(() => { navigate(route!); setMinimized(true); }, 600);
    } catch (e: any) {
      const errMsg: string = e.message || 'Something went wrong.';
      if (errMsg.toLowerCase().includes('401') || errMsg.toLowerCase().includes('invalid') || errMsg.toLowerCase().includes('api_key')) {
        setError('INVALID_KEY');
      } else if (errMsg.toLowerCase().includes('429') || errMsg.toLowerCase().includes('rate') || errMsg.toLowerCase().includes('limit')) {
        setError('RATE_LIMIT');
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [input, apiKey, messages, systemPrompt, navigate, hasKey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => { setMessages([]); localStorage.removeItem(LS_KEY_HISTORY); };

  const saveSettings = () => {
    const k = keyInput.trim();
    saveKey(k);
    setApiKey(k);
    setKeyInput('');
    setShowSettings(false);
  };

  return (
    <>
      {open && (
        <div
          className={`fixed z-[96] flex flex-col overflow-hidden transition-all duration-300 ${
            minimized
              ? 'bottom-[88px] md:bottom-16 right-4 w-60 h-12 rounded-2xl'
              : 'bottom-[88px] md:bottom-16 right-4 rounded-3xl'
          }`}
          style={minimized
            ? { boxShadow: '0 4px 24px rgba(99,102,241,0.35)' }
            : {
                width: 'min(400px, calc(100vw - 24px))',
                height: 'min(600px, calc(100vh - 120px))',
                boxShadow: '0 24px 64px rgba(99,102,241,0.28), 0 0 0 1px rgba(255,255,255,0.12)',
              }
          }
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0 select-none"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)' }}
          >
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 rounded-xl flex items-center justify-center bg-white/15 backdrop-blur-sm flex-shrink-0">
                <Sparkles size={16} className="text-white" />
                {hasKey && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-400 rounded-full border-2 border-[#7c3aed]" />
                )}
              </div>
              <div>
                <div className="font-bold text-sm tracking-tight">Amlak AI</div>
                {!minimized && (
                  <div className="text-[10px] text-purple-200 leading-tight">
                    {hasKey ? '\u26A1 Groq \u00B7 Llama 3.3 \u00B7 Ready' : '\u26A0\uFE0F API key required'}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {!minimized && (
                <>
                  <button onClick={() => setShowSettings(v => !v)} title={t('nav.settings')}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-all">
                    <Settings size={14} />
                  </button>
                  <button onClick={clearChat} title="Clear chat"
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-all">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              <button onClick={() => setMinimized(v => !v)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all">
                {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button onClick={() => { setOpen(false); onClose?.(); }}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all">
                <X size={14} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Settings panel */}
              {showSettings ? (
                <div className="flex-1 overflow-y-auto bg-white">
                  <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Bot size={18} className="text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Groq AI</div>
                        <div className="text-xs text-slate-500">Llama 3.3 70B &middot; 14,400 req/day free</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Status badge */}
                    {hasKey ? (
                      <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                        <div className="h-8 w-8 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-bold">&#10003;</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-emerald-800">Connected</div>
                          <div className="text-xs text-emerald-600 truncate font-mono">
                            {apiKey.slice(0, 8)}&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;{apiKey.slice(-4)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                        <div className="h-8 w-8 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-bold">!</span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-amber-800">No API key</div>
                          <div className="text-xs text-amber-600">Paste your Groq key below</div>
                        </div>
                      </div>
                    )}

                    {/* Key input */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {hasKey ? 'Update API Key' : 'Enter API Key'}
                      </label>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          placeholder="gsk_..."
                          value={keyInput}
                          onChange={e => setKeyInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && keyInput.trim() && saveSettings()}
                          className="w-full px-4 py-3 pr-10 border-2 border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-400 font-mono transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <button
                        onClick={saveSettings}
                        disabled={!keyInput.trim()}
                        className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99]"
                        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                      >
                        Save &amp; Connect
                      </button>
                      {hasKey && (
                        <button
                          onClick={() => { saveKey(''); setApiKey(''); setKeyInput(''); }}
                          className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition-colors"
                        >
                          Remove Key
                        </button>
                      )}
                    </div>

                    {/* How to get key */}
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-2.5">
                      <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">Get a free key</div>
                      <div className="space-y-2">
                        {[
                          { step: '1', text: 'Go to console.groq.com' },
                          { step: '2', text: 'Sign up free — no credit card' },
                          { step: '3', text: 'Click API Keys \u2192 Create API Key' },
                          { step: '4', text: 'Copy and paste the gsk_... key above' },
                        ].map(({ step, text }) => (
                          <div key={step} className="flex items-start gap-2.5">
                            <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {step}
                            </span>
                            <span className="text-xs text-slate-600 leading-relaxed">{text}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                        <span>\uD83C\uDF81</span>
                        <span><strong>14,400 requests/day</strong> &mdash; completely free, no credit card</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5">
                    <button
                      onClick={() => setShowSettings(false)}
                      className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                    >
                      &larr; Back to Chat
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Messages area */}
                  <div
                    className="flex-1 overflow-y-auto p-3 space-y-3"
                    style={{ background: 'linear-gradient(180deg, #f8f7ff 0%, #f1f0ff 100%)' }}
                  >
                    {/* Welcome screen */}
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full gap-5 py-4 px-2">
                        <div className="relative">
                          <div
                            className="h-20 w-20 rounded-3xl flex items-center justify-center shadow-xl"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #9333ea)' }}
                          >
                            <Sparkles size={32} className="text-white" />
                          </div>
                          {hasKey && (
                            <span className="absolute -bottom-1 -right-1 bg-emerald-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
                              LIVE
                            </span>
                          )}
                        </div>

                        <div className="text-center space-y-1">
                          <div className="font-extrabold text-slate-900 text-lg tracking-tight">Amlak AI</div>
                          <div className="text-xs text-slate-500 leading-relaxed max-w-[260px]">
                            Ask anything about your properties &mdash; I'll answer <em>and</em> take you right there.
                          </div>
                          <div className="text-[11px] text-indigo-400 font-medium pt-1">
                            English &middot; {'\u0627\u0644\u0639\u0631\u0628\u064A\u0629'} &middot; {'\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02'} &middot; {'\u0939\u093F\u0928\u094D\u0926\u0940'}
                          </div>
                        </div>

                        {!hasKey ? (
                          <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-lg hover:scale-105 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                          >
                            <Settings size={15} /> Connect Groq API Key
                          </button>
                        ) : (
                          <div className="w-full space-y-2">
                            <div className="text-[11px] text-slate-400 text-center font-medium">Try asking...</div>
                            {QUICK_SUGGESTIONS.map(s => (
                              <button
                                key={s.label}
                                onClick={() => sendMessage(s.label)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-100 hover:border-indigo-200 transition-all text-left shadow-sm"
                              >
                                <span className="text-base flex-shrink-0">{s.emoji}</span>
                                <span className="flex-1">{s.label}</span>
                                <ChevronRight size={13} className="text-slate-300 flex-shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message bubbles */}
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div
                            className="h-7 w-7 rounded-xl flex-shrink-0 flex items-center justify-center mb-0.5"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #9333ea)' }}
                          >
                            <Sparkles size={12} className="text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'text-white rounded-2xl rounded-br-sm'
                              : 'text-slate-800 bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-sm'
                          }`}
                          style={msg.role === 'user'
                            ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }
                            : undefined
                          }
                        >
                          {renderText(msg.text)}
                          <div className={`text-[9px] mt-1.5 ${msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Typing dots */}
                    {loading && (
                      <div className="flex items-end gap-2 justify-start">
                        <div
                          className="h-7 w-7 rounded-xl flex-shrink-0 flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, #4f46e5, #9333ea)' }}
                        >
                          <Sparkles size={12} className="text-white" />
                        </div>
                        <div className="bg-white border border-slate-100 shadow-sm px-4 py-3.5 rounded-2xl rounded-bl-sm">
                          <div className="flex gap-1.5 items-center">
                            {[0, 150, 300].map(delay => (
                              <span
                                key={delay}
                                className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce"
                                style={{ animationDelay: `${delay}ms` }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {error && (
                      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2">
                        {error === 'INVALID_KEY' ? (
                          <>
                            <div className="font-semibold text-rose-700 text-sm">Invalid API key</div>
                            <div className="text-xs text-rose-600">Your Groq key is expired or incorrect.</div>
                            <button
                              onClick={() => setShowSettings(true)}
                              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
                            >
                              Update Key &rarr;
                            </button>
                          </>
                        ) : error === 'RATE_LIMIT' ? (
                          <>
                            <div className="font-semibold text-rose-700 text-sm">Rate limit reached</div>
                            <div className="text-xs text-rose-600">Groq free tier: 14,400 requests/day. Try again in a moment.</div>
                          </>
                        ) : (
                          <div className="text-xs text-rose-700">{error}</div>
                        )}
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input area */}
                  <div className="bg-white border-t border-slate-100 px-3 py-3 flex-shrink-0">
                    <div className="flex gap-2 items-end">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={hasKey ? 'Ask anything...' : 'Connect API key to start \u2192'}
                        disabled={!hasKey || loading}
                        rows={1}
                        className="flex-1 resize-none px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
                        style={{ maxHeight: '96px', overflowY: 'auto' }}
                      />
                      {hasKey ? (
                        <button
                          onClick={() => sendMessage()}
                          disabled={loading || !input.trim()}
                          className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 hover:scale-110 active:scale-95 shadow-md"
                          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                        >
                          {loading
                            ? <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : <Send size={15} />
                          }
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowSettings(true)}
                          className="flex-shrink-0 h-10 px-3 rounded-xl flex items-center gap-1.5 text-white text-xs font-bold shadow-md"
                          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                        >
                          <Settings size={12} /> Setup
                        </button>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1.5 text-center tracking-wide">
                      GROQ &middot; LLAMA 3.3 70B &middot; SHIFT+ENTER FOR NEW LINE
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Floating trigger */}
      {!hideTrigger && (
        <button
          onClick={() => { setOpen(v => !v); setMinimized(false); }}
          className="fixed bottom-20 md:bottom-6 right-4 z-[90] h-[58px] w-[58px] rounded-2xl text-white flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group"
          style={{
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #9333ea)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.45), 0 2px 8px rgba(0,0,0,0.1)',
          }}
          title="Amlak AI"
        >
          {open ? <X size={22} /> : <Bot size={22} className="group-hover:scale-110 transition-transform" />}
          {!open && <span className="absolute inset-0 rounded-2xl bg-indigo-400 animate-ping opacity-20" />}
          {!open && (
            <span className="absolute -top-1.5 -right-1.5 bg-white text-indigo-600 text-[9px] font-extrabold rounded-full px-1.5 py-0.5 border border-indigo-100 shadow-sm leading-tight">
              AI
            </span>
          )}
        </button>
      )}
    </>
  );
};

export default AIAssistant;
