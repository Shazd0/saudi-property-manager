import React, { useState, useEffect, useMemo } from 'react';
import { Scale, Upload, Search, CheckCircle, XCircle, AlertTriangle, X, Link2, Eye, Filter, FileText } from 'lucide-react';
import { useToast } from './Toast';
import { getBankStatements, saveBankStatement, deleteBankStatement, getReconciliationRecords, saveReconciliationRecord, getTransactions, getBanks } from '../services/firestoreService';
import type { BankStatement, ReconciliationRecord, Transaction } from '../types';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

/**
 * Bank Reconciliation Tool
 * 
 * Match bank statements against recorded transactions to catch discrepancies.
 * - Import bank statements (manual entry or CSV paste)
 * - Auto-match: amount + date proximity + reference matching
 * - Manual match/unmatch support
 * - Reconciliation status dashboard
 * - Discrepancy highlighting (unmatched on either side)
 * - Export reconciliation report
 */

const STATUS_COLORS: Record<string, string> = {
  Matched: 'bg-emerald-100 text-emerald-700',
  Unmatched: 'bg-amber-100 text-amber-700',
  Disputed: 'bg-rose-100 text-rose-700',
  Ignored: 'bg-slate-100 text-slate-500',
};

const BankReconciliation: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const { showSuccess, showError } = useToast();
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [manualEntry, setManualEntry] = useState({ bankName: '', transactionDate: '', description: '', referenceNo: '', debit: 0, credit: 0 });
  const [matchModal, setMatchModal] = useState<BankStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'statements' | 'unmatched'>('statements');

  const load = async () => {
    setLoading(true);
    try {
      const [s, r, t, b] = await Promise.all([getBankStatements(), getReconciliationRecords(), getTransactions(), getBanks()]);
      setStatements((s || []) as BankStatement[]);
      setReconciliations((r || []) as ReconciliationRecord[]);
      setTransactions((t || []) as Transaction[]);
      setBanks(b || []);
    } catch (err) { console.error('Failed to load bank data', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Reconciliation lookup map
  const reconMap = useMemo(() => {
    const map: Record<string, ReconciliationRecord> = {};
    reconciliations.forEach(r => { map[r.bankStatementId] = r; });
    return map;
  }, [reconciliations]);

  // Matched transaction IDs
  const matchedTxIds = useMemo(() => new Set(reconciliations.filter(r => r.transactionId).map(r => r.transactionId!)), [reconciliations]);

  // Add manual statement entry
  const addManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    SoundService.play('submit');
    if (!manualEntry.bankName || !manualEntry.transactionDate) { showError('Bank name and date required'); return; }
    const stmt: BankStatement = {
      id: crypto.randomUUID(),
      bankName: manualEntry.bankName,
      transactionDate: manualEntry.transactionDate,
      statementDate: manualEntry.transactionDate,
      description: manualEntry.description,
      referenceNo: manualEntry.referenceNo,
      debit: Number(manualEntry.debit) || 0,
      credit: Number(manualEntry.credit) || 0,
      createdAt: Date.now(),
    };
    try {
      await saveBankStatement(stmt);
      showSuccess('Statement entry added');
      setManualEntry({ bankName: '', transactionDate: '', description: '', referenceNo: '', debit: 0, credit: 0 });
      load();
    } catch (err: any) { showError(err.message || 'Failed to save statement'); }
  };

  // Parse CSV text to statements
  const importCSV = async () => {
    if (!csvText.trim()) { showError('Paste CSV data first'); return; }
    const lines = csvText.trim().split('\n');
    let imported = 0;
    for (let i = 1; i < lines.length; i++) { // Skip header
      const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      if (cols.length < 4) continue;
      const stmt: BankStatement = {
        id: crypto.randomUUID(),
        bankName: selectedBank || cols[0] || 'Unknown',
        transactionDate: cols[1] || new Date().toISOString().slice(0, 10),
        statementDate: cols[1] || new Date().toISOString().slice(0, 10),
        description: cols[2] || '',
        referenceNo: cols[3] || '',
        debit: Number(cols[4]) || 0,
        credit: Number(cols[5]) || 0,
        importBatchId: `batch-${Date.now()}`,
        createdAt: Date.now(),
      };
      await saveBankStatement(stmt);
      imported++;
    }
    showSuccess(`Imported ${imported} statement entries`);
    setCsvText('');
    setIsEntryOpen(false);
    load();
  };

  // Auto-match algorithm
  const autoMatch = async () => {
    let matchCount = 0;
    const unmatchedStatements = statements.filter(s => !reconMap[s.id]);
    const unmatchedTransactions = transactions.filter(t => !matchedTxIds.has(t.id) && t.paymentMethod === 'BANK');

    for (const stmt of unmatchedStatements) {
      const stmtAmount = stmt.credit || stmt.debit;
      const stmtDate = new Date(stmt.transactionDate).getTime();
      
      // Find best match: same amount within 3 days
      let bestMatch: Transaction | null = null;
      let bestScore = 0;

      for (const tx of unmatchedTransactions) {
        if (matchedTxIds.has(tx.id)) continue;
        const txDate = new Date(tx.date).getTime();
        const dateDiff = Math.abs(stmtDate - txDate) / 86400000; // days
        
        const amountMatch = Math.abs(tx.amount - stmtAmount) < 1; // Within 1 SAR
        const dateClose = dateDiff <= 3;
        const refMatch = stmt.referenceNo && stmt.description?.includes(tx.id?.slice(-6));
        
        let score = 0;
        if (amountMatch) score += 50;
        if (dateClose) score += 30;
        if (refMatch) score += 20;
        if (dateDiff < 1) score += 10;

        if (score > bestScore && score >= 50) {
          bestScore = score;
          bestMatch = tx;
        }
      }

      if (bestMatch) {
        const recon: ReconciliationRecord = {
          id: crypto.randomUUID(),
          bankStatementId: stmt.id,
          transactionId: bestMatch.id,
          status: 'Matched',
          matchType: 'Auto',
          matchConfidence: bestScore,
          createdAt: Date.now(),
        };
        await saveReconciliationRecord(recon);
        matchedTxIds.add(bestMatch.id);
        matchCount++;
      }
    }

    showSuccess(`Auto-matched ${matchCount} entries`);
    load();
  };

  // Manual match
  const manualMatch = async (stmtId: string, txId: string) => {
    const recon: ReconciliationRecord = {
      id: crypto.randomUUID(),
      bankStatementId: stmtId,
      transactionId: txId,
      status: 'Matched',
      matchType: 'Manual',
      matchConfidence: 100,
      createdAt: Date.now(),
    };
    await saveReconciliationRecord(recon);
    showSuccess('Matched manually');
    setMatchModal(null);
    load();
  };

  const filtered = statements.filter(s => {
    const r = reconMap[s.id];
    const matchSearch = !search || s.description.toLowerCase().includes(search.toLowerCase()) || (s.referenceNo || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || (r?.status || 'Unmatched') === filterStatus;
    const matchBank = !selectedBank || s.bankName === selectedBank;
    const matchDate = (!dateFrom || s.transactionDate >= dateFrom) && (!dateTo || s.transactionDate <= dateTo);
    return matchSearch && matchStatus && matchBank && matchDate;
  }).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

  const unmatchedSystemTx = transactions.filter(t => !matchedTxIds.has(t.id) && t.paymentMethod === 'BANK');

  const stats = {
    totalStatements: statements.length,
    matched: reconciliations.filter(r => r.status === 'Matched').length,
    unmatched: statements.length - reconciliations.filter(r => r.status === 'Matched').length,
    unmatchedSystem: unmatchedSystemTx.length,
    totalDebit: statements.reduce((s, st) => s + st.debit, 0),
    totalCredit: statements.reduce((s, st) => s + st.credit, 0),
  };

  return (
    <div className="px-3 sm:px-6 pt-2 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="text-emerald-600" /> Bank Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-1">Match bank statements against system transactions to catch discrepancies</p>
        </div>
        <div className="flex gap-2">
          <button onClick={autoMatch} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 flex items-center gap-1"><Link2 size={14} /> Auto-Match</button>
          <button onClick={() => setIsEntryOpen(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 flex items-center gap-1"><Upload size={14} /> Import / Add</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-slate-700">{stats.totalStatements}</div><div className="text-xs text-slate-500">Bank Entries</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{stats.matched}</div><div className="text-xs text-slate-500">Matched</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.unmatched}</div><div className="text-xs text-slate-500">Unmatched (Bank)</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-rose-600">{stats.unmatchedSystem}</div><div className="text-xs text-slate-500">Unmatched (System)</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-blue-600">{stats.totalCredit.toLocaleString()}</div><div className="text-xs text-slate-500">Total Credits (SAR)</div></div>
        <div className="ios-card p-4 text-center"><div className="text-2xl font-bold text-orange-600">{stats.totalDebit.toLocaleString()}</div><div className="text-xs text-slate-500">Total Debits (SAR)</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('statements')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'statements' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
          {t('bank.tab.statements')} ({statements.length})
        </button>
        <button onClick={() => setActiveTab('unmatched')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'unmatched' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
          {t('bank.tab.unmatched')} ({unmatchedSystemTx.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder={t('entry.search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" /></div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-xl text-sm"><option value="">{t('history.allStatus')}</option><option>Matched</option><option>Unmatched</option><option>Disputed</option><option>Ignored</option></select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border rounded-xl text-sm" />
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : activeTab === 'statements' ? (
        filtered.length === 0 ? (
          <div className="text-center py-12"><Scale size={48} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-400">No bank statements found. Import or add entries to start reconciling.</p></div>
        ) : (
          <div className="space-y-2">
            {filtered.map(stmt => {
              const recon = reconMap[stmt.id];
              const status = recon?.status || 'Unmatched';
              const matchedTx = recon?.transactionId ? transactions.find(t => t.id === recon.transactionId) : null;
              return (
                <div key={stmt.id} className="ios-card p-3">
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-400">{stmt.transactionDate}</span>
                        <span className="text-xs font-medium text-slate-500">{stmt.bankName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>{status}</span>
                        {recon?.matchConfidence && <span className="text-xs text-slate-400">{recon.matchConfidence}% confidence</span>}
                      </div>
                      <p className="text-sm font-medium">{stmt.description}</p>
                      {stmt.referenceNo && <p className="text-xs text-slate-400">Ref: {stmt.referenceNo}</p>}
                      {matchedTx && <p className="text-xs text-emerald-600 mt-1">→ Matched: {matchedTx.details} ({new Date(matchedTx.date).toLocaleDateString()})</p>}
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      {stmt.credit > 0 && <span className="text-lg font-bold text-emerald-600">+{stmt.credit.toLocaleString()}</span>}
                      {stmt.debit > 0 && <span className="text-lg font-bold text-rose-600">-{stmt.debit.toLocaleString()}</span>}
                      {status === 'Unmatched' && (
                        <button onClick={() => setMatchModal(stmt)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Link2 size={12} /> Match</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {unmatchedSystemTx.length === 0 ? (
            <div className="text-center py-12 text-slate-400">All bank transactions are matched!</div>
          ) : unmatchedSystemTx.map(tx => (
            <div key={tx.id} className="ios-card p-3 border-l-4 border-amber-400">
              <div className="flex justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-400">{tx.date}</span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">No bank match</span>
                  </div>
                  <p className="text-sm font-medium">{tx.details}</p>
                  <p className="text-xs text-slate-400">{tx.buildingName} {tx.unitNumber ? `/ ${tx.unitNumber}` : ''} • {tx.bankName || 'Bank'}</p>
                </div>
                <div className="text-lg font-bold text-emerald-600">{tx.amount.toLocaleString()} SAR</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import / Manual Entry Modal */}
      {isEntryOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setIsEntryOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Bank Statements</h2>
              <button onClick={() => setIsEntryOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            {/* Manual Entry */}
            <h3 className="font-semibold text-sm mb-2">Manual Entry</h3>
            <form onSubmit={addManualEntry} className="space-y-3 mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <input type="text" placeholder="Bank Name *" value={manualEntry.bankName} onChange={e => setManualEntry({ ...manualEntry, bankName: e.target.value })} className="border rounded-xl px-3 py-2 text-sm" required />
                <input type="date" value={manualEntry.transactionDate} onChange={e => setManualEntry({ ...manualEntry, transactionDate: e.target.value })} className="border rounded-xl px-3 py-2 text-sm" required />
                <input type="text" placeholder="Ref No" value={manualEntry.referenceNo} onChange={e => setManualEntry({ ...manualEntry, referenceNo: e.target.value })} className="border rounded-xl px-3 py-2 text-sm" />
                <input type="text" placeholder={t('entry.description')} value={manualEntry.description} onChange={e => setManualEntry({ ...manualEntry, description: e.target.value })} className="border rounded-xl px-3 py-2 text-sm col-span-2 sm:col-span-1" />
                <input type="number" placeholder="Credit" value={manualEntry.credit || ''} onChange={e => setManualEntry({ ...manualEntry, credit: Number(e.target.value) })} className="border rounded-xl px-3 py-2 text-sm" min="0" step="0.01" />
                <input type="number" placeholder="Debit" value={manualEntry.debit || ''} onChange={e => setManualEntry({ ...manualEntry, debit: Number(e.target.value) })} className="border rounded-xl px-3 py-2 text-sm" min="0" step="0.01" />
              </div>
              <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm">Add Entry</button>
            </form>
            {/* CSV Import */}
            <h3 className="font-semibold text-sm mb-2">Import from CSV</h3>
            <p className="text-xs text-slate-400 mb-2">Format: BankName, Date, Description, Reference, Debit, Credit</p>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm font-mono" rows={6} placeholder="Paste CSV data here..." />
            <div className="flex gap-2 mt-2">
              <button onClick={importCSV} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">Import CSV</button>
              <button onClick={() => setIsEntryOpen(false)} className="px-4 py-2 border rounded-xl text-sm">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Match Modal */}
      {matchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setMatchModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Match Bank Entry</h2>
              <button onClick={() => setMatchModal(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm">
              <p className="font-medium">{matchModal.description}</p>
              <p className="text-xs text-slate-500">{matchModal.transactionDate} • {matchModal.bankName} • {matchModal.credit > 0 ? `Credit: ${matchModal.credit}` : `Debit: ${matchModal.debit}`} SAR</p>
            </div>
            <p className="text-sm font-medium mb-2">Select matching system transaction:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {transactions.filter(t => !matchedTxIds.has(t.id) && t.paymentMethod === 'BANK').map(tx => (
                <button key={tx.id} onClick={() => manualMatch(matchModal.id, tx.id)} className="w-full text-left p-3 border rounded-xl hover:bg-emerald-50 hover:border-emerald-300 text-sm transition">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{tx.details}</p>
                      <p className="text-xs text-slate-400">{tx.date} • {tx.buildingName || ''}</p>
                    </div>
                    <span className="font-bold text-emerald-600">{tx.amount.toLocaleString()} SAR</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankReconciliation;
